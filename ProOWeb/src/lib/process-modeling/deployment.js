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
  const backendResourcesRoot = path.join("src/backend/springboot/prooweb-application/src/main/resources/processes", model.modelKey);
  const frontendProcessRoot = path.join("src/frontend/web/react/src/modules/processes", model.modelKey);

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
  ];

  return {
    files,
    runtimeContract,
    dataContract,
    runtimeEntries,
  };
}

function applyManagedDeploymentWrite(rootDir, files, deploymentId) {
  const report = {
    deploymentId,
    backupRoot: toPosixPath(path.join(".prooweb", "backups", deploymentId)),
    summary: {
      filesGenerated: files.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      conflictsResolved: 0,
      collisionsResolved: 0,
      backupsCreated: 0,
    },
    details: {
      created: [],
      updated: [],
      unchanged: [],
      conflictsResolved: [],
      collisionsResolved: [],
      backups: [],
    },
  };

  const managedIndex = readManagedFileIndex(rootDir);
  const filesIndex = managedIndex.files || {};

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
  const deploymentBuild = buildDeploymentFiles({
    workspaceConfig,
    model: savedModel,
    version: savedVersion,
    deployedRecords,
  });
  const generatedFiles = deploymentBuild.files;

  const deploymentId = toDeploymentId();
  const report = applyManagedDeploymentWrite(rootDir, generatedFiles, deploymentId);

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

module.exports = {
  deployProcessModelVersion,
};
