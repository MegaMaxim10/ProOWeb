const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  createCatalogError,
  normalizeModelKey,
  normalizeVersionNumber,
  loadProcessModel,
  saveProcessModel,
  toPublicModel,
  toPublicVersion,
  listDeployedModels,
} = require("./catalog");
const {
  buildRuntimeContract,
  buildRuntimeCatalogEntry,
} = require("./runtime-contract");
const {
  buildDataContract,
  buildDataCatalogEntry,
} = require("./data-contract");

const DEFAULT_BASE_PACKAGE = "com.prooweb.generated";

function normalizeString(value) {
  return String(value || "").trim();
}

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content), "utf8").digest("hex");
}

function readFileHash(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function resolveSafeAbsolutePath(rootDir, relativePath) {
  const normalizedRelativePath = toPosixPath(relativePath);
  const absolutePath = path.resolve(rootDir, normalizedRelativePath);
  const resolvedRoot = path.resolve(rootDir);

  if (absolutePath === resolvedRoot) {
    return absolutePath;
  }

  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Unsafe target path outside project root: ${relativePath}`);
  }

  return absolutePath;
}

function normalizeBasePackage(value) {
  const normalized = normalizeString(value || DEFAULT_BASE_PACKAGE).toLowerCase();
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(normalized)) {
    return DEFAULT_BASE_PACKAGE;
  }

  return normalized;
}

function escapeJavaString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function toPascalCase(value) {
  const chunks = String(value || "")
    .split(/[^a-zA-Z0-9]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return "Process";
  }

  const joined = chunks
    .map((entry) => entry[0].toUpperCase() + entry.slice(1).toLowerCase())
    .join("");

  if (/^[0-9]/.test(joined)) {
    return `P${joined}`;
  }

  return joined;
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function escapeJavaSingle(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function toJavaString(value) {
  return `"${escapeJavaString(value)}"`;
}

function toJavaList(values) {
  const source = Array.isArray(values) ? values : [];
  if (source.length === 0) {
    return "List.of()";
  }

  return `List.of(${source.map((entry) => toJavaString(entry)).join(", ")})`;
}

function toDeploymentId() {
  return `process-deploy-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function getManagedFilePath(rootDir) {
  return path.join(rootDir, ".prooweb", "process-models", "managed-files.json");
}

function readManagedFileIndex(rootDir) {
  const managedFilePath = getManagedFilePath(rootDir);
  if (!fs.existsSync(managedFilePath)) {
    return {
      schemaVersion: 1,
      files: {},
    };
  }

  try {
    const raw = fs.readFileSync(managedFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      files: parsed && typeof parsed.files === "object" && !Array.isArray(parsed.files)
        ? parsed.files
        : {},
    };
  } catch (_) {
    return {
      schemaVersion: 1,
      files: {},
    };
  }
}

function writeManagedFileIndex(rootDir, index) {
  const managedFilePath = getManagedFilePath(rootDir);
  fs.mkdirSync(path.dirname(managedFilePath), { recursive: true });
  fs.writeFileSync(managedFilePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

function backupProjectFile(rootDir, deploymentId, relativePath) {
  const sourcePath = resolveSafeAbsolutePath(rootDir, relativePath);
  const backupRelativePath = path.join(".prooweb", "backups", deploymentId, toPosixPath(relativePath));
  const backupAbsolutePath = resolveSafeAbsolutePath(rootDir, backupRelativePath);

  fs.mkdirSync(path.dirname(backupAbsolutePath), { recursive: true });
  fs.copyFileSync(sourcePath, backupAbsolutePath);

  return toPosixPath(path.relative(rootDir, backupAbsolutePath));
}

function buildBackendDefinitionClass({
  basePackage,
  modelKey,
  versionNumber,
  processName,
}) {
  const className = `${processName}ProcessV${versionNumber}Spec`;
  const bpmnResourcePath = `classpath:processes/${modelKey}/v${versionNumber}.bpmn`;

  return `package ${basePackage}.system.domain.process;

public record ${className}(String modelKey, int versionNumber, String bpmnResourcePath) {
  public static ${className} definition() {
    return new ${className}("${escapeJavaString(modelKey)}", ${versionNumber}, "${escapeJavaString(bpmnResourcePath)}");
  }
}
`;
}

function buildBackendRegistryClass({ basePackage, runtimeEntries }) {
  const rows = runtimeEntries.map(({ entry, dataEntry }) => {
    const bpmnPath = `classpath:${entry.bpmnResourcePath}`;
    const runtimePath = `classpath:${entry.runtimeContractResourcePath}`;
    const dataPath = `classpath:${dataEntry?.dataContractResourcePath || ""}`;
    const startableRolesCsv = Array.isArray(entry.startableByRoles) ? entry.startableByRoles.join(",") : "";
    const monitorRolesCsv = Array.isArray(entry.monitorRoles) ? entry.monitorRoles.join(",") : "";
    return `      new ProcessDeploymentDescriptor("${escapeJavaString(entry.modelKey)}", ${entry.versionNumber}, "${escapeJavaString(
      bpmnPath,
    )}", "${escapeJavaString(runtimePath)}", "${escapeJavaString(dataPath)}", ${entry.summary?.manualActivityCount || 0}, ${entry.summary?.automaticActivityCount || 0}, ${dataEntry?.summary?.sharedDataEntityCount || 0}, ${dataEntry?.summary?.outputMappingCount || 0}, "${escapeJavaString(
      startableRolesCsv,
    )}", "${escapeJavaString(monitorRolesCsv)}")`;
  });

  const entries = rows.length > 0 ? rows.join(",\n") : "";

  return `package ${basePackage}.system.domain.process;

import java.util.List;

public final class GeneratedProcessRegistry {
  private GeneratedProcessRegistry() {
  }

  public record ProcessDeploymentDescriptor(
      String modelKey,
      int versionNumber,
      String bpmnResourcePath,
      String runtimeContractResourcePath,
      String dataContractResourcePath,
      int manualActivityCount,
      int automaticActivityCount,
      int sharedDataEntityCount,
      int dataMappingCount,
      String startableByRolesCsv,
      String monitorRolesCsv) {
  }

  public static List<ProcessDeploymentDescriptor> deployedProcesses() {
    return List.of(
${entries}
    );
  }
}
`;
}

function buildFrontendDescriptorModule({
  model,
  version,
  processName,
  runtimeContract,
  runtimeCatalogEntry,
  dataContract,
  dataCatalogEntry,
}) {
  const exportName = `${processName}ProcessV${version.versionNumber}Descriptor`;

  return `export const ${exportName} = Object.freeze({
  modelKey: ${JSON.stringify(model.modelKey)},
  title: ${JSON.stringify(model.title)},
  description: ${JSON.stringify(model.description || "")},
  versionNumber: ${version.versionNumber},
  status: ${JSON.stringify(version.status)},
  deployedAt: ${JSON.stringify(version.deployedAt || null)},
  startableByRoles: ${JSON.stringify(runtimeContract.start.startableByRoles)},
  monitorRoles: ${JSON.stringify(runtimeContract.monitors.monitorRoles)},
  runtimeSummary: ${JSON.stringify(runtimeContract.summary)},
  runtimeContractPath: ${JSON.stringify(runtimeCatalogEntry.runtimeContractResourcePath)},
  dataSummary: ${JSON.stringify(dataContract.summary)},
  dataContractPath: ${JSON.stringify(dataCatalogEntry.dataContractResourcePath)},
  sharedDataEntities: ${JSON.stringify(dataCatalogEntry.sharedDataEntities)},
});

export default ${exportName};
`;
}

function buildFrontendRegistryModule(runtimeEntries) {
  const entries = runtimeEntries.map(({ entry, dataEntry }) => ({
    modelKey: entry.modelKey,
    title: entry.title,
    description: entry.description,
    versionNumber: entry.versionNumber,
    status: entry.status,
    deployedAt: entry.deployedAt,
    bpmnResourcePath: entry.bpmnResourcePath,
    metadataResourcePath: entry.metadataResourcePath,
    runtimeContractResourcePath: entry.runtimeContractResourcePath,
    startableByRoles: entry.startableByRoles,
    monitorRoles: entry.monitorRoles,
    runtimeSummary: entry.summary,
    dataContractResourcePath: dataEntry?.dataContractResourcePath || null,
    dataSummary: dataEntry?.summary || null,
    sharedDataEntities: dataEntry?.sharedDataEntities || [],
  }));

  return `export const generatedProcessRegistry = Object.freeze(${JSON.stringify(entries, null, 2)});

export function findGeneratedProcessDescriptor(modelKey) {
  return generatedProcessRegistry.find((entry) => entry.modelKey === String(modelKey || "")) || null;
}

export function findStartableProcessesByRole(roleCode) {
  const normalizedRole = String(roleCode || "").trim();
  return generatedProcessRegistry.filter((entry) => entry.startableByRoles.includes(normalizedRole));
}
`;
}

function buildFrontendRuntimeContractModule({ runtimeContract, processName, versionNumber }) {
  const exportName = `${processName}ProcessV${versionNumber}RuntimeContract`;
  return `export const ${exportName} = Object.freeze(${JSON.stringify(runtimeContract, null, 2)});

export default ${exportName};
`;
}

function buildFrontendDataContractModule({ dataContract, processName, versionNumber }) {
  const exportName = `${processName}ProcessV${versionNumber}DataContract`;
  return `export const ${exportName} = Object.freeze(${JSON.stringify(dataContract, null, 2)});

export default ${exportName};
`;
}

function buildFrontendDataLineageCatalogModule(runtimeEntries) {
  const rows = [];

  for (const { entry, dataContract } of runtimeEntries) {
    for (const edge of dataContract?.lineage?.edges || []) {
      rows.push({
        modelKey: entry.modelKey,
        versionNumber: entry.versionNumber,
        edgeType: edge.edgeType,
        activityId: edge.activityId,
        sourceType: edge.sourceType || null,
        sourceRef: edge.sourceRef || null,
        storageTarget: edge.storageTarget || null,
        sourcePath: edge.sourcePath || null,
        targetPath: edge.targetPath || null,
      });
    }
  }

  return `export const generatedProcessDataLineageCatalog = Object.freeze(${JSON.stringify(rows, null, 2)});

export function listDataLineageForProcess(modelKey, versionNumber) {
  const key = String(modelKey || "").trim();
  const version = Number.parseInt(String(versionNumber || ""), 10);
  return generatedProcessDataLineageCatalog.filter(
    (entry) => entry.modelKey === key && entry.versionNumber === version,
  );
}
`;
}

function buildFrontendTaskInboxCatalogModule(runtimeEntries) {
  const manualTaskRows = [];
  for (const { entry, runtimeContract } of runtimeEntries) {
    for (const activity of runtimeContract.activities || []) {
      if (activity.activityType !== "MANUAL") {
        continue;
      }

      manualTaskRows.push({
        modelKey: entry.modelKey,
        versionNumber: entry.versionNumber,
        activityId: activity.activityId,
        candidateRoles: activity.candidateRoles || [],
        assignmentMode: activity.assignment?.mode || "AUTOMATIC",
        assignmentStrategy: activity.assignment?.strategy || "ROLE_QUEUE",
        activityViewerRoles: activity.visibility?.activityViewerRoles || [],
      });
    }
  }

  return `export const generatedManualTaskCatalog = Object.freeze(${JSON.stringify(manualTaskRows, null, 2)});

export function listManualTasksByRole(roleCode) {
  const normalizedRole = String(roleCode || "").trim();
  return generatedManualTaskCatalog.filter((entry) => entry.candidateRoles.includes(normalizedRole));
}
`;
}

function buildBackendRuntimeCatalogJson(runtimeEntries) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      entries: runtimeEntries.map(({ entry }) => entry),
    },
    null,
    2,
  ) + "\n";
}

function buildBackendDataCatalogJson(runtimeEntries) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      entries: runtimeEntries.map(({ dataEntry }) => dataEntry),
    },
    null,
    2,
  ) + "\n";
}

function buildGeneratedProcessRuntimeCatalogJava({ basePackage, runtimeEntries }) {
  const processRows = runtimeEntries.map(({ entry, runtimeContract }) => {
    const activityRows = (runtimeContract.activities || []).map((activity) => {
      const automaticHandlerRef = activity.automaticExecution?.handlerRef || "";
      return `        new ActivityDescriptor(${toJavaString(activity.activityId)}, ${toJavaString(activity.activityType)}, ${toJavaList(
        activity.candidateRoles || [],
      )}, ${toJavaString(automaticHandlerRef)}, ${toJavaList(activity.visibility?.activityViewerRoles || [])}, ${toJavaList(
        activity.visibility?.dataViewerRoles || [],
      )})`;
    });
    const transitionRows = (runtimeContract.flow?.transitions || []).map((transition) =>
      `        new TransitionDescriptor(${toJavaString(transition.sourceActivityId)}, ${toJavaString(transition.targetActivityId)})`);

    const activitiesLiteral = activityRows.length > 0 ? `List.of(\n${activityRows.join(",\n")}\n      )` : "List.of()";
    const transitionsLiteral = transitionRows.length > 0 ? `List.of(\n${transitionRows.join(",\n")}\n      )` : "List.of()";
    return `      new ProcessDescriptor(
        ${toJavaString(entry.modelKey)},
        ${entry.versionNumber},
        ${toJavaList(runtimeContract.start?.startableByRoles || [])},
        ${toJavaList(runtimeContract.start?.startActivities || [])},
        ${activitiesLiteral},
        ${transitionsLiteral}
      )`;
  });

  const processListLiteral = processRows.length > 0 ? processRows.join(",\n") : "";

  return `package ${basePackage}.system.domain.process.runtime;

import java.util.List;
import java.util.Optional;

public final class GeneratedProcessRuntimeCatalog {
  private GeneratedProcessRuntimeCatalog() {
  }

  public record ActivityDescriptor(
      String activityId,
      String activityType,
      List<String> candidateRoles,
      String automaticHandlerRef,
      List<String> activityViewerRoles,
      List<String> dataViewerRoles) {
  }

  public record TransitionDescriptor(
      String sourceActivityId,
      String targetActivityId) {
  }

  public record ProcessDescriptor(
      String modelKey,
      int versionNumber,
      List<String> startableByRoles,
      List<String> startActivities,
      List<ActivityDescriptor> activities,
      List<TransitionDescriptor> transitions) {
  }

  public static List<ProcessDescriptor> deployedProcesses() {
    return List.of(
${processListLiteral}
    );
  }

  public static Optional<ProcessDescriptor> find(String modelKey, int versionNumber) {
    return deployedProcesses().stream()
      .filter((entry) -> entry.modelKey().equals(modelKey) && entry.versionNumber() == versionNumber)
      .findFirst();
  }
}
`;
}

function buildProcessRuntimeStateJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

public enum ProcessRuntimeState {
  RUNNING,
  STOPPED,
  ARCHIVED,
  COMPLETED
}
`;
}

function buildProcessRuntimeTaskStateJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

public enum ProcessRuntimeTaskState {
  PENDING,
  COMPLETED,
  CANCELLED
}
`;
}

function buildProcessRuntimeTaskJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public class ProcessRuntimeTask {
  private final String taskId;
  private final String activityId;
  private final String assignee;
  private ProcessRuntimeTaskState state;
  private final Map<String, Object> inputData;
  private final Map<String, Object> outputData;
  private final Instant createdAt;
  private Instant completedAt;

  public ProcessRuntimeTask(String taskId, String activityId, String assignee, Map<String, Object> inputData) {
    this.taskId = taskId;
    this.activityId = activityId;
    this.assignee = assignee;
    this.state = ProcessRuntimeTaskState.PENDING;
    this.inputData = new HashMap<>(inputData == null ? Map.of() : inputData);
    this.outputData = new HashMap<>();
    this.createdAt = Instant.now();
  }

  public String taskId() {
    return taskId;
  }

  public String activityId() {
    return activityId;
  }

  public String assignee() {
    return assignee;
  }

  public ProcessRuntimeTaskState state() {
    return state;
  }

  public Map<String, Object> inputData() {
    return Map.copyOf(inputData);
  }

  public Map<String, Object> outputData() {
    return Map.copyOf(outputData);
  }

  public Instant createdAt() {
    return createdAt;
  }

  public Instant completedAt() {
    return completedAt;
  }

  public void complete(Map<String, Object> outputPayload) {
    this.state = ProcessRuntimeTaskState.COMPLETED;
    this.outputData.clear();
    if (outputPayload != null) {
      this.outputData.putAll(outputPayload);
    }
    this.completedAt = Instant.now();
  }
}
`;
}

function buildProcessRuntimeInstanceJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class ProcessRuntimeInstance {
  private final String instanceId;
  private final String modelKey;
  private final int versionNumber;
  private final String startedBy;
  private ProcessRuntimeState state;
  private final Instant startedAt;
  private Instant updatedAt;
  private String archivedBy;
  private String stoppedBy;
  private String stopReason;
  private final List<ProcessRuntimeTask> tasks;
  private final List<String> timeline;
  private final Map<String, Object> contextData;

  public ProcessRuntimeInstance(String instanceId, String modelKey, int versionNumber, String startedBy, Map<String, Object> initialPayload) {
    this.instanceId = instanceId;
    this.modelKey = modelKey;
    this.versionNumber = versionNumber;
    this.startedBy = startedBy;
    this.state = ProcessRuntimeState.RUNNING;
    this.startedAt = Instant.now();
    this.updatedAt = this.startedAt;
    this.tasks = new ArrayList<>();
    this.timeline = new ArrayList<>();
    this.contextData = new HashMap<>(initialPayload == null ? Map.of() : initialPayload);
  }

  public String instanceId() {
    return instanceId;
  }

  public String modelKey() {
    return modelKey;
  }

  public int versionNumber() {
    return versionNumber;
  }

  public String startedBy() {
    return startedBy;
  }

  public ProcessRuntimeState state() {
    return state;
  }

  public Instant startedAt() {
    return startedAt;
  }

  public Instant updatedAt() {
    return updatedAt;
  }

  public String archivedBy() {
    return archivedBy;
  }

  public String stoppedBy() {
    return stoppedBy;
  }

  public String stopReason() {
    return stopReason;
  }

  public List<ProcessRuntimeTask> tasks() {
    return List.copyOf(tasks);
  }

  public List<String> timeline() {
    return List.copyOf(timeline);
  }

  public Map<String, Object> contextData() {
    return Map.copyOf(contextData);
  }

  public void addTimelineEntry(String event) {
    timeline.add(event);
    this.updatedAt = Instant.now();
  }

  public void putContextData(Map<String, Object> values) {
    if (values != null) {
      contextData.putAll(values);
      this.updatedAt = Instant.now();
    }
  }

  public void addTask(ProcessRuntimeTask task) {
    tasks.add(task);
    this.updatedAt = Instant.now();
  }

  public Optional<ProcessRuntimeTask> findTask(String taskId) {
    return tasks.stream().filter((task) -> task.taskId().equals(taskId)).findFirst();
  }

  public void markCompleted() {
    this.state = ProcessRuntimeState.COMPLETED;
    this.updatedAt = Instant.now();
  }

  public void stop(String actor, String reason) {
    this.state = ProcessRuntimeState.STOPPED;
    this.stoppedBy = actor;
    this.stopReason = reason;
    this.updatedAt = Instant.now();
  }

  public void archive(String actor) {
    this.state = ProcessRuntimeState.ARCHIVED;
    this.archivedBy = actor;
    this.updatedAt = Instant.now();
  }
}
`;
}

function buildProcessRuntimeStorePortJava({ basePackage }) {
  return `package ${basePackage}.system.application.process.runtime.port.out;

import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.util.List;
import java.util.Optional;

public interface ProcessRuntimeStorePort {
  List<ProcessRuntimeInstance> listInstances();

  Optional<ProcessRuntimeInstance> findById(String instanceId);

  void save(ProcessRuntimeInstance instance);
}
`;
}

function buildProcessRuntimeEngineUseCaseJava({ basePackage }) {
  return `package ${basePackage}.system.application.process.runtime.port.in;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public interface ProcessRuntimeEngineUseCase {
  List<StartOption> listStartOptions(StartOptionsQuery query);

  RuntimeInstanceView startInstance(StartCommand command);

  List<RuntimeInstanceView> listInstances(InstanceQuery query);

  List<RuntimeTaskView> listTasks(TaskQuery query);

  RuntimeTaskView completeTask(CompleteTaskCommand command);

  RuntimeInstanceView readInstance(String instanceId);

  RuntimeInstanceView stopInstance(StopCommand command);

  RuntimeInstanceView archiveInstance(ArchiveCommand command);

  List<String> readTimeline(String instanceId);

  record StartOptionsQuery(String actor, List<String> roleCodes) {
  }

  record StartCommand(
      String modelKey,
      int versionNumber,
      String startActivityId,
      String actor,
      List<String> roleCodes,
      Map<String, Object> initialPayload) {
  }

  record TaskQuery(String actor) {
  }

  record InstanceQuery(String actor, List<String> roleCodes) {
  }

  record CompleteTaskCommand(String instanceId, String taskId, String actor, Map<String, Object> payload) {
  }

  record StopCommand(String instanceId, String actor, String reason) {
  }

  record ArchiveCommand(String instanceId, String actor) {
  }

  record StartOption(
      String modelKey,
      int versionNumber,
      List<String> allowedStartActivities,
      List<String> startableByRoles) {
  }

  record RuntimeTaskView(
      String instanceId,
      String taskId,
      String activityId,
      String assignee,
      String status,
      Instant createdAt,
      Instant completedAt,
      Map<String, Object> inputData,
      Map<String, Object> outputData) {
  }

  record RuntimeInstanceView(
      String instanceId,
      String modelKey,
      int versionNumber,
      String status,
      String startedBy,
      Instant startedAt,
      Instant updatedAt,
      String stoppedBy,
      String stopReason,
      String archivedBy,
      List<RuntimeTaskView> tasks) {
  }
}
`;
}

function buildProcessRuntimeEngineServiceJava({ basePackage }) {
  return `package ${basePackage}.system.application.process.runtime.service;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.domain.process.runtime.GeneratedProcessRuntimeCatalog;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeState;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeTask;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeTaskState;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public class ProcessRuntimeEngineService implements ProcessRuntimeEngineUseCase {
  private final ProcessRuntimeStorePort processRuntimeStorePort;

  public ProcessRuntimeEngineService(ProcessRuntimeStorePort processRuntimeStorePort) {
    this.processRuntimeStorePort = processRuntimeStorePort;
  }

  @Override
  public List<StartOption> listStartOptions(StartOptionsQuery query) {
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    return GeneratedProcessRuntimeCatalog.deployedProcesses().stream()
      .filter((descriptor) -> descriptor.startableByRoles().isEmpty() || descriptor.startableByRoles().stream().anyMatch(roles::contains))
      .map((descriptor) -> {
        List<String> startActivities = descriptor.startActivities();
        if (startActivities == null || startActivities.isEmpty()) {
          startActivities = detectEntryActivities(descriptor, roles);
        } else {
          startActivities = startActivities.stream()
            .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
            .toList();
          if (startActivities.isEmpty()) {
            startActivities = detectEntryActivities(descriptor, roles);
          }
        }

        return new StartOption(
          descriptor.modelKey(),
          descriptor.versionNumber(),
          startActivities,
          descriptor.startableByRoles()
        );
      })
      .toList();
  }

  @Override
  public RuntimeInstanceView startInstance(StartCommand command) {
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(command.modelKey(), command.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Unknown deployed process model/version"));
    List<String> actorRoles = command.roleCodes() == null ? List.of() : command.roleCodes();
    if (!descriptor.startableByRoles().isEmpty() && descriptor.startableByRoles().stream().noneMatch(actorRoles::contains)) {
      throw new IllegalStateException("Actor roles are not allowed to start this process.");
    }

    String startActivityId = resolveStartActivityId(descriptor, command.startActivityId(), actorRoles);
    ProcessRuntimeInstance instance = new ProcessRuntimeInstance(
      "prc-" + UUID.randomUUID(),
      descriptor.modelKey(),
      descriptor.versionNumber(),
      command.actor(),
      command.initialPayload()
    );
    instance.addTimelineEntry("INSTANCE_STARTED:" + command.actor());
    createOrAdvanceTasks(instance, descriptor, startActivityId, command.actor(), command.initialPayload(), true);

    processRuntimeStorePort.save(instance);
    return toInstanceView(instance);
  }

  @Override
  public List<RuntimeInstanceView> listInstances(InstanceQuery query) {
    String actor = query.actor();
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = roles.stream().anyMatch((role) ->
      "PROCESS_MONITOR".equals(role) || "ADMINISTRATOR".equals(role)
    );

    return processRuntimeStorePort.listInstances().stream()
      .filter((instance) -> {
        if (monitorPrivileges) {
          return true;
        }
        if (actor == null || actor.isBlank()) {
          return false;
        }
        if (Objects.equals(instance.startedBy(), actor)) {
          return true;
        }
        return instance.tasks().stream().anyMatch((task) -> Objects.equals(task.assignee(), actor));
      })
      .map(this::toInstanceView)
      .toList();
  }

  @Override
  public List<RuntimeTaskView> listTasks(TaskQuery query) {
    String actor = query.actor();
    return processRuntimeStorePort.listInstances().stream()
      .flatMap((instance) -> instance.tasks().stream()
        .filter((task) -> task.state() == ProcessRuntimeTaskState.PENDING)
        .filter((task) -> actor == null || actor.isBlank() || Objects.equals(task.assignee(), actor))
        .map((task) -> toTaskView(instance.instanceId(), task)))
      .toList();
  }

  @Override
  public RuntimeTaskView completeTask(CompleteTaskCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      throw new IllegalStateException("Instance is not running");
    }

    ProcessRuntimeTask task = instance.findTask(command.taskId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown task"));
    if (task.state() != ProcessRuntimeTaskState.PENDING) {
      throw new IllegalStateException("Task already completed or cancelled");
    }

    task.complete(command.payload());
    instance.putContextData(command.payload());
    instance.addTimelineEntry("TASK_COMPLETED:" + task.activityId() + ":" + command.actor());

    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Missing deployed descriptor for instance"));
    createOrAdvanceTasks(instance, descriptor, task.activityId(), command.actor(), command.payload(), false);

    processRuntimeStorePort.save(instance);
    return toTaskView(instance.instanceId(), task);
  }

  @Override
  public RuntimeInstanceView readInstance(String instanceId) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(instanceId)
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    return toInstanceView(instance);
  }

  @Override
  public RuntimeInstanceView stopInstance(StopCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    instance.stop(command.actor(), command.reason());
    instance.addTimelineEntry("INSTANCE_STOPPED:" + command.actor() + ":" + command.reason());
    processRuntimeStorePort.save(instance);
    return toInstanceView(instance);
  }

  @Override
  public RuntimeInstanceView archiveInstance(ArchiveCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    instance.archive(command.actor());
    instance.addTimelineEntry("INSTANCE_ARCHIVED:" + command.actor());
    processRuntimeStorePort.save(instance);
    return toInstanceView(instance);
  }

  @Override
  public List<String> readTimeline(String instanceId) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(instanceId)
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    return instance.timeline();
  }

  private String resolveStartActivityId(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String requestedStartActivityId,
      List<String> actorRoles) {
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    if (requestedStartActivityId != null && !requestedStartActivityId.isBlank()) {
      if (!hasActivity(descriptor, requestedStartActivityId)) {
        throw new IllegalArgumentException("Unknown requested start activity: " + requestedStartActivityId);
      }
      if (!isActivityStartableByRoles(descriptor, requestedStartActivityId, roles)) {
        throw new IllegalStateException("Requested start activity is not startable for actor roles.");
      }
      return requestedStartActivityId;
    }

    List<String> startActivities = descriptor.startActivities();
    if (startActivities != null && !startActivities.isEmpty()) {
      Optional<String> startActivity = startActivities.stream()
        .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
        .findFirst();
      if (startActivity.isPresent()) {
        return startActivity.get();
      }
    }

    return detectEntryActivities(descriptor, roles).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalArgumentException("No startable activity for actor roles"));
  }

  private void createOrAdvanceTasks(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId,
      String actor,
      Map<String, Object> payload,
      boolean createFromCurrent) {
    if (createFromCurrent) {
      processActivity(instance, descriptor, activityId, actor, payload, new HashSet<>());
      maybeCompleteInstance(instance);
      return;
    }

    List<String> nextActivityIds = nextActivityIds(descriptor, activityId);
    if (nextActivityIds.isEmpty()) {
      maybeCompleteInstance(instance);
      return;
    }

    for (String nextActivityId : nextActivityIds) {
      processActivity(instance, descriptor, nextActivityId, actor, payload, new HashSet<>());
    }

    maybeCompleteInstance(instance);
  }

  private void processActivity(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId,
      String actor,
      Map<String, Object> payload,
      Set<String> pathVisited) {
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      return;
    }

    if (pathVisited.contains(activityId)) {
      instance.addTimelineEntry("FLOW_CYCLE_DETECTED:" + activityId);
      return;
    }

    GeneratedProcessRuntimeCatalog.ActivityDescriptor descriptorActivity = findActivity(descriptor, activityId)
      .orElseThrow(() -> new IllegalArgumentException("Unknown activity in descriptor: " + activityId));
    Set<String> nextVisited = new HashSet<>(pathVisited);
    nextVisited.add(activityId);

    if ("AUTOMATIC".equals(descriptorActivity.activityType())) {
      instance.addTimelineEntry("AUTOMATIC_ACTIVITY_EXECUTED:" + descriptorActivity.activityId() + ":stub");
      List<String> nextActivityIds = nextActivityIds(descriptor, activityId);
      if (nextActivityIds.isEmpty()) {
        return;
      }
      for (String nextActivityId : nextActivityIds) {
        processActivity(instance, descriptor, nextActivityId, actor, payload, nextVisited);
      }
      return;
    }

    if (hasActiveOrCompletedTaskForActivity(instance, activityId)) {
      instance.addTimelineEntry("TASK_ALREADY_TRACKED:" + descriptorActivity.activityId());
      return;
    }

    String assignee = actor == null || actor.isBlank() ? "SYSTEM" : actor;
    ProcessRuntimeTask task = new ProcessRuntimeTask(
      "tsk-" + UUID.randomUUID(),
      descriptorActivity.activityId(),
      assignee,
      payload == null ? Map.of() : payload
    );
    instance.addTask(task);
    instance.addTimelineEntry("TASK_CREATED:" + descriptorActivity.activityId() + ":" + assignee);
  }

  private void maybeCompleteInstance(ProcessRuntimeInstance instance) {
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      return;
    }
    boolean hasPendingTasks = instance.tasks().stream()
      .anyMatch((task) -> task.state() == ProcessRuntimeTaskState.PENDING);
    if (!hasPendingTasks) {
      instance.markCompleted();
      instance.addTimelineEntry("INSTANCE_COMPLETED");
    }
  }

  private Optional<GeneratedProcessRuntimeCatalog.ActivityDescriptor> findActivity(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId) {
    return descriptor.activities().stream()
      .filter((activity) -> Objects.equals(activity.activityId(), activityId))
      .findFirst();
  }

  private boolean hasActivity(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId) {
    return findActivity(descriptor, activityId).isPresent();
  }

  private boolean isActivityStartableByRoles(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId,
      List<String> roles) {
    Optional<GeneratedProcessRuntimeCatalog.ActivityDescriptor> activity = findActivity(descriptor, activityId);
    if (activity.isEmpty()) {
      return false;
    }
    if (!"MANUAL".equals(activity.get().activityType())) {
      return true;
    }
    List<String> candidateRoles = activity.get().candidateRoles();
    return candidateRoles == null
      || candidateRoles.isEmpty()
      || candidateRoles.stream().anyMatch(roles::contains);
  }

  private List<String> detectEntryActivities(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      List<String> roles) {
    Map<String, Integer> incomingCountByActivity = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.ActivityDescriptor activity : descriptor.activities()) {
      incomingCountByActivity.put(activity.activityId(), 0);
    }
    for (GeneratedProcessRuntimeCatalog.TransitionDescriptor transition : descriptor.transitions()) {
      incomingCountByActivity.computeIfPresent(
        transition.targetActivityId(),
        (key, value) -> Integer.valueOf(value.intValue() + 1)
      );
    }

    List<String> entryActivities = descriptor.activities().stream()
      .map(GeneratedProcessRuntimeCatalog.ActivityDescriptor::activityId)
      .filter((activityId) -> incomingCountByActivity.getOrDefault(activityId, 0) == 0)
      .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
      .toList();
    if (!entryActivities.isEmpty()) {
      return entryActivities;
    }

    return descriptor.activities().stream()
      .map(GeneratedProcessRuntimeCatalog.ActivityDescriptor::activityId)
      .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
      .toList();
  }

  private List<String> nextActivityIds(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId) {
    List<String> fromTransitions = descriptor.transitions().stream()
      .filter((transition) -> Objects.equals(transition.sourceActivityId(), activityId))
      .map(GeneratedProcessRuntimeCatalog.TransitionDescriptor::targetActivityId)
      .distinct()
      .toList();
    if (!fromTransitions.isEmpty()) {
      return fromTransitions;
    }

    List<GeneratedProcessRuntimeCatalog.ActivityDescriptor> activities = descriptor.activities();
    List<String> orderedActivityIds = activities.stream()
      .map(GeneratedProcessRuntimeCatalog.ActivityDescriptor::activityId)
      .toList();
    int currentIndex = orderedActivityIds.indexOf(activityId);
    if (currentIndex < 0) {
      return List.of();
    }
    int nextIndex = currentIndex + 1;
    if (nextIndex >= orderedActivityIds.size()) {
      return List.of();
    }
    return List.of(orderedActivityIds.get(nextIndex));
  }

  private boolean hasActiveOrCompletedTaskForActivity(
      ProcessRuntimeInstance instance,
      String activityId) {
    return instance.tasks().stream()
      .anyMatch((task) -> Objects.equals(task.activityId(), activityId) && task.state() != ProcessRuntimeTaskState.CANCELLED);
  }

  private RuntimeTaskView toTaskView(String instanceId, ProcessRuntimeTask task) {
    return new RuntimeTaskView(
      instanceId,
      task.taskId(),
      task.activityId(),
      task.assignee(),
      task.state().name(),
      task.createdAt(),
      task.completedAt(),
      task.inputData(),
      task.outputData()
    );
  }

  private RuntimeInstanceView toInstanceView(ProcessRuntimeInstance instance) {
    List<RuntimeTaskView> taskViews = instance.tasks().stream()
      .map((task) -> toTaskView(instance.instanceId(), task))
      .collect(Collectors.toCollection(ArrayList::new));

    return new RuntimeInstanceView(
      instance.instanceId(),
      instance.modelKey(),
      instance.versionNumber(),
      instance.state().name(),
      instance.startedBy(),
      instance.startedAt(),
      instance.updatedAt(),
      instance.stoppedBy(),
      instance.stopReason(),
      instance.archivedBy(),
      taskViews
    );
  }
}
`;
}

function buildInMemoryProcessRuntimeStoreAdapterJava({ basePackage }) {
  return `package ${basePackage}.system.infrastructure.process.runtime;

import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class InMemoryProcessRuntimeStoreAdapter implements ProcessRuntimeStorePort {
  private final Map<String, ProcessRuntimeInstance> byInstanceId = new ConcurrentHashMap<>();

  @Override
  public List<ProcessRuntimeInstance> listInstances() {
    return new ArrayList<>(byInstanceId.values());
  }

  @Override
  public Optional<ProcessRuntimeInstance> findById(String instanceId) {
    return Optional.ofNullable(byInstanceId.get(instanceId));
  }

  @Override
  public void save(ProcessRuntimeInstance instance) {
    byInstanceId.put(instance.instanceId(), instance);
  }
}
`;
}

function buildProcessRuntimeModuleConfigJava({ basePackage }) {
  return `package ${basePackage}.system.infrastructure.config;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.application.process.runtime.service.ProcessRuntimeEngineService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ProcessRuntimeModuleConfig {
  @Bean
  ProcessRuntimeEngineUseCase processRuntimeEngineUseCase(ProcessRuntimeStorePort processRuntimeStorePort) {
    return new ProcessRuntimeEngineService(processRuntimeStorePort);
  }
}
`;
}

function buildGatewayProcessRuntimeControllerJava({ basePackage }) {
  return `package ${basePackage}.gateway.api;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/process-runtime")
public class ProcessRuntimeController {
  private final ProcessRuntimeEngineUseCase processRuntimeEngineUseCase;

  public ProcessRuntimeController(ProcessRuntimeEngineUseCase processRuntimeEngineUseCase) {
    this.processRuntimeEngineUseCase = processRuntimeEngineUseCase;
  }

  @Operation(summary = "List guided start options for an actor and roles")
  @GetMapping("/start-options")
  public Map<String, Object> listStartOptions(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "startOptions",
      processRuntimeEngineUseCase.listStartOptions(new ProcessRuntimeEngineUseCase.StartOptionsQuery(actor, roles))
    );
  }

  @Operation(summary = "Start a process instance")
  @PostMapping("/instances/start")
  public Map<String, Object> startInstance(@RequestBody StartInstancePayload payload) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.startInstance(
        new ProcessRuntimeEngineUseCase.StartCommand(
          payload.modelKey(),
          payload.versionNumber(),
          payload.startActivityId(),
          payload.actor(),
          payload.roleCodes(),
          payload.initialPayload()
        )
      )
    );
  }

  @Operation(summary = "List runtime instances visible to actor roles")
  @GetMapping("/instances")
  public Map<String, Object> listInstances(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "instances",
      processRuntimeEngineUseCase.listInstances(new ProcessRuntimeEngineUseCase.InstanceQuery(actor, roles))
    );
  }

  @Operation(summary = "List pending tasks for actor")
  @GetMapping("/tasks")
  public Map<String, Object> listTasks(@RequestParam(name = "actor", required = false) String actor) {
    return Map.of(
      "tasks",
      processRuntimeEngineUseCase.listTasks(new ProcessRuntimeEngineUseCase.TaskQuery(actor))
    );
  }

  @Operation(summary = "Complete a runtime task")
  @PostMapping("/tasks/{taskId}/complete")
  public Map<String, Object> completeTask(
    @PathVariable("taskId") String taskId,
    @RequestBody CompleteTaskPayload payload
  ) {
    return Map.of(
      "task",
      processRuntimeEngineUseCase.completeTask(
        new ProcessRuntimeEngineUseCase.CompleteTaskCommand(
          payload.instanceId(),
          taskId,
          payload.actor(),
          payload.payload()
        )
      )
    );
  }

  @Operation(summary = "Read process runtime instance")
  @GetMapping("/instances/{instanceId}")
  public Map<String, Object> readInstance(@PathVariable("instanceId") String instanceId) {
    return Map.of("instance", processRuntimeEngineUseCase.readInstance(instanceId));
  }

  @Operation(summary = "Read process runtime timeline")
  @GetMapping("/instances/{instanceId}/timeline")
  public Map<String, Object> readTimeline(@PathVariable("instanceId") String instanceId) {
    return Map.of("timeline", processRuntimeEngineUseCase.readTimeline(instanceId));
  }

  @Operation(summary = "Stop runtime instance")
  @PostMapping("/instances/{instanceId}/stop")
  public Map<String, Object> stopInstance(
    @PathVariable("instanceId") String instanceId,
    @RequestBody StopInstancePayload payload
  ) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.stopInstance(
        new ProcessRuntimeEngineUseCase.StopCommand(instanceId, payload.actor(), payload.reason())
      )
    );
  }

  @Operation(summary = "Archive runtime instance")
  @PostMapping("/instances/{instanceId}/archive")
  public Map<String, Object> archiveInstance(
    @PathVariable("instanceId") String instanceId,
    @RequestBody ArchiveInstancePayload payload
  ) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.archiveInstance(
        new ProcessRuntimeEngineUseCase.ArchiveCommand(instanceId, payload.actor())
      )
    );
  }

  public record StartInstancePayload(
    String modelKey,
    int versionNumber,
    String startActivityId,
    String actor,
    List<String> roleCodes,
    Map<String, Object> initialPayload
  ) {
  }

  public record CompleteTaskPayload(
    String instanceId,
    String actor,
    Map<String, Object> payload
  ) {
  }

  public record StopInstancePayload(
    String actor,
    String reason
  ) {
  }

  public record ArchiveInstancePayload(
    String actor
  ) {
  }
}
`;
}

function buildProcessRuntimeEngineUtJava({ basePackage }) {
  return `package ${basePackage}.tests.unit;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.application.process.runtime.service.ProcessRuntimeEngineService;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessRuntimeEngineUT {
  @Test
  void shouldStartAndCompleteTaskForDeployedProcess() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());

    List<ProcessRuntimeEngineUseCase.StartOption> startOptions = useCase.listStartOptions(
      new ProcessRuntimeEngineUseCase.StartOptionsQuery("alice", List.of("PROCESS_USER"))
    );
    assertThat(startOptions).isNotEmpty();

    ProcessRuntimeEngineUseCase.StartOption option = startOptions.get(0);
    ProcessRuntimeEngineUseCase.RuntimeInstanceView started = useCase.startInstance(
      new ProcessRuntimeEngineUseCase.StartCommand(
        option.modelKey(),
        option.versionNumber(),
        option.allowedStartActivities().isEmpty() ? null : option.allowedStartActivities().get(0),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("amount", 1000)
      )
    );

    assertThat(started.instanceId()).isNotBlank();
    assertThat(started.tasks()).isNotEmpty();

    ProcessRuntimeEngineUseCase.RuntimeTaskView task = started.tasks().stream()
      .filter((entry) -> "PENDING".equals(entry.status()))
      .findFirst()
      .orElseThrow();

    ProcessRuntimeEngineUseCase.RuntimeTaskView completed = useCase.completeTask(
      new ProcessRuntimeEngineUseCase.CompleteTaskCommand(
        started.instanceId(),
        task.taskId(),
        "alice",
        Map.of("decision", "APPROVED")
      )
    );

    assertThat(completed.status()).isEqualTo("COMPLETED");
  }

  private static final class InMemoryStore implements ProcessRuntimeStorePort {
    private final Map<String, ProcessRuntimeInstance> byId = new HashMap<>();

    @Override
    public List<ProcessRuntimeInstance> listInstances() {
      return new ArrayList<>(byId.values());
    }

    @Override
    public Optional<ProcessRuntimeInstance> findById(String instanceId) {
      return Optional.ofNullable(byId.get(instanceId));
    }

    @Override
    public void save(ProcessRuntimeInstance instance) {
      byId.put(instance.instanceId(), instance);
    }
  }
}
`;
}

function buildProcessRuntimeEngineItJava({ basePackage, modelKey, versionNumber }) {
  return `package ${basePackage}.tests.system;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prooweb.generated.app.ProowebApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
  classes = ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=jdbc:h2:mem:prooweb-runtime-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
  }
)
@AutoConfigureMockMvc
class ProcessRuntimeEngineIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldStartAndCompleteRuntimeTaskThroughApi() throws Exception {
    mockMvc.perform(
      get("/api/process-runtime/start-options")
        .queryParam("actor", "runtime.user")
        .queryParam("roles", "PROCESS_USER")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.startOptions").isArray());

    MvcResult startResult = mockMvc.perform(
      post("/api/process-runtime/instances/start")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "modelKey": "${escapeJavaSingle(modelKey)}",
            "versionNumber": ${versionNumber},
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
            "initialPayload": {
              "seed": "runtime-test"
            }
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instance.instanceId").isNotEmpty())
      .andReturn();

    JsonNode startPayload = objectMapper.readTree(startResult.getResponse().getContentAsString());
    String instanceId = startPayload.path("instance").path("instanceId").asText();
    String taskId = startPayload.path("instance").path("tasks").get(0).path("taskId").asText();

    mockMvc.perform(
      get("/api/process-runtime/instances")
        .queryParam("actor", "runtime.user")
        .queryParam("roles", "PROCESS_USER")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instances").isArray());

    mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/complete")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "instanceId": "__INSTANCE_ID__",
            "actor": "runtime.user",
            "payload": {
              "decision": "APPROVED"
            }
          }
          """.replace("__INSTANCE_ID__", instanceId))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.task.status").value("COMPLETED"));

    mockMvc.perform(
      get("/api/process-runtime/instances/" + instanceId + "/timeline")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.timeline").isArray());
  }
}
`;
}

function buildGeneratedProcessRuntimeApiJs() {
  return `const PROCESS_RUNTIME_API_ROOT = "/api/process-runtime";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || ("Process runtime request failed: " + response.status));
  }

  return payload;
}

export function fetchProcessRuntimeStartOptions({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/start-options?" + query.toString());
}

export function startProcessRuntimeInstance(payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/start", {
    method: "POST",
    body: payload,
  });
}

export function listProcessRuntimeTasks(actor = "") {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/tasks?" + query.toString());
}

export function listProcessRuntimeInstances({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances?" + query.toString());
}

export function completeProcessRuntimeTask(taskId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/tasks/" + encodeURIComponent(taskId) + "/complete", {
    method: "POST",
    body: payload,
  });
}

export function readProcessRuntimeInstance(instanceId) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId));
}

export function readProcessRuntimeTimeline(instanceId) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/timeline");
}

export function stopProcessRuntimeInstance(instanceId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/stop", {
    method: "POST",
    body: payload,
  });
}

export function archiveProcessRuntimeInstance(instanceId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/archive", {
    method: "POST",
    body: payload,
  });
}
`;
}

function buildGeneratedProcessRuntimeHandlersReadmeMd(runtimeEntries) {
  const lines = [
    "# Generated Automatic Handler Stubs",
    "",
    "These classes are generated from deployed process specifications.",
    "Each method is a compilation-safe placeholder for automatic activities and must be implemented by developers.",
    "",
    "## Generated Stubs",
  ];

  for (const { model, version, runtimeContract } of runtimeEntries) {
    const automaticActivities = (runtimeContract.activities || []).filter((activity) => activity.activityType === "AUTOMATIC");
    lines.push(`- ${model.modelKey} v${version.versionNumber}: ${automaticActivities.length} automatic handler stub(s)`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildAutomaticHandlersStubJava({ basePackage, processName, modelKey, versionNumber, runtimeContract }) {
  const className = `${processName}ProcessV${versionNumber}AutomaticHandlers`;
  const automaticActivities = (runtimeContract.activities || []).filter((entry) => entry.activityType === "AUTOMATIC");
  const methods = automaticActivities.length > 0
    ? automaticActivities.map((activity) => {
      const methodName = `handle${toPascalCase(activity.activityId)}`;
      const handlerRef = activity.automaticExecution?.handlerRef || `handlers.${toCamelCase(activity.activityId)}`;
      return `  /**
   * Stub generated from ${handlerRef}.
   * Replace this placeholder with business implementation.
   */
  public Map<String, Object> ${methodName}(Map<String, Object> inputData) {
    return Map.of(
      "status", "NOT_IMPLEMENTED",
      "handlerRef", "${escapeJavaString(handlerRef)}",
      "activityId", "${escapeJavaString(activity.activityId)}"
    );
  }`;
    }).join("\n\n")
    : `  public Map<String, Object> noAutomaticActivityStub(Map<String, Object> inputData) {
    return Map.of(
      "status", "NO_AUTOMATIC_ACTIVITY",
      "modelKey", "${escapeJavaString(modelKey)}"
    );
  }`;

  return `package ${basePackage}.system.application.process.runtime.handlers;

import java.util.Map;

public class ${className} {
${methods}
}
`;
}

function buildVersionMetadata(model, version, runtimeContract, dataContract) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      modelKey: model.modelKey,
      title: model.title,
      description: model.description || "",
      versionNumber: version.versionNumber,
      status: version.status,
      summary: version.summary || "",
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      deployedAt: version.deployedAt || null,
      specificationSchemaVersion: version?.specification?.schemaVersion || null,
      specification: version?.specification || null,
      runtimeSummary: runtimeContract?.summary || null,
      dataSummary: dataContract?.summary || null,
    },
    null,
    2,
  ) + "\n";
}

function buildDeploymentFiles({ workspaceConfig, model, version, deployedRecords }) {
  const basePackage = normalizeBasePackage(workspaceConfig?.project?.basePackage || DEFAULT_BASE_PACKAGE);
  const basePackagePath = basePackage.replace(/\./g, "/");
  const processName = toPascalCase(model.modelKey);
  const runtimeContract = buildRuntimeContract({ model, version });
  const dataContract = buildDataContract({
    model,
    version,
    runtimeContract,
  });
  const runtimeEntries = deployedRecords.map((entry) => {
    const deployedRuntimeContract = buildRuntimeContract({
      model: entry.model,
      version: entry.version,
    });
    const deployedDataContract = buildDataContract({
      model: entry.model,
      version: entry.version,
      runtimeContract: deployedRuntimeContract,
    });

    return {
      model: entry.model,
      version: entry.version,
      runtimeContract: deployedRuntimeContract,
      dataContract: deployedDataContract,
      entry: buildRuntimeCatalogEntry({
        model: entry.model,
        version: entry.version,
        contract: deployedRuntimeContract,
      }),
      dataEntry: buildDataCatalogEntry({
        model: entry.model,
        version: entry.version,
        dataContract: deployedDataContract,
      }),
    };
  });
  const currentRuntimeEntry = runtimeEntries.find(
    (entry) =>
      entry.model.modelKey === model.modelKey
      && entry.version.versionNumber === version.versionNumber,
  );

  const backendProcessRoot = path.join(
    "src/backend/springboot/system/system-domain/src/main/java",
    basePackagePath,
    "system/domain/process",
  );
  const backendDomainRuntimeRoot = path.join(
    "src/backend/springboot/system/system-domain/src/main/java",
    basePackagePath,
    "system/domain/process/runtime",
  );
  const backendApplicationRuntimeRoot = path.join(
    "src/backend/springboot/system/system-application/src/main/java",
    basePackagePath,
    "system/application/process/runtime",
  );
  const backendInfrastructureRuntimeRoot = path.join(
    "src/backend/springboot/system/system-infrastructure/src/main/java",
    basePackagePath,
    "system/infrastructure/process/runtime",
  );
  const backendInfrastructureConfigRoot = path.join(
    "src/backend/springboot/system/system-infrastructure/src/main/java",
    basePackagePath,
    "system/infrastructure/config",
  );
  const backendGatewayApiRoot = path.join(
    "src/backend/springboot/gateway/src/main/java",
    basePackagePath,
    "gateway/api",
  );
  const backendUnitTestsRoot = path.join(
    "src/backend/springboot/tests/vanilla-unit-tests/system-application-ut/src/test/java",
    basePackagePath,
    "tests/unit",
  );
  const backendIntegrationTestsRoot = path.join(
    "src/backend/springboot/system/system-infrastructure-it/src/test/java",
    basePackagePath,
    "tests/system",
  );
  const backendResourcesRoot = path.join("src/backend/springboot/prooweb-application/src/main/resources/processes", model.modelKey);
  const frontendProcessRoot = path.join("src/frontend/web/react/src/modules/processes", model.modelKey);
  const frontendRuntimeRoot = "src/frontend/web/react/src/modules/processes/runtime";

  const files = [
    {
      relativePath: toPosixPath(path.join(backendProcessRoot, `${processName}ProcessV${version.versionNumber}Spec.java`)),
      content: buildBackendDefinitionClass({
        basePackage,
        modelKey: model.modelKey,
        versionNumber: version.versionNumber,
        processName,
      }),
      kind: "backend-java",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.bpmn`)),
      content: String(version.bpmnXml || ""),
      kind: "backend-bpmn",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.json`)),
      content: buildVersionMetadata(model, version, runtimeContract, dataContract),
      kind: "backend-metadata",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.runtime.json`)),
      content: `${JSON.stringify(runtimeContract, null, 2)}\n`,
      kind: "backend-runtime-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.data.json`)),
      content: `${JSON.stringify(dataContract, null, 2)}\n`,
      kind: "backend-data-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: "src/backend/springboot/prooweb-application/src/main/resources/processes/runtime-catalog.json",
      content: buildBackendRuntimeCatalogJson(runtimeEntries),
      kind: "backend-runtime-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: "src/backend/springboot/prooweb-application/src/main/resources/processes/data-catalog.json",
      content: buildBackendDataCatalogJson(runtimeEntries),
      kind: "backend-data-catalog",
      modelKey: "_data_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "GeneratedProcessRuntimeCatalog.java")),
      content: buildGeneratedProcessRuntimeCatalogJava({ basePackage, runtimeEntries }),
      kind: "backend-runtime-generated-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeState.java")),
      content: buildProcessRuntimeStateJava({ basePackage }),
      kind: "backend-runtime-domain-state",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeTaskState.java")),
      content: buildProcessRuntimeTaskStateJava({ basePackage }),
      kind: "backend-runtime-domain-task-state",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeTask.java")),
      content: buildProcessRuntimeTaskJava({ basePackage }),
      kind: "backend-runtime-domain-task",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeInstance.java")),
      content: buildProcessRuntimeInstanceJava({ basePackage }),
      kind: "backend-runtime-domain-instance",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "port/in/ProcessRuntimeEngineUseCase.java")),
      content: buildProcessRuntimeEngineUseCaseJava({ basePackage }),
      kind: "backend-runtime-application-usecase",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "port/out/ProcessRuntimeStorePort.java")),
      content: buildProcessRuntimeStorePortJava({ basePackage }),
      kind: "backend-runtime-application-store-port",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "service/ProcessRuntimeEngineService.java")),
      content: buildProcessRuntimeEngineServiceJava({ basePackage }),
      kind: "backend-runtime-application-service",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, `handlers/${processName}ProcessV${version.versionNumber}AutomaticHandlers.java`)),
      content: buildAutomaticHandlersStubJava({
        basePackage,
        processName,
        modelKey: model.modelKey,
        versionNumber: version.versionNumber,
        runtimeContract,
      }),
      kind: "backend-runtime-automatic-handler-stub",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "handlers/README.md")),
      content: buildGeneratedProcessRuntimeHandlersReadmeMd(runtimeEntries),
      kind: "backend-runtime-handlers-readme",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendInfrastructureRuntimeRoot, "InMemoryProcessRuntimeStoreAdapter.java")),
      content: buildInMemoryProcessRuntimeStoreAdapterJava({ basePackage }),
      kind: "backend-runtime-infrastructure-store",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendInfrastructureConfigRoot, "ProcessRuntimeModuleConfig.java")),
      content: buildProcessRuntimeModuleConfigJava({ basePackage }),
      kind: "backend-runtime-infrastructure-config",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendGatewayApiRoot, "ProcessRuntimeController.java")),
      content: buildGatewayProcessRuntimeControllerJava({ basePackage }),
      kind: "backend-runtime-gateway-controller",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendUnitTestsRoot, "ProcessRuntimeEngineUT.java")),
      content: buildProcessRuntimeEngineUtJava({ basePackage }),
      kind: "backend-runtime-ut",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendIntegrationTestsRoot, "ProcessRuntimeEngineIT.java")),
      content: buildProcessRuntimeEngineItJava({
        basePackage,
        modelKey: model.modelKey,
        versionNumber: version.versionNumber,
      }),
      kind: "backend-runtime-it",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}Descriptor.js`)),
      content: buildFrontendDescriptorModule({
        model,
        version,
        processName,
        runtimeContract,
        runtimeCatalogEntry: currentRuntimeEntry?.entry || buildRuntimeCatalogEntry({ model, version, contract: runtimeContract }),
        dataContract,
        dataCatalogEntry: currentRuntimeEntry?.dataEntry || buildDataCatalogEntry({ model, version, dataContract }),
      }),
      kind: "frontend-descriptor",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}RuntimeContract.js`)),
      content: buildFrontendRuntimeContractModule({
        runtimeContract,
        processName,
        versionNumber: version.versionNumber,
      }),
      kind: "frontend-runtime-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}DataContract.js`)),
      content: buildFrontendDataContractModule({
        dataContract,
        processName,
        versionNumber: version.versionNumber,
      }),
      kind: "frontend-data-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(
        "src/backend/springboot/system/system-domain/src/main/java",
        basePackagePath,
        "system/domain/process/GeneratedProcessRegistry.java",
      )),
      content: buildBackendRegistryClass({ basePackage, runtimeEntries }),
      kind: "backend-registry",
      modelKey: "_registry_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessRegistry.js",
      content: buildFrontendRegistryModule(runtimeEntries),
      kind: "frontend-registry",
      modelKey: "_registry_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedTaskInboxCatalog.js",
      content: buildFrontendTaskInboxCatalogModule(runtimeEntries),
      kind: "frontend-task-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessDataLineageCatalog.js",
      content: buildFrontendDataLineageCatalogModule(runtimeEntries),
      kind: "frontend-data-lineage-catalog",
      modelKey: "_data_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(frontendRuntimeRoot, "generatedProcessRuntimeApi.js")),
      content: buildGeneratedProcessRuntimeApiJs(),
      kind: "frontend-runtime-api",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
  ];

  return {
    files,
    runtimeContract,
    dataContract,
    runtimeEntries,
  };
}

function buildDeploymentRecordKey(modelKey, versionNumber) {
  return `${normalizeModelKey(modelKey)}::${normalizeVersionNumber(versionNumber)}`;
}

function buildManagedDeploymentPlan({ workspaceConfig, deployedRecords }) {
  const fileByPath = new Map();
  const buildByRecord = new Map();

  for (const record of Array.isArray(deployedRecords) ? deployedRecords : []) {
    const build = buildDeploymentFiles({
      workspaceConfig,
      model: record.model,
      version: record.version,
      deployedRecords,
    });
    buildByRecord.set(
      buildDeploymentRecordKey(record.model.modelKey, record.version.versionNumber),
      build,
    );

    for (const file of build.files) {
      fileByPath.set(toPosixPath(file.relativePath), file);
    }
  }

  return {
    files: Array.from(fileByPath.values()),
    buildByRecord,
  };
}

function applyManagedDeploymentWrite(rootDir, files, deploymentId, options = {}) {
  const removeMissing = Boolean(options.removeMissing);
  const report = {
    deploymentId,
    backupRoot: toPosixPath(path.join(".prooweb", "backups", deploymentId)),
    summary: {
      filesGenerated: files.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      conflictsResolved: 0,
      collisionsResolved: 0,
      backupsCreated: 0,
    },
    details: {
      created: [],
      updated: [],
      unchanged: [],
      removed: [],
      conflictsResolved: [],
      collisionsResolved: [],
      backups: [],
    },
  };

  const managedIndex = readManagedFileIndex(rootDir);
  const filesIndex = managedIndex.files || {};
  const existingManagedEntries = { ...filesIndex };
  const targetPaths = new Set(files.map((entry) => toPosixPath(entry.relativePath)));

  for (const file of files) {
    const relativePath = toPosixPath(file.relativePath);
    const absolutePath = resolveSafeAbsolutePath(rootDir, relativePath);
    const newHash = hashContent(file.content);
    const previousManaged = filesIndex[relativePath] || null;
    const exists = fs.existsSync(absolutePath);

    if (!exists) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, file.content, "utf8");
      report.summary.created += 1;
      report.details.created.push({ path: relativePath, kind: file.kind });
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    const currentHash = readFileHash(absolutePath);

    if (currentHash === newHash) {
      report.summary.unchanged += 1;
      report.details.unchanged.push({ path: relativePath, kind: file.kind });
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    const manuallyChangedManaged = Boolean(previousManaged?.sha256) && previousManaged.sha256 !== currentHash;
    const collision = !previousManaged?.sha256;

    if (manuallyChangedManaged) {
      const backupPath = backupProjectFile(rootDir, deploymentId, relativePath);
      report.summary.backupsCreated += 1;
      report.summary.conflictsResolved += 1;
      report.details.backups.push({ path: relativePath, backupPath });
      report.details.conflictsResolved.push({
        path: relativePath,
        kind: file.kind,
        backupPath,
        previousManagedHash: previousManaged.sha256,
        currentHash,
        newHash,
      });

      fs.writeFileSync(absolutePath, file.content, "utf8");
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    if (collision) {
      const backupPath = backupProjectFile(rootDir, deploymentId, relativePath);
      report.summary.backupsCreated += 1;
      report.summary.collisionsResolved += 1;
      report.details.backups.push({ path: relativePath, backupPath });
      report.details.collisionsResolved.push({
        path: relativePath,
        kind: file.kind,
        backupPath,
        currentHash,
        newHash,
      });

      fs.writeFileSync(absolutePath, file.content, "utf8");
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    fs.writeFileSync(absolutePath, file.content, "utf8");
    report.summary.updated += 1;
    report.details.updated.push({
      path: relativePath,
      kind: file.kind,
      currentHash,
      newHash,
    });
    filesIndex[relativePath] = {
      sha256: newHash,
      modelKey: file.modelKey,
      versionNumber: file.versionNumber,
      kind: file.kind,
      updatedAt: new Date().toISOString(),
    };
  }

  if (removeMissing) {
    for (const relativePath of Object.keys(existingManagedEntries)) {
      if (targetPaths.has(relativePath)) {
        continue;
      }

      const absolutePath = resolveSafeAbsolutePath(rootDir, relativePath);
      const previousManaged = existingManagedEntries[relativePath];
      if (fs.existsSync(absolutePath)) {
        const currentHash = readFileHash(absolutePath);
        const manuallyChangedManaged = Boolean(previousManaged?.sha256) && previousManaged.sha256 !== currentHash;
        if (manuallyChangedManaged) {
          const backupPath = backupProjectFile(rootDir, deploymentId, relativePath);
          report.summary.backupsCreated += 1;
          report.summary.conflictsResolved += 1;
          report.details.backups.push({ path: relativePath, backupPath });
          report.details.conflictsResolved.push({
            path: relativePath,
            kind: previousManaged?.kind || "managed-generated-file",
            backupPath,
            previousManagedHash: previousManaged.sha256,
            currentHash,
            newHash: null,
            reason: "Removal of stale managed file",
          });
        }

        fs.rmSync(absolutePath, { force: true });
      }

      delete filesIndex[relativePath];
      report.summary.removed += 1;
      report.details.removed.push({
        path: relativePath,
        kind: previousManaged?.kind || "managed-generated-file",
      });
    }
  }

  writeManagedFileIndex(rootDir, managedIndex);
  return report;
}

function deployProcessModelVersion({ rootDir, workspaceConfig, modelKey, versionNumber }) {
  const normalizedModelKey = normalizeModelKey(modelKey);
  const normalizedVersion = normalizeVersionNumber(versionNumber);
  const allowDirectDeployment = Boolean(workspaceConfig?.backendOptions?.processModeling?.allowDirectDeployment);

  const model = loadProcessModel(rootDir, normalizedModelKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedModelKey}' was not found.`);
  }

  const versionIndex = model.versions.findIndex((entry) => entry.versionNumber === normalizedVersion);
  if (versionIndex < 0) {
    throw createCatalogError(
      404,
      `Version ${normalizedVersion} was not found for model '${normalizedModelKey}'.`,
    );
  }

  const targetVersion = model.versions[versionIndex];
  if (targetVersion.status === "RETIRED") {
    throw createCatalogError(
      409,
      `Version ${normalizedVersion} is retired and cannot be deployed.`,
    );
  }

  if (targetVersion.status !== "VALIDATED" && targetVersion.status !== "DEPLOYED" && !allowDirectDeployment) {
    throw createCatalogError(
      409,
      "Only VALIDATED versions can be deployed when direct deployment is disabled.",
    );
  }

  const now = new Date().toISOString();
  for (let index = 0; index < model.versions.length; index += 1) {
    const currentVersion = model.versions[index];
    if (currentVersion.status === "DEPLOYED" && currentVersion.versionNumber !== normalizedVersion) {
      model.versions[index] = {
        ...currentVersion,
        status: "RETIRED",
        retiredAt: now,
        updatedAt: now,
      };
    }
  }

  model.versions[versionIndex] = {
    ...targetVersion,
    status: "DEPLOYED",
    deployedAt: now,
    retiredAt: null,
    updatedAt: now,
  };
  model.updatedAt = now;

  const savedModel = saveProcessModel(rootDir, model);
  const savedVersion = savedModel.versions.find((entry) => entry.versionNumber === normalizedVersion);

  const deployedRecords = listDeployedModels(rootDir)
    .map((entry) => ({ model: entry.model, version: entry.version }))
    .sort((left, right) => left.model.modelKey.localeCompare(right.model.modelKey));
  const deploymentPlan = buildManagedDeploymentPlan({
    workspaceConfig,
    deployedRecords,
  });
  const deploymentBuild = deploymentPlan.buildByRecord.get(
    buildDeploymentRecordKey(savedModel.modelKey, savedVersion.versionNumber),
  ) || {
    runtimeContract: buildRuntimeContract({ model: savedModel, version: savedVersion }),
    dataContract: buildDataContract({
      model: savedModel,
      version: savedVersion,
      runtimeContract: buildRuntimeContract({ model: savedModel, version: savedVersion }),
    }),
  };
  const generatedFiles = deploymentPlan.files;

  const deploymentId = toDeploymentId();
  const report = applyManagedDeploymentWrite(rootDir, generatedFiles, deploymentId, {
    removeMissing: true,
  });

  const refreshedModel = loadProcessModel(rootDir, normalizedModelKey);
  const refreshedVersionIndex = refreshedModel.versions.findIndex(
    (entry) => entry.versionNumber === normalizedVersion,
  );
  refreshedModel.versions[refreshedVersionIndex] = {
    ...refreshedModel.versions[refreshedVersionIndex],
    deployment: {
      deploymentId,
      generatedAt: now,
      generatedFiles: generatedFiles.map((entry) => entry.relativePath),
      reportSummary: report.summary,
      runtimeSummary: deploymentBuild.runtimeContract.summary,
      dataSummary: deploymentBuild.dataContract.summary,
      startableByRoles: deploymentBuild.runtimeContract.start.startableByRoles,
      monitorRoles: deploymentBuild.runtimeContract.monitors.monitorRoles,
      sharedDataEntities: (deploymentBuild.dataContract.sharedData?.entities || []).map((entry) => entry.entityKey),
    },
  };
  refreshedModel.updatedAt = new Date().toISOString();

  const finalModel = saveProcessModel(rootDir, refreshedModel);
  const finalVersion = finalModel.versions.find((entry) => entry.versionNumber === normalizedVersion);

  return {
    model: toPublicModel(finalModel),
    version: toPublicVersion(finalVersion, { includeBpmn: true }),
    deployment: {
      deploymentId,
      generatedFiles: generatedFiles.map((entry) => entry.relativePath),
      runtimeSummary: deploymentBuild.runtimeContract.summary,
      dataSummary: deploymentBuild.dataContract.summary,
      startableByRoles: deploymentBuild.runtimeContract.start.startableByRoles,
      monitorRoles: deploymentBuild.runtimeContract.monitors.monitorRoles,
      sharedDataEntities: (deploymentBuild.dataContract.sharedData?.entities || []).map((entry) => entry.entityKey),
      report,
    },
  };
}

function undeployProcessModelVersion({ rootDir, workspaceConfig, modelKey, versionNumber }) {
  const normalizedModelKey = normalizeModelKey(modelKey);
  const normalizedVersion = normalizeVersionNumber(versionNumber);

  const model = loadProcessModel(rootDir, normalizedModelKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedModelKey}' was not found.`);
  }

  const versionIndex = model.versions.findIndex((entry) => entry.versionNumber === normalizedVersion);
  if (versionIndex < 0) {
    throw createCatalogError(
      404,
      `Version ${normalizedVersion} was not found for model '${normalizedModelKey}'.`,
    );
  }

  const targetVersion = model.versions[versionIndex];
  if (targetVersion.status !== "DEPLOYED") {
    throw createCatalogError(
      409,
      `Version ${normalizedVersion} is not deployed and cannot be undeployed.`,
    );
  }

  const now = new Date().toISOString();
  model.versions[versionIndex] = {
    ...targetVersion,
    status: "RETIRED",
    retiredAt: now,
    updatedAt: now,
    deployment: null,
  };
  model.updatedAt = now;
  const savedModel = saveProcessModel(rootDir, model);

  const deployedRecords = listDeployedModels(rootDir)
    .map((entry) => ({ model: entry.model, version: entry.version }))
    .sort((left, right) => left.model.modelKey.localeCompare(right.model.modelKey));
  const deploymentPlan = buildManagedDeploymentPlan({
    workspaceConfig,
    deployedRecords,
  });
  const generatedFiles = deploymentPlan.files;

  const deploymentId = `process-undeploy-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const report = applyManagedDeploymentWrite(rootDir, generatedFiles, deploymentId, {
    removeMissing: true,
  });

  const refreshedModel = loadProcessModel(rootDir, normalizedModelKey);
  const refreshedVersion = refreshedModel.versions.find((entry) => entry.versionNumber === normalizedVersion);

  return {
    model: toPublicModel(refreshedModel),
    version: toPublicVersion(refreshedVersion, { includeBpmn: true }),
    undeployment: {
      deploymentId,
      generatedFiles: generatedFiles.map((entry) => entry.relativePath),
      report,
    },
  };
}

module.exports = {
  deployProcessModelVersion,
  undeployProcessModelVersion,
};
