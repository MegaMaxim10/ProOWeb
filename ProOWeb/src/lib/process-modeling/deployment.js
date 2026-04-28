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
        dataViewerRoles: activity.visibility?.dataViewerRoles || [],
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

function buildFrontendProcessFormCatalogModule(runtimeEntries) {
  const rows = [];

  for (const { entry, runtimeContract } of runtimeEntries) {
    for (const activity of runtimeContract.activities || []) {
      if (activity.activityType !== "MANUAL") {
        continue;
      }

      const inputFields = [];
      for (const source of activity.input?.sources || []) {
        for (const mapping of source.mappings || []) {
          const targetPath = String(mapping.to || "").trim();
          if (!targetPath) {
            continue;
          }

          inputFields.push({
            sourceType: source.sourceType || "PROCESS_CONTEXT",
            sourceRef: source.sourceRef || "",
            sourcePath: mapping.from || "",
            targetPath,
            label: targetPath,
          });
        }
      }

      const outputFields = (activity.output?.mappings || []).map((mapping) => ({
        sourcePath: mapping.from || "",
        targetPath: mapping.to || "",
      }));

      rows.push({
        modelKey: entry.modelKey,
        versionNumber: entry.versionNumber,
        activityId: activity.activityId,
        activityType: activity.activityType,
        candidateRoles: activity.candidateRoles || [],
        activityViewerRoles: activity.visibility?.activityViewerRoles || [],
        dataViewerRoles: activity.visibility?.dataViewerRoles || [],
        outputStorage: activity.output?.storage || "INSTANCE",
        inputFields,
        outputFields,
      });
    }
  }

  return `export const generatedProcessFormCatalog = Object.freeze(${JSON.stringify(rows, null, 2)});

export function listProcessFormDefinitions(modelKey, versionNumber) {
  const normalizedModelKey = String(modelKey || "").trim();
  const normalizedVersion = Number.parseInt(String(versionNumber || ""), 10);
  return generatedProcessFormCatalog.filter(
    (entry) => entry.modelKey === normalizedModelKey && entry.versionNumber === normalizedVersion,
  );
}

export function findProcessActivityFormDefinition(modelKey, versionNumber, activityId) {
  const normalizedActivityId = String(activityId || "").trim();
  return listProcessFormDefinitions(modelKey, versionNumber).find(
    (entry) => entry.activityId === normalizedActivityId,
  ) || null;
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
      const inputSourceRows = (activity.input?.sources || []).map((source) => {
        const sourceMappingRows = (source.mappings || []).map((mapping) =>
          `            new FieldMappingDescriptor(${toJavaString(mapping.from || "")}, ${toJavaString(mapping.to || "")})`);
        const sourceMappingsLiteral = sourceMappingRows.length > 0
          ? `List.of(\n${sourceMappingRows.join(",\n")}\n          )`
          : "List.of()";

        return `          new InputSourceDescriptor(${toJavaString(source.sourceType || "PROCESS_CONTEXT")}, ${toJavaString(
          source.sourceRef || "",
        )}, ${sourceMappingsLiteral})`;
      });
      const inputSourcesLiteral = inputSourceRows.length > 0
        ? `List.of(\n${inputSourceRows.join(",\n")}\n        )`
        : "List.of()";
      const outputMappingRows = (activity.output?.mappings || []).map((mapping) =>
        `          new FieldMappingDescriptor(${toJavaString(mapping.from || "")}, ${toJavaString(mapping.to || "")})`);
      const outputMappingsLiteral = outputMappingRows.length > 0
        ? `List.of(\n${outputMappingRows.join(",\n")}\n        )`
        : "List.of()";

      return `        new ActivityDescriptor(${toJavaString(activity.activityId)}, ${toJavaString(activity.activityType)}, ${toJavaList(
        activity.candidateRoles || [],
      )}, ${toJavaString(activity.assignment?.mode || "AUTOMATIC")}, ${toJavaString(
        activity.assignment?.strategy || "ROLE_QUEUE",
      )}, ${Boolean(activity.assignment?.allowPreviouslyAssignedAssignee)}, ${toJavaList(
        activity.assignment?.manualAssignerRoles || [],
      )}, ${Number.isFinite(Number(activity.assignment?.maxAssignees))
        ? Number(activity.assignment.maxAssignees)
        : 1}, ${toJavaString(automaticHandlerRef)}, ${toJavaList(activity.visibility?.activityViewerRoles || [])}, ${toJavaList(
        activity.visibility?.dataViewerRoles || [],
      )}, ${inputSourcesLiteral}, ${toJavaString(activity.output?.storage || "INSTANCE")}, ${outputMappingsLiteral})`;
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

  public record FieldMappingDescriptor(
      String from,
      String to) {
  }

  public record InputSourceDescriptor(
      String sourceType,
      String sourceRef,
      List<FieldMappingDescriptor> mappings) {
  }

  public record ActivityDescriptor(
      String activityId,
      String activityType,
      List<String> candidateRoles,
      String assignmentMode,
      String assignmentStrategy,
      boolean allowPreviouslyAssignedAssignee,
      List<String> manualAssignerRoles,
      int maxAssignees,
      String automaticHandlerRef,
      List<String> activityViewerRoles,
      List<String> dataViewerRoles,
      List<InputSourceDescriptor> inputSources,
      String outputStorage,
      List<FieldMappingDescriptor> outputMappings) {
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
  private String assignee;
  private String assignedBy;
  private Instant assignedAt;
  private ProcessRuntimeTaskState state;
  private final Map<String, Object> inputData;
  private final Map<String, Object> outputData;
  private final Instant createdAt;
  private Instant completedAt;

  public ProcessRuntimeTask(String taskId, String activityId, String assignee, Map<String, Object> inputData) {
    this.taskId = taskId;
    this.activityId = activityId;
    this.assignee = assignee;
    this.assignedBy = assignee == null || assignee.isBlank() ? null : "SYSTEM";
    this.assignedAt = assignee == null || assignee.isBlank() ? null : Instant.now();
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

  public String assignedBy() {
    return assignedBy;
  }

  public Instant assignedAt() {
    return assignedAt;
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

  public boolean isAssigned() {
    return assignee != null && !assignee.isBlank();
  }

  public void assign(String assignee, String actor) {
    this.assignee = assignee == null || assignee.isBlank() ? null : assignee;
    this.assignedBy = actor == null || actor.isBlank() ? "SYSTEM" : actor;
    this.assignedAt = this.assignee == null ? null : Instant.now();
  }

  public void unassign(String actor) {
    this.assignee = null;
    this.assignedBy = actor == null || actor.isBlank() ? "SYSTEM" : actor;
    this.assignedAt = null;
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
  private final Map<String, Map<String, Object>> activityOutputs;

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
    this.activityOutputs = new HashMap<>();
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

  public void recordActivityOutput(String activityId, Map<String, Object> output) {
    activityOutputs.put(activityId, new HashMap<>(output == null ? Map.of() : output));
    this.updatedAt = Instant.now();
  }

  public Map<String, Object> readActivityOutput(String activityId) {
    return Map.copyOf(activityOutputs.getOrDefault(activityId, Map.of()));
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
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ProcessRuntimeStorePort {
  List<ProcessRuntimeInstance> listInstances();

  Optional<ProcessRuntimeInstance> findById(String instanceId);

  void save(ProcessRuntimeInstance instance);

  Map<String, Object> readSharedData(String entityKey);

  void writeSharedData(String entityKey, Map<String, Object> values);

  List<RuntimeUserDescriptor> listUsers();

  RuntimeOrganizationSnapshot readOrganizationSnapshot();

  void appendMonitorEvent(RuntimeMonitorEvent event);

  List<RuntimeMonitorEvent> listMonitorEvents();

  record RuntimeUserDescriptor(
      String userId,
      List<String> roleCodes,
      String unitId,
      String supervisorId) {
  }

  record RuntimeOrganizationUnitDescriptor(
      String unitId,
      String parentUnitId,
      String managerUserId,
      List<String> memberUserIds) {
  }

  record RuntimeOrganizationSnapshot(
      List<RuntimeOrganizationUnitDescriptor> units) {
  }

  record RuntimeMonitorEvent(
      String eventId,
      Instant occurredAt,
      String actionType,
      String actor,
      List<String> actorRoleCodes,
      String targetType,
      String targetId,
      String details,
      boolean forced) {
  }
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

  RuntimeTaskView assignTask(AssignTaskCommand command);

  RuntimeTaskView completeTask(CompleteTaskCommand command);

  RuntimeInstanceView readInstance(ReadInstanceQuery query);

  RuntimeInstanceView stopInstance(StopCommand command);

  RuntimeInstanceView archiveInstance(ArchiveCommand command);

  List<MonitorEventView> listMonitorEvents(MonitorEventsQuery query);

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

  record TaskQuery(String actor, List<String> roleCodes) {
  }

  record InstanceQuery(String actor, List<String> roleCodes) {
  }

  record ReadInstanceQuery(String instanceId, String actor, List<String> roleCodes) {
  }

  record MonitorEventsQuery(
      String actor,
      List<String> roleCodes,
      String instanceId,
      String actionType,
      int limit) {
  }

  record CompleteTaskCommand(String instanceId, String taskId, String actor, List<String> roleCodes, Map<String, Object> payload) {
  }

  record AssignTaskCommand(
      String instanceId,
      String taskId,
      String actor,
      List<String> roleCodes,
      String assignee,
      boolean force) {
  }

  record StopCommand(String instanceId, String actor, List<String> roleCodes, String reason) {
  }

  record ArchiveCommand(String instanceId, String actor, List<String> roleCodes) {
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
      String assignmentStatus,
      String assignmentMode,
      String assignmentStrategy,
      List<String> candidateRoles,
      List<String> manualAssignerRoles,
      String status,
      Instant createdAt,
      Instant assignedAt,
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

  record MonitorEventView(
      String eventId,
      Instant occurredAt,
      String actionType,
      String actor,
      List<String> actorRoleCodes,
      String targetType,
      String targetId,
      String details,
      boolean forced) {
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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
    return toInstanceView(instance, descriptor, actorRoles);
  }

  @Override
  public List<RuntimeInstanceView> listInstances(InstanceQuery query) {
    String actor = query.actor();
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(roles);

    return processRuntimeStorePort.listInstances().stream()
      .filter((instance) -> {
        if (monitorPrivileges) {
          return true;
        }
        if (actor == null || actor.isBlank()) {
          return false;
        }
        GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
          .find(instance.modelKey(), instance.versionNumber())
          .orElse(null);
        return canActorSeeInstance(instance, descriptor, actor, roles);
      })
      .map((instance) -> {
        GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
          .find(instance.modelKey(), instance.versionNumber())
          .orElse(null);
        return toInstanceView(instance, descriptor, roles);
      })
      .toList();
  }

  @Override
  public List<RuntimeTaskView> listTasks(TaskQuery query) {
    String actor = query.actor();
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(roles);
    return processRuntimeStorePort.listInstances().stream()
      .flatMap((instance) -> {
        GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
          .find(instance.modelKey(), instance.versionNumber())
          .orElse(null);
        return instance.tasks().stream()
          .filter((task) -> task.state() == ProcessRuntimeTaskState.PENDING)
          .filter((task) -> {
            GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = descriptor == null
              ? null
              : findActivity(descriptor, task.activityId()).orElse(null);

            if (monitorPrivileges) {
              if (actor == null || actor.isBlank()) {
                return true;
              }
              return Objects.equals(task.assignee(), actor) || canActorAssignTask(activityDescriptor, roles);
            }

            if (actor == null || actor.isBlank()) {
              return false;
            }

            if (Objects.equals(task.assignee(), actor)) {
              return true;
            }

            if (!task.isAssigned() && canActorAssignTask(activityDescriptor, roles)) {
              return true;
            }

            return false;
          })
          .map((task) -> {
            GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = descriptor == null
              ? null
              : findActivity(descriptor, task.activityId()).orElse(null);
            return toTaskView(instance.instanceId(), task, activityDescriptor, roles);
          });
      })
      .toList();
  }

  @Override
  public RuntimeTaskView assignTask(AssignTaskCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      throw new IllegalStateException("Instance is not running");
    }

    ProcessRuntimeTask task = instance.findTask(command.taskId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown task"));
    if (task.state() != ProcessRuntimeTaskState.PENDING) {
      throw new IllegalStateException("Task is not assignable because it is no longer pending.");
    }

    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Missing deployed descriptor for instance"));
    GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = findActivity(descriptor, task.activityId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown activity in deployed descriptor"));

    String assignee = normalizeActor(command.assignee());
    if (assignee == null) {
      throw new IllegalArgumentException("assignee is required.");
    }

    String actor = normalizeActor(command.actor());
    List<String> actorRoles = command.roleCodes() == null ? List.of() : command.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(actorRoles);
    if (!monitorPrivileges && actor == null) {
      throw new IllegalStateException("actor is required to assign task.");
    }
    if (!monitorPrivileges && !canActorAssignTask(activityDescriptor, actorRoles)) {
      throw new IllegalStateException("Actor is not allowed to assign this task.");
    }
    if (!monitorPrivileges && command.force()) {
      throw new IllegalStateException("Force assignment requires PROCESS_MONITOR or ADMINISTRATOR role.");
    }

    boolean forceMode = monitorPrivileges && command.force();

    AssignmentResolution resolution = resolveManualAssignment(
      instance,
      activityDescriptor,
      command.actor(),
      actorRoles,
      assignee,
      forceMode
    );
    if (resolution.assignee() == null) {
      throw new IllegalStateException("Unable to assign task: " + resolution.reason());
    }

    task.assign(resolution.assignee(), command.actor());
    instance.addTimelineEntry("TASK_ASSIGNED:" + task.activityId() + ":" + resolution.assignee() + ":" + resolution.reason());
    processRuntimeStorePort.save(instance);
    if (monitorPrivileges || forceMode) {
      appendMonitorEvent(
        "TASK_ASSIGN",
        command.actor(),
        actorRoles,
        "TASK",
        task.taskId(),
        "instanceId=" + instance.instanceId() + ",assignee=" + resolution.assignee() + ",reason=" + resolution.reason(),
        forceMode
      );
    }
    return toTaskView(instance.instanceId(), task, activityDescriptor, actorRoles);
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

    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Missing deployed descriptor for instance"));
    GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = findActivity(descriptor, task.activityId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown activity in deployed descriptor"));
    String actor = normalizeActor(command.actor());
    List<String> actorRoles = command.roleCodes() == null ? List.of() : command.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(actorRoles);
    if (!task.isAssigned()) {
      if (!monitorPrivileges && !canActorAssignTask(activityDescriptor, actorRoles)) {
        throw new IllegalStateException("Task is unassigned and actor cannot resolve assignment.");
      }

      AssignmentResolution autoResolution = resolveAssignment(instance, activityDescriptor, actor, actorRoles, false);
      if (autoResolution.assignee() == null) {
        throw new IllegalStateException("Task requires assignment before completion.");
      }
      task.assign(autoResolution.assignee(), actor);
      instance.addTimelineEntry("TASK_AUTO_ASSIGNED_FOR_COMPLETION:" + task.activityId() + ":" + autoResolution.assignee());
    }

    if (!monitorPrivileges && actor != null && !Objects.equals(task.assignee(), actor)) {
      throw new IllegalStateException("Actor cannot complete a task assigned to another user.");
    }

    Map<String, Object> payload = command.payload() == null ? Map.of() : command.payload();
    Map<String, Object> mappedOutput = applyOutputMappings(payload, activityDescriptor.outputMappings());

    task.complete(mappedOutput);
    instance.recordActivityOutput(task.activityId(), mappedOutput);
    applyOutputStorage(instance, activityDescriptor, mappedOutput);
    instance.addTimelineEntry("TASK_COMPLETED:" + task.activityId() + ":" + command.actor());

    createOrAdvanceTasks(instance, descriptor, task.activityId(), command.actor(), command.payload(), false);

    processRuntimeStorePort.save(instance);
    return toTaskView(instance.instanceId(), task, activityDescriptor, command.roleCodes());
  }

  @Override
  public RuntimeInstanceView readInstance(ReadInstanceQuery query) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(query.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(roles);
    if (!monitorPrivileges) {
      String actor = query.actor();
      if (actor == null || actor.isBlank()) {
        throw new IllegalStateException("actor is required to read this runtime instance.");
      }

      boolean actorCanAccess = Objects.equals(instance.startedBy(), actor)
        || instance.tasks().stream().anyMatch((task) -> Objects.equals(task.assignee(), actor))
        || canRoleConsultInstance(descriptor, roles);
      if (!actorCanAccess) {
        throw new IllegalStateException("Actor is not allowed to access this runtime instance.");
      }
    }

    return toInstanceView(instance, descriptor, roles);
  }

  @Override
  public RuntimeInstanceView stopInstance(StopCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    ensureMonitorPrivilege(command.actor(), roles, "stop runtime instances");
    instance.stop(command.actor(), command.reason());
    instance.addTimelineEntry("INSTANCE_STOPPED:" + command.actor() + ":" + command.reason());
    processRuntimeStorePort.save(instance);
    appendMonitorEvent(
      "INSTANCE_STOP",
      command.actor(),
      roles,
      "INSTANCE",
      instance.instanceId(),
      "reason=" + normalizeBlank(command.reason()),
      true
    );
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    return toInstanceView(instance, descriptor, roles);
  }

  @Override
  public RuntimeInstanceView archiveInstance(ArchiveCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    ensureMonitorPrivilege(command.actor(), roles, "archive runtime instances");
    instance.archive(command.actor());
    instance.addTimelineEntry("INSTANCE_ARCHIVED:" + command.actor());
    processRuntimeStorePort.save(instance);
    appendMonitorEvent(
      "INSTANCE_ARCHIVE",
      command.actor(),
      roles,
      "INSTANCE",
      instance.instanceId(),
      "archiveRequestedBy=" + normalizeBlank(command.actor()),
      true
    );
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    return toInstanceView(instance, descriptor, roles);
  }

  @Override
  public List<MonitorEventView> listMonitorEvents(MonitorEventsQuery query) {
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    ensureMonitorPrivilege(query.actor(), roles, "read runtime monitor events");
    int maxRows = query.limit() <= 0 ? 100 : Math.min(query.limit(), 500);
    String requestedInstanceId = normalizeBlank(query.instanceId());
    String requestedActionType = normalizeUpper(query.actionType(), "");
    return processRuntimeStorePort.listMonitorEvents().stream()
      .filter((event) -> requestedInstanceId.isBlank() || Objects.equals(event.targetId(), requestedInstanceId))
      .filter((event) -> requestedActionType.isBlank() || requestedActionType.equals(normalizeUpper(event.actionType(), "")))
      .sorted(Comparator.comparing(ProcessRuntimeStorePort.RuntimeMonitorEvent::occurredAt).reversed())
      .limit(maxRows)
      .map((event) -> new MonitorEventView(
        event.eventId(),
        event.occurredAt(),
        event.actionType(),
        event.actor(),
        event.actorRoleCodes(),
        event.targetType(),
        event.targetId(),
        event.details(),
        event.forced()
      ))
      .toList();
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
      Map<String, Object> automaticInput = resolveActivityInput(descriptorActivity, instance);
      Map<String, Object> automaticOutput = executeAutomaticActivity(descriptorActivity, automaticInput, instance);
      instance.recordActivityOutput(descriptorActivity.activityId(), automaticOutput);
      applyOutputStorage(instance, descriptorActivity, automaticOutput);
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

    String normalizedActor = normalizeActor(actor);
    List<String> actorRoles = resolveActorRoles(normalizedActor);
    AssignmentResolution assignmentResolution = resolveAssignment(
      instance,
      descriptorActivity,
      normalizedActor,
      actorRoles,
      false
    );
    String assignee = assignmentResolution.assignee();
    Map<String, Object> inputData = resolveActivityInput(descriptorActivity, instance);
    ProcessRuntimeTask task = new ProcessRuntimeTask(
      "tsk-" + UUID.randomUUID(),
      descriptorActivity.activityId(),
      assignee,
      inputData
    );
    instance.addTask(task);
    instance.addTimelineEntry(
      "TASK_CREATED:" + descriptorActivity.activityId()
      + ":" + (assignee == null ? "UNASSIGNED" : assignee)
      + ":" + assignmentResolution.reason()
    );
  }

  private AssignmentResolution resolveAssignment(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      List<String> actorRoles,
      boolean forceManualAssignment) {
    if (activityDescriptor == null) {
      return new AssignmentResolution(null, List.of(), "MISSING_ACTIVITY_DESCRIPTOR");
    }

    String mode = normalizeUpper(activityDescriptor.assignmentMode(), "AUTOMATIC");
    String strategy = normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE");
    if ("MANUAL".equals(mode) && !forceManualAssignment) {
      return new AssignmentResolution(null, List.of(), "MANUAL_ASSIGNMENT_REQUIRED");
    }
    if ("MANUAL_ONLY".equals(strategy) && !forceManualAssignment) {
      return new AssignmentResolution(null, List.of(), "MANUAL_ONLY_STRATEGY");
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> eligibleCandidates = resolveEligibleCandidates(
      instance,
      activityDescriptor,
      actor,
      actorRoles
    );
    if (eligibleCandidates.isEmpty()) {
      return new AssignmentResolution(null, List.of(), "NO_MATCHING_CANDIDATE");
    }

    List<String> candidateIds = eligibleCandidates.stream()
      .map(ProcessRuntimeStorePort.RuntimeUserDescriptor::userId)
      .toList();

    if ("SINGLE_MATCH_ONLY".equals(strategy)) {
      if (eligibleCandidates.size() == 1) {
        return new AssignmentResolution(eligibleCandidates.get(0).userId(), candidateIds, "SINGLE_MATCH");
      }
      return new AssignmentResolution(null, candidateIds, "MULTI_MATCH_REQUIRES_MANUAL_ASSIGNMENT");
    }

    ProcessRuntimeStorePort.RuntimeUserDescriptor selected = selectCandidateByStrategy(
      instance,
      activityDescriptor,
      strategy,
      actor,
      eligibleCandidates
    );
    if (selected == null) {
      return new AssignmentResolution(null, candidateIds, "NO_CANDIDATE_SELECTED");
    }

    return new AssignmentResolution(selected.userId(), candidateIds, "AUTO_ASSIGNED_" + strategy);
  }

  private AssignmentResolution resolveManualAssignment(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      List<String> actorRoles,
      String requestedAssignee,
      boolean force) {
    String normalizedRequested = normalizeActor(requestedAssignee);
    if (normalizedRequested == null) {
      return new AssignmentResolution(null, List.of(), "ASSIGNEE_REQUIRED");
    }

    if (force) {
      return new AssignmentResolution(normalizedRequested, List.of(normalizedRequested), "FORCED_ASSIGNMENT");
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> eligibleCandidates = resolveEligibleCandidates(
      instance,
      activityDescriptor,
      actor,
      actorRoles
    );
    List<String> candidateIds = eligibleCandidates.stream()
      .map(ProcessRuntimeStorePort.RuntimeUserDescriptor::userId)
      .toList();
    if (candidateIds.contains(normalizedRequested)) {
      return new AssignmentResolution(normalizedRequested, candidateIds, "MANUAL_ASSIGNMENT_VALIDATED");
    }

    return new AssignmentResolution(null, candidateIds, "ASSIGNEE_NOT_ELIGIBLE");
  }

  private List<ProcessRuntimeStorePort.RuntimeUserDescriptor> resolveEligibleCandidates(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      List<String> actorRoles) {
    List<String> requiredRoles = activityDescriptor.candidateRoles() == null ? List.of() : activityDescriptor.candidateRoles();
    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = new ArrayList<>(processRuntimeStorePort.listUsers());
    String normalizedActor = normalizeActor(actor);
    if (normalizedActor != null && users.stream().noneMatch((entry) -> Objects.equals(entry.userId(), normalizedActor))) {
      users.add(
        new ProcessRuntimeStorePort.RuntimeUserDescriptor(
          normalizedActor,
          actorRoles == null ? List.of() : actorRoles,
          null,
          null
        )
      );
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> roleFiltered = users.stream()
      .filter((user) -> requiredRoles.isEmpty() || hasRoleIntersection(user.roleCodes(), requiredRoles))
      .sorted(Comparator.comparing((user) -> normalizeActor(user.userId()), Comparator.nullsLast(String::compareTo)))
      .toList();
    if (roleFiltered.isEmpty()) {
      return List.of();
    }

    Set<String> blockedAssignees = new HashSet<>();
    if (!activityDescriptor.allowPreviouslyAssignedAssignee()) {
      for (ProcessRuntimeTask task : instance.tasks()) {
        if (task.assignee() != null && !task.assignee().isBlank()) {
          blockedAssignees.add(task.assignee());
        }
      }
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> previousRuleFiltered = roleFiltered.stream()
      .filter((entry) -> !blockedAssignees.contains(entry.userId()))
      .toList();
    if (previousRuleFiltered.isEmpty()) {
      return List.of();
    }

    String strategy = normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE");
    if ("SUPERVISOR_ONLY".equals(strategy) || "SUPERVISOR_THEN_ANCESTORS".equals(strategy)) {
      List<String> supervisorChain = resolveSupervisorChain(normalizedActor, previousRuleFiltered);
      if (supervisorChain.isEmpty()) {
        return previousRuleFiltered;
      }
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> supervisorCandidates = previousRuleFiltered.stream()
        .filter((entry) -> supervisorChain.contains(entry.userId()))
        .sorted(Comparator.comparingInt((entry) -> supervisorChain.indexOf(entry.userId())))
        .toList();
      if ("SUPERVISOR_ONLY".equals(strategy)) {
        if (supervisorCandidates.isEmpty()) {
          return List.of();
        }
        return List.of(supervisorCandidates.get(0));
      }
      if (!supervisorCandidates.isEmpty()) {
        return supervisorCandidates;
      }
    }

    if ("UNIT_MEMBERS".equals(strategy)) {
      String actorUnitId = resolveActorUnitId(normalizedActor, previousRuleFiltered);
      if (actorUnitId == null) {
        return previousRuleFiltered;
      }
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> unitMembers = previousRuleFiltered.stream()
        .filter((entry) -> Objects.equals(actorUnitId, normalizeActor(entry.unitId())))
        .toList();
      if (!unitMembers.isEmpty()) {
        return unitMembers;
      }
    }

    return previousRuleFiltered;
  }

  private ProcessRuntimeStorePort.RuntimeUserDescriptor selectCandidateByStrategy(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String strategy,
      String actor,
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> candidates) {
    if (candidates == null || candidates.isEmpty()) {
      return null;
    }

    if ("ROUND_ROBIN".equals(strategy)) {
      int currentIndex = readRoundRobinIndex(instance, activityDescriptor.activityId());
      int selectedIndex = Math.floorMod(currentIndex, candidates.size());
      writeRoundRobinIndex(instance, activityDescriptor.activityId(), currentIndex + 1);
      return candidates.get(selectedIndex);
    }

    if ("SUPERVISOR_ONLY".equals(strategy) || "SUPERVISOR_THEN_ANCESTORS".equals(strategy)) {
      return candidates.get(0);
    }

    if ("UNIT_MEMBERS".equals(strategy)) {
      String normalizedActor = normalizeActor(actor);
      ProcessRuntimeStorePort.RuntimeUserDescriptor actorCandidate = candidates.stream()
        .filter((entry) -> Objects.equals(normalizedActor, entry.userId()))
        .findFirst()
        .orElse(null);
      if (actorCandidate != null) {
        return actorCandidate;
      }
      return candidates.get(0);
    }

    if ("ROLE_QUEUE".equals(strategy)) {
      return candidates.get(0);
    }

    return candidates.get(0);
  }

  private List<String> resolveSupervisorChain(
      String actor,
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users) {
    if (actor == null || actor.isBlank() || users == null || users.isEmpty()) {
      return List.of();
    }

    Map<String, ProcessRuntimeStorePort.RuntimeUserDescriptor> byUserId = users.stream()
      .collect(Collectors.toMap(
        (entry) -> normalizeActor(entry.userId()),
        (entry) -> entry,
        (left, right) -> left
      ));
    ProcessRuntimeStorePort.RuntimeUserDescriptor actorDescriptor = byUserId.get(actor);
    if (actorDescriptor == null) {
      return List.of();
    }

    List<String> chain = new ArrayList<>();
    Set<String> visited = new HashSet<>();
    String supervisorId = normalizeActor(actorDescriptor.supervisorId());
    while (supervisorId != null && !visited.contains(supervisorId)) {
      visited.add(supervisorId);
      chain.add(supervisorId);
      ProcessRuntimeStorePort.RuntimeUserDescriptor supervisor = byUserId.get(supervisorId);
      if (supervisor == null) {
        break;
      }
      supervisorId = normalizeActor(supervisor.supervisorId());
    }

    if (!chain.isEmpty()) {
      return chain;
    }

    String actorUnitId = normalizeActor(actorDescriptor.unitId());
    if (actorUnitId == null) {
      return List.of();
    }
    ProcessRuntimeStorePort.RuntimeOrganizationSnapshot snapshot = processRuntimeStorePort.readOrganizationSnapshot();
    if (snapshot == null || snapshot.units() == null) {
      return List.of();
    }
    Map<String, ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor> byUnitId = snapshot.units().stream()
      .collect(Collectors.toMap(
        (entry) -> normalizeActor(entry.unitId()),
        (entry) -> entry,
        (left, right) -> left
      ));
    Set<String> visitedUnits = new HashSet<>();
    String cursorUnitId = actorUnitId;
    while (cursorUnitId != null && !visitedUnits.contains(cursorUnitId)) {
      visitedUnits.add(cursorUnitId);
      ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor unit = byUnitId.get(cursorUnitId);
      if (unit == null) {
        break;
      }
      String managerUserId = normalizeActor(unit.managerUserId());
      if (managerUserId != null) {
        chain.add(managerUserId);
      }
      cursorUnitId = normalizeActor(unit.parentUnitId());
    }

    return chain;
  }

  private String resolveActorUnitId(
      String actor,
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users) {
    if (actor == null || actor.isBlank() || users == null) {
      return null;
    }
    return users.stream()
      .filter((entry) -> Objects.equals(actor, normalizeActor(entry.userId())))
      .map((entry) -> normalizeActor(entry.unitId()))
      .filter(Objects::nonNull)
      .findFirst()
      .orElse(null);
  }

  private int readRoundRobinIndex(ProcessRuntimeInstance instance, String activityId) {
    Object value = instance.contextData().get("__assignment_rr__" + activityId);
    if (value instanceof Number) {
      return ((Number) value).intValue();
    }
    if (value != null) {
      try {
        return Integer.parseInt(String.valueOf(value));
      } catch (NumberFormatException ignored) {
        return 0;
      }
    }
    return 0;
  }

  private void writeRoundRobinIndex(ProcessRuntimeInstance instance, String activityId, int nextIndex) {
    Map<String, Object> update = new HashMap<>();
    update.put("__assignment_rr__" + activityId, Integer.valueOf(nextIndex));
    instance.putContextData(update);
  }

  private String normalizeActor(String value) {
    String normalized = value == null ? "" : value.trim();
    return normalized.isBlank() ? null : normalized;
  }

  private String normalizeUpper(String value, String fallback) {
    String normalized = value == null ? "" : value.trim().toUpperCase();
    return normalized.isBlank() ? fallback : normalized;
  }

  private String normalizeBlank(String value) {
    String normalized = value == null ? "" : value.trim();
    return normalized;
  }

  private boolean hasMonitorPrivileges(List<String> actorRoles) {
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    return roles.stream().anyMatch((role) ->
      "PROCESS_MONITOR".equals(role) || "ADMINISTRATOR".equals(role)
    );
  }

  private void ensureMonitorPrivilege(String actor, List<String> actorRoles, String actionLabel) {
    if (!hasMonitorPrivileges(actorRoles)) {
      throw new IllegalStateException("Actor is not allowed to " + actionLabel + ".");
    }
    if (normalizeActor(actor) == null) {
      throw new IllegalStateException("actor is required to " + actionLabel + ".");
    }
  }

  private void appendMonitorEvent(
      String actionType,
      String actor,
      List<String> actorRoles,
      String targetType,
      String targetId,
      String details,
      boolean forced) {
    processRuntimeStorePort.appendMonitorEvent(
      new ProcessRuntimeStorePort.RuntimeMonitorEvent(
        "evt-" + UUID.randomUUID(),
        Instant.now(),
        normalizeUpper(actionType, "UNKNOWN"),
        normalizeBlank(actor),
        actorRoles == null ? List.of() : List.copyOf(actorRoles),
        normalizeUpper(targetType, "UNKNOWN"),
        normalizeBlank(targetId),
        normalizeBlank(details),
        forced
      )
    );
  }

  private boolean hasRoleIntersection(List<String> sourceRoles, List<String> requiredRoles) {
    if (requiredRoles == null || requiredRoles.isEmpty()) {
      return true;
    }
    List<String> source = sourceRoles == null ? List.of() : sourceRoles;
    return requiredRoles.stream().anyMatch(source::contains);
  }

  private List<String> resolveActorRoles(String actor) {
    if (actor == null || actor.isBlank()) {
      return List.of();
    }
    return processRuntimeStorePort.listUsers().stream()
      .filter((entry) -> Objects.equals(actor, normalizeActor(entry.userId())))
      .map(ProcessRuntimeStorePort.RuntimeUserDescriptor::roleCodes)
      .filter(Objects::nonNull)
      .findFirst()
      .orElse(List.of());
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

  private Map<String, Object> resolveActivityInput(
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      ProcessRuntimeInstance instance) {
    Map<String, Object> input = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.InputSourceDescriptor source : activityDescriptor.inputSources()) {
      Map<String, Object> sourceData = resolveInputSourceData(source, instance);
      if (source.mappings() == null || source.mappings().isEmpty()) {
        String fallbackKey = source.sourceRef() == null || source.sourceRef().isBlank()
          ? String.valueOf(source.sourceType()).toLowerCase()
          : source.sourceRef();
        input.put(fallbackKey, sourceData);
        continue;
      }

      for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : source.mappings()) {
        Object value = readPathValue(sourceData, mapping.from());
        if (value != null) {
          writePathValue(input, mapping.to(), value);
        }
      }
    }

    return input;
  }

  private Map<String, Object> resolveInputSourceData(
      GeneratedProcessRuntimeCatalog.InputSourceDescriptor source,
      ProcessRuntimeInstance instance) {
    String sourceType = source.sourceType() == null ? "PROCESS_CONTEXT" : source.sourceType().toUpperCase();
    if ("PROCESS_CONTEXT".equals(sourceType)) {
      return instance.contextData();
    }
    if ("PREVIOUS_ACTIVITY".equals(sourceType)) {
      return instance.readActivityOutput(source.sourceRef());
    }
    if ("SHARED_DATA".equals(sourceType)) {
      return processRuntimeStorePort.readSharedData(inferSharedEntityKey(source.sourceRef()));
    }
    if ("BACKEND_SERVICE".equals(sourceType) || "EXTERNAL_SERVICE".equals(sourceType)) {
      return loadServiceSourceData(sourceType, source.sourceRef(), instance);
    }

    return Map.of();
  }

  private Map<String, Object> loadServiceSourceData(String sourceType, String sourceRef, ProcessRuntimeInstance instance) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("status", "NOT_IMPLEMENTED");
    payload.put("sourceType", sourceType);
    payload.put("sourceRef", sourceRef == null ? "" : sourceRef);
    payload.put("instanceId", instance.instanceId());
    return payload;
  }

  private Map<String, Object> executeAutomaticActivity(
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      Map<String, Object> inputData,
      ProcessRuntimeInstance instance) {
    Map<String, Object> output = new HashMap<>();
    output.put("status", "AUTOMATIC_EXECUTED_STUB");
    output.put("activityId", activityDescriptor.activityId());
    output.put("handlerRef", activityDescriptor.automaticHandlerRef());
    output.put("instanceId", instance.instanceId());
    if (inputData != null && !inputData.isEmpty()) {
      output.put("inputEcho", inputData);
    }
    return output;
  }

  private Map<String, Object> applyOutputMappings(
      Map<String, Object> payload,
      List<GeneratedProcessRuntimeCatalog.FieldMappingDescriptor> mappings) {
    if (payload == null || payload.isEmpty()) {
      return Map.of();
    }

    if (mappings == null || mappings.isEmpty()) {
      return new HashMap<>(payload);
    }

    Map<String, Object> mapped = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : mappings) {
      Object value = readPathValue(payload, mapping.from());
      if (value != null) {
        writePathValue(mapped, mapping.to(), value);
      }
    }
    return mapped;
  }

  private void applyOutputStorage(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      Map<String, Object> outputPayload) {
    String storage = activityDescriptor.outputStorage() == null
      ? "INSTANCE"
      : activityDescriptor.outputStorage().toUpperCase();

    if ("INSTANCE".equals(storage) || "BOTH".equals(storage)) {
      Map<String, Object> instanceProjection = projectOutputForInstance(outputPayload, activityDescriptor.outputMappings());
      if (!instanceProjection.isEmpty()) {
        instance.putContextData(instanceProjection);
      }
    }

    if ("SHARED".equals(storage) || "BOTH".equals(storage)) {
      Map<String, Map<String, Object>> sharedProjection = projectOutputForShared(outputPayload, activityDescriptor.outputMappings());
      for (Map.Entry<String, Map<String, Object>> entry : sharedProjection.entrySet()) {
        processRuntimeStorePort.writeSharedData(entry.getKey(), entry.getValue());
      }
    }
  }

  private Map<String, Object> projectOutputForInstance(
      Map<String, Object> outputPayload,
      List<GeneratedProcessRuntimeCatalog.FieldMappingDescriptor> mappings) {
    if (outputPayload == null || outputPayload.isEmpty()) {
      return Map.of();
    }

    if (mappings == null || mappings.isEmpty()) {
      return new HashMap<>(outputPayload);
    }

    Map<String, Object> projection = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : mappings) {
      if (resolveSharedTarget(mapping.to()) != null) {
        continue;
      }
      Object value = readPathValue(outputPayload, mapping.to());
      if (value != null) {
        writePathValue(projection, mapping.to(), value);
      }
    }
    return projection;
  }

  private Map<String, Map<String, Object>> projectOutputForShared(
      Map<String, Object> outputPayload,
      List<GeneratedProcessRuntimeCatalog.FieldMappingDescriptor> mappings) {
    Map<String, Map<String, Object>> projection = new HashMap<>();
    if (outputPayload == null || outputPayload.isEmpty() || mappings == null || mappings.isEmpty()) {
      return projection;
    }

    for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : mappings) {
      Object value = readPathValue(outputPayload, mapping.to());
      if (value == null) {
        continue;
      }
      SharedTarget sharedTarget = resolveSharedTarget(mapping.to());
      if (sharedTarget == null) {
        continue;
      }

      Map<String, Object> entityValues = projection.computeIfAbsent(sharedTarget.entityKey, (ignored) -> new HashMap<>());
      writePathValue(entityValues, sharedTarget.fieldPath, value);
    }

    return projection;
  }

  private SharedTarget resolveSharedTarget(String targetPath) {
    String normalized = normalizePath(targetPath);
    String lowered = normalized.toLowerCase();
    if (lowered.startsWith("shared.")) {
      normalized = normalized.substring("shared.".length());
    } else if (lowered.startsWith("shared_data.")) {
      normalized = normalized.substring("shared_data.".length());
    } else if (lowered.startsWith("shareddata.")) {
      normalized = normalized.substring("shareddata.".length());
    } else {
      return null;
    }

    if (normalized.isBlank()) {
      return null;
    }

    int separatorIndex = normalized.indexOf('.');
    String entityKey = separatorIndex < 0 ? normalized : normalized.substring(0, separatorIndex);
    String fieldPath = separatorIndex < 0 ? "value" : normalized.substring(separatorIndex + 1);

    if (entityKey.isBlank()) {
      return null;
    }
    if (fieldPath.isBlank()) {
      fieldPath = "value";
    }

    return new SharedTarget(entityKey, fieldPath);
  }

  private String inferSharedEntityKey(String sourceRef) {
    SharedTarget target = resolveSharedTarget(sourceRef);
    if (target != null) {
      return target.entityKey;
    }
    String normalized = normalizePath(sourceRef);
    int separatorIndex = normalized.indexOf('.');
    return separatorIndex < 0 ? normalized : normalized.substring(0, separatorIndex);
  }

  private Object readPathValue(Map<String, Object> source, String path) {
    if (source == null) {
      return null;
    }
    String normalized = normalizePath(path);
    if (normalized.isBlank()) {
      return null;
    }

    Object cursor = source;
    String[] segments = normalized.split("\\\\.");
    for (String segment : segments) {
      if (!(cursor instanceof Map)) {
        return null;
      }
      Map<?, ?> map = (Map<?, ?>) cursor;
      cursor = map.get(segment);
      if (cursor == null) {
        return null;
      }
    }

    return cursor;
  }

  @SuppressWarnings("unchecked")
  private void writePathValue(Map<String, Object> target, String path, Object value) {
    String normalized = normalizePath(path);
    if (normalized.isBlank()) {
      return;
    }

    String[] segments = normalized.split("\\\\.");
    Map<String, Object> cursor = target;
    for (int index = 0; index < segments.length - 1; index += 1) {
      String segment = segments[index];
      Object next = cursor.get(segment);
      if (!(next instanceof Map)) {
        Map<String, Object> created = new HashMap<>();
        cursor.put(segment, created);
        cursor = created;
      } else {
        cursor = (Map<String, Object>) next;
      }
    }

    cursor.put(segments[segments.length - 1], value);
  }

  private String normalizePath(String path) {
    if (path == null) {
      return "";
    }
    return path.trim().replaceAll("^\\\\.+", "").replaceAll("\\\\[(\\\\d+)\\\\]", "");
  }

  private boolean canViewTaskData(GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor, List<String> actorRoles) {
    if (activityDescriptor == null || activityDescriptor.dataViewerRoles() == null || activityDescriptor.dataViewerRoles().isEmpty()) {
      return true;
    }
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    return activityDescriptor.dataViewerRoles().stream().anyMatch(roles::contains);
  }

  private boolean canActorAssignTask(
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      List<String> actorRoles) {
    if (activityDescriptor == null) {
      return false;
    }
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    if (roles.stream().anyMatch((role) -> "PROCESS_MONITOR".equals(role) || "ADMINISTRATOR".equals(role))) {
      return true;
    }

    if ("MANUAL".equals(normalizeUpper(activityDescriptor.assignmentMode(), "AUTOMATIC"))) {
      if (activityDescriptor.manualAssignerRoles() == null || activityDescriptor.manualAssignerRoles().isEmpty()) {
        return false;
      }
      return activityDescriptor.manualAssignerRoles().stream().anyMatch(roles::contains);
    }

    if ("MANUAL_ONLY".equals(normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE"))) {
      if (activityDescriptor.manualAssignerRoles() == null || activityDescriptor.manualAssignerRoles().isEmpty()) {
        return false;
      }
      return activityDescriptor.manualAssignerRoles().stream().anyMatch(roles::contains);
    }

    return false;
  }

  private boolean canRoleConsultInstance(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      List<String> actorRoles) {
    if (descriptor == null) {
      return false;
    }
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    if (roles.isEmpty()) {
      return false;
    }
    return descriptor.activities().stream()
      .anyMatch((activity) ->
        activity.activityViewerRoles() != null
        && activity.activityViewerRoles().stream().anyMatch(roles::contains)
      );
  }

  private boolean canActorSeeInstance(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String actor,
      List<String> actorRoles) {
    if (actor == null || actor.isBlank()) {
      return false;
    }

    if (Objects.equals(instance.startedBy(), actor)) {
      return true;
    }
    if (instance.tasks().stream().anyMatch((task) -> Objects.equals(task.assignee(), actor))) {
      return true;
    }
    return canRoleConsultInstance(descriptor, actorRoles);
  }

  private RuntimeTaskView toTaskView(
      String instanceId,
      ProcessRuntimeTask task,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      List<String> actorRoles) {
    boolean canViewData = canViewTaskData(activityDescriptor, actorRoles);
    Map<String, Object> visibleInput = canViewData ? task.inputData() : Map.of();
    Map<String, Object> visibleOutput = canViewData ? task.outputData() : Map.of();

    return new RuntimeTaskView(
      instanceId,
      task.taskId(),
      task.activityId(),
      task.assignee(),
      task.isAssigned() ? "ASSIGNED" : "UNASSIGNED",
      activityDescriptor == null ? "AUTOMATIC" : normalizeUpper(activityDescriptor.assignmentMode(), "AUTOMATIC"),
      activityDescriptor == null ? "ROLE_QUEUE" : normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE"),
      activityDescriptor == null || activityDescriptor.candidateRoles() == null ? List.of() : activityDescriptor.candidateRoles(),
      activityDescriptor == null || activityDescriptor.manualAssignerRoles() == null ? List.of() : activityDescriptor.manualAssignerRoles(),
      task.state().name(),
      task.createdAt(),
      task.assignedAt(),
      task.completedAt(),
      visibleInput,
      visibleOutput
    );
  }

  private RuntimeInstanceView toInstanceView(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      List<String> actorRoles) {
    List<RuntimeTaskView> taskViews = instance.tasks().stream()
      .map((task) -> {
        GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = descriptor == null
          ? null
          : findActivity(descriptor, task.activityId()).orElse(null);
        return toTaskView(instance.instanceId(), task, activityDescriptor, actorRoles);
      })
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

  private record SharedTarget(String entityKey, String fieldPath) {
  }

  private record AssignmentResolution(String assignee, List<String> candidateIds, String reason) {
  }
}
`;
}

function buildInMemoryProcessRuntimeStoreAdapterJava({ basePackage }) {
  return `package ${basePackage}.system.infrastructure.process.runtime;

import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;

@Component
public class InMemoryProcessRuntimeStoreAdapter implements ProcessRuntimeStorePort {
  private final Map<String, ProcessRuntimeInstance> byInstanceId = new ConcurrentHashMap<>();
  private final Map<String, Map<String, Object>> sharedDataByEntity = new ConcurrentHashMap<>();
  private final List<ProcessRuntimeStorePort.RuntimeMonitorEvent> monitorEvents = new CopyOnWriteArrayList<>();
  private final List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = List.of(
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.user", List.of("PROCESS_USER"), "unit.operations", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.supervisor", List.of("PROCESS_MONITOR", "PROCESS_USER"), "unit.operations", "runtime.admin"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.approverA", List.of("PROCESS_USER"), "unit.finance", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.approverB", List.of("PROCESS_USER"), "unit.finance", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.admin", List.of("ADMINISTRATOR", "PROCESS_MONITOR"), "unit.executive", null)
  );
  private final ProcessRuntimeStorePort.RuntimeOrganizationSnapshot organizationSnapshot = new ProcessRuntimeStorePort.RuntimeOrganizationSnapshot(
    List.of(
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.executive", null, "runtime.admin", List.of("runtime.admin")),
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.operations", "unit.executive", "runtime.supervisor", List.of("runtime.user", "runtime.supervisor")),
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.finance", "unit.executive", "runtime.supervisor", List.of("runtime.approverA", "runtime.approverB"))
    )
  );

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

  @Override
  public Map<String, Object> readSharedData(String entityKey) {
    return Map.copyOf(sharedDataByEntity.getOrDefault(entityKey, Map.of()));
  }

  @Override
  public void writeSharedData(String entityKey, Map<String, Object> values) {
    if (entityKey == null || entityKey.isBlank()) {
      return;
    }

    sharedDataByEntity.compute(
      entityKey,
      (ignored, previous) -> {
        Map<String, Object> next = new HashMap<>(previous == null ? Map.of() : previous);
        if (values != null) {
          next.putAll(values);
        }
        return next;
      }
    );
  }

  @Override
  public List<ProcessRuntimeStorePort.RuntimeUserDescriptor> listUsers() {
    return users;
  }

  @Override
  public ProcessRuntimeStorePort.RuntimeOrganizationSnapshot readOrganizationSnapshot() {
    return organizationSnapshot;
  }

  @Override
  public void appendMonitorEvent(ProcessRuntimeStorePort.RuntimeMonitorEvent event) {
    if (event == null) {
      return;
    }
    monitorEvents.add(
      new ProcessRuntimeStorePort.RuntimeMonitorEvent(
        event.eventId(),
        event.occurredAt() == null ? Instant.now() : event.occurredAt(),
        event.actionType(),
        event.actor(),
        event.actorRoleCodes() == null ? List.of() : List.copyOf(event.actorRoleCodes()),
        event.targetType(),
        event.targetId(),
        event.details(),
        event.forced()
      )
    );
  }

  @Override
  public List<ProcessRuntimeStorePort.RuntimeMonitorEvent> listMonitorEvents() {
    return List.copyOf(monitorEvents);
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

  @Operation(summary = "List pending tasks for actor and roles")
  @GetMapping("/tasks")
  public Map<String, Object> listTasks(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "tasks",
      processRuntimeEngineUseCase.listTasks(new ProcessRuntimeEngineUseCase.TaskQuery(actor, roles))
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
          payload.roleCodes(),
          payload.payload()
        )
      )
    );
  }

  @Operation(summary = "Assign or reassign a runtime task")
  @PostMapping("/tasks/{taskId}/assign")
  public Map<String, Object> assignTask(
    @PathVariable("taskId") String taskId,
    @RequestBody AssignTaskPayload payload
  ) {
    return Map.of(
      "task",
      processRuntimeEngineUseCase.assignTask(
        new ProcessRuntimeEngineUseCase.AssignTaskCommand(
          payload.instanceId(),
          taskId,
          payload.actor(),
          payload.roleCodes(),
          payload.assignee(),
          payload.force()
        )
      )
    );
  }

  @Operation(summary = "Read process runtime instance with role-aware data filtering")
  @GetMapping("/instances/{instanceId}")
  public Map<String, Object> readInstance(
    @PathVariable("instanceId") String instanceId,
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.readInstance(new ProcessRuntimeEngineUseCase.ReadInstanceQuery(instanceId, actor, roles))
    );
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
        new ProcessRuntimeEngineUseCase.StopCommand(instanceId, payload.actor(), payload.roleCodes(), payload.reason())
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
        new ProcessRuntimeEngineUseCase.ArchiveCommand(instanceId, payload.actor(), payload.roleCodes())
      )
    );
  }

  @Operation(summary = "List PROCESS_MONITOR governance audit events")
  @GetMapping("/monitor/events")
  public Map<String, Object> listMonitorEvents(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles,
    @RequestParam(name = "instanceId", required = false) String instanceId,
    @RequestParam(name = "actionType", required = false) String actionType,
    @RequestParam(name = "limit", required = false, defaultValue = "100") int limit
  ) {
    return Map.of(
      "events",
      processRuntimeEngineUseCase.listMonitorEvents(
        new ProcessRuntimeEngineUseCase.MonitorEventsQuery(actor, roles, instanceId, actionType, limit)
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
    List<String> roleCodes,
    Map<String, Object> payload
  ) {
  }

  public record AssignTaskPayload(
    String instanceId,
    String actor,
    List<String> roleCodes,
    String assignee,
    boolean force
  ) {
  }

  public record StopInstancePayload(
    String actor,
    List<String> roleCodes,
    String reason
  ) {
  }

  public record ArchiveInstancePayload(
    String actor,
    List<String> roleCodes
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
        List.of("PROCESS_USER"),
        Map.of("decision", "APPROVED")
      )
    );

    assertThat(completed.status()).isEqualTo("COMPLETED");
  }

  @Test
  void shouldAllowMonitorToAssignPendingTask() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());
    ProcessRuntimeEngineUseCase.StartOption option = useCase.listStartOptions(
      new ProcessRuntimeEngineUseCase.StartOptionsQuery("alice", List.of("PROCESS_USER"))
    ).get(0);

    ProcessRuntimeEngineUseCase.RuntimeInstanceView started = useCase.startInstance(
      new ProcessRuntimeEngineUseCase.StartCommand(
        option.modelKey(),
        option.versionNumber(),
        option.allowedStartActivities().isEmpty() ? null : option.allowedStartActivities().get(0),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("seed", "assignment-test")
      )
    );

    ProcessRuntimeEngineUseCase.RuntimeTaskView pending = started.tasks().stream()
      .filter((entry) -> "PENDING".equals(entry.status()))
      .findFirst()
      .orElseThrow();

    ProcessRuntimeEngineUseCase.RuntimeTaskView reassigned = useCase.assignTask(
      new ProcessRuntimeEngineUseCase.AssignTaskCommand(
        started.instanceId(),
        pending.taskId(),
        "manager",
        List.of("PROCESS_MONITOR"),
        "alice",
        true
      )
    );

    assertThat(reassigned.assignee()).isEqualTo("alice");
    assertThat(reassigned.assignmentStatus()).isEqualTo("ASSIGNED");
  }

  @Test
  void shouldRequireMonitorRoleForGovernanceActionsAndTrackAuditEvents() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());
    ProcessRuntimeEngineUseCase.StartOption option = useCase.listStartOptions(
      new ProcessRuntimeEngineUseCase.StartOptionsQuery("alice", List.of("PROCESS_USER"))
    ).get(0);

    ProcessRuntimeEngineUseCase.RuntimeInstanceView started = useCase.startInstance(
      new ProcessRuntimeEngineUseCase.StartCommand(
        option.modelKey(),
        option.versionNumber(),
        option.allowedStartActivities().isEmpty() ? null : option.allowedStartActivities().get(0),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("seed", "monitor-audit-test")
      )
    );

    assertThatThrownBy(() ->
      useCase.stopInstance(
        new ProcessRuntimeEngineUseCase.StopCommand(
          started.instanceId(),
          "alice",
          List.of("PROCESS_USER"),
          "not-allowed"
        )
      )
    ).isInstanceOf(IllegalStateException.class);

    ProcessRuntimeEngineUseCase.RuntimeInstanceView stopped = useCase.stopInstance(
      new ProcessRuntimeEngineUseCase.StopCommand(
        started.instanceId(),
        "manager",
        List.of("PROCESS_MONITOR"),
        "suspicious runtime drift"
      )
    );
    assertThat(stopped.status()).isEqualTo("STOPPED");

    ProcessRuntimeEngineUseCase.RuntimeInstanceView archived = useCase.archiveInstance(
      new ProcessRuntimeEngineUseCase.ArchiveCommand(
        started.instanceId(),
        "manager",
        List.of("PROCESS_MONITOR")
      )
    );
    assertThat(archived.status()).isEqualTo("ARCHIVED");

    List<ProcessRuntimeEngineUseCase.MonitorEventView> events = useCase.listMonitorEvents(
      new ProcessRuntimeEngineUseCase.MonitorEventsQuery(
        "manager",
        List.of("PROCESS_MONITOR"),
        started.instanceId(),
        "",
        20
      )
    );

    assertThat(events).isNotEmpty();
    assertThat(events).anyMatch((entry) -> "INSTANCE_STOP".equals(entry.actionType()));
    assertThat(events).anyMatch((entry) -> "INSTANCE_ARCHIVE".equals(entry.actionType()));
  }

  private static final class InMemoryStore implements ProcessRuntimeStorePort {
    private final Map<String, ProcessRuntimeInstance> byId = new HashMap<>();
    private final Map<String, Map<String, Object>> sharedDataByEntity = new HashMap<>();
    private final List<ProcessRuntimeStorePort.RuntimeMonitorEvent> monitorEvents = new ArrayList<>();
    private final List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = List.of(
      new ProcessRuntimeStorePort.RuntimeUserDescriptor("alice", List.of("PROCESS_USER"), "unit.operations", "manager"),
      new ProcessRuntimeStorePort.RuntimeUserDescriptor("manager", List.of("PROCESS_MONITOR", "PROCESS_USER"), "unit.operations", "admin"),
      new ProcessRuntimeStorePort.RuntimeUserDescriptor("admin", List.of("ADMINISTRATOR", "PROCESS_MONITOR"), "unit.executive", null)
    );
    private final ProcessRuntimeStorePort.RuntimeOrganizationSnapshot organizationSnapshot = new ProcessRuntimeStorePort.RuntimeOrganizationSnapshot(
      List.of(
        new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.executive", null, "admin", List.of("admin")),
        new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.operations", "unit.executive", "manager", List.of("alice", "manager"))
      )
    );

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

    @Override
    public Map<String, Object> readSharedData(String entityKey) {
      return Map.copyOf(sharedDataByEntity.getOrDefault(entityKey, Map.of()));
    }

    @Override
    public void writeSharedData(String entityKey, Map<String, Object> values) {
      if (entityKey == null || entityKey.isBlank()) {
        return;
      }

      Map<String, Object> merged = new HashMap<>(sharedDataByEntity.getOrDefault(entityKey, Map.of()));
      if (values != null) {
        merged.putAll(values);
      }
      sharedDataByEntity.put(entityKey, merged);
    }

    @Override
    public List<ProcessRuntimeStorePort.RuntimeUserDescriptor> listUsers() {
      return users;
    }

    @Override
    public ProcessRuntimeStorePort.RuntimeOrganizationSnapshot readOrganizationSnapshot() {
      return organizationSnapshot;
    }

    @Override
    public void appendMonitorEvent(ProcessRuntimeStorePort.RuntimeMonitorEvent event) {
      if (event == null) {
        return;
      }
      monitorEvents.add(
        new ProcessRuntimeStorePort.RuntimeMonitorEvent(
          event.eventId(),
          event.occurredAt() == null ? Instant.now() : event.occurredAt(),
          event.actionType(),
          event.actor(),
          event.actorRoleCodes() == null ? List.of() : List.copyOf(event.actorRoleCodes()),
          event.targetType(),
          event.targetId(),
          event.details(),
          event.forced()
        )
      );
    }

    @Override
    public List<ProcessRuntimeStorePort.RuntimeMonitorEvent> listMonitorEvents() {
      return List.copyOf(monitorEvents);
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
      get("/api/process-runtime/tasks")
        .queryParam("actor", "runtime.supervisor")
        .queryParam("roles", "PROCESS_MONITOR")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.tasks").isArray())
      .andExpect(jsonPath("$.tasks[0].assignmentStatus").isNotEmpty())
      .andExpect(jsonPath("$.tasks[0].assignmentMode").isNotEmpty())
      .andExpect(jsonPath("$.tasks[0].assignmentStrategy").isNotEmpty());

    mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/assign")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "instanceId": "__INSTANCE_ID__",
            "actor": "runtime.supervisor",
            "roleCodes": ["PROCESS_MONITOR"],
            "assignee": "runtime.user",
            "force": true
          }
          """.replace("__INSTANCE_ID__", instanceId))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.task.assignee").value("runtime.user"));

    mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/complete")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "instanceId": "__INSTANCE_ID__",
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
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

    MvcResult monitorStartResult = mockMvc.perform(
      post("/api/process-runtime/instances/start")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "modelKey": "${escapeJavaSingle(modelKey)}",
            "versionNumber": ${versionNumber},
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
            "initialPayload": {
              "seed": "monitor-run"
            }
          }
          """)
    )
      .andExpect(status().isOk())
      .andReturn();

    JsonNode monitorStartPayload = objectMapper.readTree(monitorStartResult.getResponse().getContentAsString());
    String monitorInstanceId = monitorStartPayload.path("instance").path("instanceId").asText();

    mockMvc.perform(
      post("/api/process-runtime/instances/" + monitorInstanceId + "/stop")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "actor": "runtime.supervisor",
            "roleCodes": ["PROCESS_MONITOR"],
            "reason": "operator-stop"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instance.status").value("STOPPED"));

    mockMvc.perform(
      post("/api/process-runtime/instances/" + monitorInstanceId + "/archive")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "actor": "runtime.supervisor",
            "roleCodes": ["PROCESS_MONITOR"]
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instance.status").value("ARCHIVED"));

    mockMvc.perform(
      get("/api/process-runtime/monitor/events")
        .queryParam("actor", "runtime.supervisor")
        .queryParam("roles", "PROCESS_MONITOR")
        .queryParam("instanceId", monitorInstanceId)
        .queryParam("limit", "20")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.events").isArray())
      .andExpect(jsonPath("$.events[0].actionType").isNotEmpty());
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

export function listProcessRuntimeTasks({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
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

export function assignProcessRuntimeTask(taskId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/tasks/" + encodeURIComponent(taskId) + "/assign", {
    method: "POST",
    body: payload,
  });
}

export function readProcessRuntimeInstance(instanceId, { actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(
    PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "?" + query.toString(),
  );
}

export function readProcessRuntimeTimeline(instanceId) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/timeline");
}

export function listProcessRuntimeMonitorEvents(
  { actor = "", roles = [], instanceId = "", actionType = "", limit = 100 } = {},
) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  if (instanceId) {
    query.set("instanceId", instanceId);
  }
  if (actionType) {
    query.set("actionType", actionType);
  }
  if (limit) {
    query.set("limit", String(limit));
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/monitor/events?" + query.toString());
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
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessFormCatalog.js",
      content: buildFrontendProcessFormCatalogModule(runtimeEntries),
      kind: "frontend-form-catalog",
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
