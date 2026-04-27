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

function buildBackendRegistryClass({ basePackage, deployedRecords }) {
  const rows = deployedRecords.map(({ model, version }) => {
    const bpmnPath = `classpath:processes/${model.modelKey}/v${version.versionNumber}.bpmn`;
    return `      new ProcessDeploymentDescriptor("${escapeJavaString(model.modelKey)}", ${version.versionNumber}, "${escapeJavaString(
      bpmnPath,
    )}")`;
  });

  const entries = rows.length > 0 ? rows.join(",\n") : "";

  return `package ${basePackage}.system.domain.process;

import java.util.List;

public final class GeneratedProcessRegistry {
  private GeneratedProcessRegistry() {
  }

  public record ProcessDeploymentDescriptor(String modelKey, int versionNumber, String bpmnResourcePath) {
  }

  public static List<ProcessDeploymentDescriptor> deployedProcesses() {
    return List.of(
${entries}
    );
  }
}
`;
}

function buildFrontendDescriptorModule({ model, version, processName }) {
  const exportName = `${processName}ProcessV${version.versionNumber}Descriptor`;

  return `export const ${exportName} = Object.freeze({
  modelKey: ${JSON.stringify(model.modelKey)},
  title: ${JSON.stringify(model.title)},
  description: ${JSON.stringify(model.description || "")},
  versionNumber: ${version.versionNumber},
  status: ${JSON.stringify(version.status)},
  deployedAt: ${JSON.stringify(version.deployedAt || null)},
});

export default ${exportName};
`;
}

function buildFrontendRegistryModule(deployedRecords) {
  const entries = deployedRecords.map(({ model, version }) => ({
    modelKey: model.modelKey,
    title: model.title,
    description: model.description || "",
    versionNumber: version.versionNumber,
    status: version.status,
    deployedAt: version.deployedAt || null,
    bpmnResourcePath: `processes/${model.modelKey}/v${version.versionNumber}.bpmn`,
  }));

  return `export const generatedProcessRegistry = Object.freeze(${JSON.stringify(entries, null, 2)});

export function findGeneratedProcessDescriptor(modelKey) {
  return generatedProcessRegistry.find((entry) => entry.modelKey === String(modelKey || "")) || null;
}
`;
}

function buildVersionMetadata(model, version) {
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
    },
    null,
    2,
  ) + "\n";
}

function buildDeploymentFiles({ workspaceConfig, model, version, deployedRecords }) {
  const basePackage = normalizeBasePackage(workspaceConfig?.project?.basePackage || DEFAULT_BASE_PACKAGE);
  const basePackagePath = basePackage.replace(/\./g, "/");
  const processName = toPascalCase(model.modelKey);

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
      content: buildVersionMetadata(model, version),
      kind: "backend-metadata",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}Descriptor.js`)),
      content: buildFrontendDescriptorModule({ model, version, processName }),
      kind: "frontend-descriptor",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(
        "src/backend/springboot/system/system-domain/src/main/java",
        basePackagePath,
        "system/domain/process/GeneratedProcessRegistry.java",
      )),
      content: buildBackendRegistryClass({ basePackage, deployedRecords }),
      kind: "backend-registry",
      modelKey: "_registry_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessRegistry.js",
      content: buildFrontendRegistryModule(deployedRecords),
      kind: "frontend-registry",
      modelKey: "_registry_",
      versionNumber: 1,
    },
  ];

  return files;
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
  const generatedFiles = buildDeploymentFiles({
    workspaceConfig,
    model: savedModel,
    version: savedVersion,
    deployedRecords,
  });

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
      report,
    },
  };
}

module.exports = {
  deployProcessModelVersion,
};
