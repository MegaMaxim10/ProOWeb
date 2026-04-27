const fs = require("node:fs");
const path = require("node:path");
const {
  validateProcessSpecificationV1,
  normalizeProcessSpecificationV1,
  summarizeProcessSpecificationV1,
} = require("./spec-v1");
const { buildRuntimeContract } = require("./runtime-contract");

const PROCESS_STATUSES = Object.freeze(["DRAFT", "VALIDATED", "DEPLOYED", "RETIRED"]);

const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ["VALIDATED", "RETIRED"],
  VALIDATED: ["DRAFT", "RETIRED"],
  DEPLOYED: ["RETIRED"],
  RETIRED: ["DRAFT", "VALIDATED"],
});

function createCatalogError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeModelKey(value) {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(normalized)) {
    throw createCatalogError(
      400,
      "modelKey must match [a-z0-9][a-z0-9._-]{1,63}.",
    );
  }

  return normalized;
}

function normalizeStatus(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (!PROCESS_STATUSES.includes(normalized)) {
    throw createCatalogError(400, `Unsupported process status: ${value || "-"}.`);
  }

  return normalized;
}

function normalizeVersionNumber(value, fieldName = "versionNumber") {
  const numeric = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(numeric) || numeric < 1) {
    throw createCatalogError(400, `${fieldName} must be a positive integer.`);
  }

  return numeric;
}

function splitLines(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toIsoNow() {
  return new Date().toISOString();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function resolveVersionSpecification(rawSpecification, bpmnXml) {
  const source = asObject(rawSpecification) || {};
  const validation = validateProcessSpecificationV1(source, {
    bpmnXml: String(bpmnXml || ""),
    strict: true,
  });

  return {
    specification: validation.normalizedSpecification,
    validation,
    summary: summarizeProcessSpecificationV1(validation.normalizedSpecification),
  };
}

function getCatalogPaths(rootDir) {
  const catalogRoot = path.join(rootDir, ".prooweb", "process-models");
  const modelsRoot = path.join(catalogRoot, "models");

  return {
    catalogRoot,
    modelsRoot,
  };
}

function ensureCatalogLayout(rootDir) {
  const paths = getCatalogPaths(rootDir);
  fs.mkdirSync(paths.modelsRoot, { recursive: true });
  return paths;
}

function buildModelFilePath(rootDir, modelKey) {
  const paths = ensureCatalogLayout(rootDir);
  return path.join(paths.modelsRoot, `${normalizeModelKey(modelKey)}.json`);
}

function normalizeVersion(rawVersion = {}) {
  const status = normalizeStatus(rawVersion.status || "DRAFT");
  const versionNumber = normalizeVersionNumber(rawVersion.versionNumber);
  const bpmnXml = String(rawVersion.bpmnXml || "");

  if (!bpmnXml.trim()) {
    throw createCatalogError(400, "Each process version must contain BPMN XML.");
  }

  const specificationSnapshot = resolveVersionSpecification(rawVersion.specification, bpmnXml);

  return {
    versionNumber,
    status,
    summary: normalizeString(rawVersion.summary),
    bpmnXml,
    createdAt: rawVersion.createdAt || toIsoNow(),
    updatedAt: rawVersion.updatedAt || rawVersion.createdAt || toIsoNow(),
    deployedAt: rawVersion.deployedAt || null,
    retiredAt: rawVersion.retiredAt || null,
    specification: specificationSnapshot.specification,
    deployment: rawVersion.deployment && typeof rawVersion.deployment === "object"
      ? rawVersion.deployment
      : null,
  };
}

function normalizeModel(rawModel = {}) {
  const modelKey = normalizeModelKey(rawModel.modelKey);
  const versions = Array.isArray(rawModel.versions)
    ? rawModel.versions.map((entry) => normalizeVersion(entry))
    : [];

  if (versions.length === 0) {
    throw createCatalogError(500, `Model '${modelKey}' has no versions.`);
  }

  versions.sort((left, right) => left.versionNumber - right.versionNumber);

  return {
    schemaVersion: 1,
    modelKey,
    title: normalizeString(rawModel.title) || modelKey,
    description: normalizeString(rawModel.description),
    createdAt: rawModel.createdAt || toIsoNow(),
    updatedAt: rawModel.updatedAt || rawModel.createdAt || toIsoNow(),
    versions,
  };
}

function loadProcessModel(rootDir, modelKey) {
  const filePath = buildModelFilePath(rootDir, modelKey);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeModel(parsed);
}

function saveProcessModel(rootDir, model) {
  const normalized = normalizeModel(model);
  const filePath = buildModelFilePath(rootDir, normalized.modelKey);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function findVersionIndex(model, versionNumber) {
  return model.versions.findIndex((version) => version.versionNumber === versionNumber);
}

function requireVersion(model, versionNumber) {
  const versionIndex = findVersionIndex(model, versionNumber);
  if (versionIndex < 0) {
    throw createCatalogError(
      404,
      `Version ${versionNumber} was not found for model '${model.modelKey}'.`,
    );
  }

  return {
    versionIndex,
    version: model.versions[versionIndex],
  };
}

function listProcessModels(rootDir) {
  const { modelsRoot } = ensureCatalogLayout(rootDir);
  const entries = fs
    .readdirSync(modelsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(modelsRoot, entry.name));

  const models = entries
    .map((entry) => {
      const raw = fs.readFileSync(entry, "utf8");
      return normalizeModel(JSON.parse(raw));
    })
    .sort((left, right) => left.modelKey.localeCompare(right.modelKey));

  return models;
}

function toPublicVersion(version, options = {}) {
  const includeBpmn = Boolean(options.includeBpmn);
  const includeSpecification = Boolean(options.includeSpecification);
  const lineCount = splitLines(version.bpmnXml).length;
  const specificationSnapshot = resolveVersionSpecification(version.specification, version.bpmnXml);
  const validation = specificationSnapshot.validation;

  return {
    versionNumber: version.versionNumber,
    status: version.status,
    summary: version.summary,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    deployedAt: version.deployedAt,
    retiredAt: version.retiredAt,
    bpmnLineCount: lineCount,
    specificationSchemaVersion: specificationSnapshot.summary.schemaVersion,
    specificationSummary: specificationSnapshot.summary,
    specificationValidation: {
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
    },
    ...(includeBpmn ? { bpmnXml: version.bpmnXml } : {}),
    ...(includeSpecification ? { specification: specificationSnapshot.specification } : {}),
  };
}

function toPublicModel(model, options = {}) {
  const includeBpmn = Boolean(options.includeBpmn);

  return {
    modelKey: model.modelKey,
    title: model.title,
    description: model.description,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    versions: model.versions
      .slice()
      .sort((left, right) => left.versionNumber - right.versionNumber)
      .map((version) => toPublicVersion(version, { includeBpmn })),
  };
}

function createInitialVersion({ bpmnXml, summary, specification }) {
  const now = toIsoNow();
  const specificationSnapshot = resolveVersionSpecification(specification, bpmnXml);
  return {
    versionNumber: 1,
    status: "DRAFT",
    summary: normalizeString(summary) || "Initial draft version",
    bpmnXml: String(bpmnXml || ""),
    createdAt: now,
    updatedAt: now,
    deployedAt: null,
    retiredAt: null,
    specification: specificationSnapshot.specification,
    deployment: null,
  };
}

function createProcessModel(rootDir, payload = {}) {
  const modelKey = normalizeModelKey(payload.modelKey);
  const title = normalizeString(payload.title);
  const description = normalizeString(payload.description);
  const bpmnXml = String(payload.bpmnXml || "");
  const summary = normalizeString(payload.summary);

  if (!title) {
    throw createCatalogError(400, "title is required.");
  }

  if (!bpmnXml.trim()) {
    throw createCatalogError(400, "bpmnXml is required.");
  }

  const existing = loadProcessModel(rootDir, modelKey);
  if (existing) {
    throw createCatalogError(409, `Model '${modelKey}' already exists.`);
  }

  const now = toIsoNow();
  const saved = saveProcessModel(rootDir, {
    schemaVersion: 1,
    modelKey,
      title,
      description,
      createdAt: now,
      updatedAt: now,
      versions: [createInitialVersion({ bpmnXml, summary, specification: payload.specification })],
    });

  return toPublicModel(saved);
}

function createProcessModelVersion(rootDir, modelKey, payload = {}, options = {}) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const maxVersionsPerModel = normalizeVersionNumber(
    options.maxVersionsPerModel || 50,
    "maxVersionsPerModel",
  );
  if (model.versions.length >= maxVersionsPerModel) {
    throw createCatalogError(
      409,
      `Model '${normalizedKey}' reached max versions (${maxVersionsPerModel}).`,
    );
  }

  const bpmnXml = String(payload.bpmnXml || "");
  if (!bpmnXml.trim()) {
    throw createCatalogError(400, "bpmnXml is required.");
  }

  const nextVersion = model.versions.reduce(
    (maxValue, version) => Math.max(maxValue, version.versionNumber),
    0,
  ) + 1;

  const specificationSnapshot = resolveVersionSpecification(payload.specification, bpmnXml);
  const now = toIsoNow();
  model.versions.push({
    versionNumber: nextVersion,
    status: "DRAFT",
    summary: normalizeString(payload.summary) || `Draft version ${nextVersion}`,
    bpmnXml,
    createdAt: now,
    updatedAt: now,
    deployedAt: null,
    retiredAt: null,
    specification: specificationSnapshot.specification,
    deployment: null,
  });
  model.updatedAt = now;

  const saved = saveProcessModel(rootDir, model);
  return {
    model: toPublicModel(saved),
    version: toPublicVersion(saved.versions[saved.versions.length - 1], { includeBpmn: true }),
  };
}

function compareProcessModelVersions(rootDir, modelKey, sourceVersion, targetVersion) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const sourceNumber = normalizeVersionNumber(sourceVersion, "sourceVersion");
  const targetNumber = normalizeVersionNumber(targetVersion, "targetVersion");

  const source = requireVersion(model, sourceNumber).version;
  const target = requireVersion(model, targetNumber).version;

  const sourceLines = splitLines(source.bpmnXml);
  const targetLines = splitLines(target.bpmnXml);
  const sourceSet = new Set(sourceLines);
  const targetSet = new Set(targetLines);
  const added = targetLines.filter((line) => !sourceSet.has(line));
  const removed = sourceLines.filter((line) => !targetSet.has(line));
  const sharedLineCount = targetLines.filter((line) => sourceSet.has(line)).length;

  return {
    modelKey: normalizedKey,
    sourceVersion: sourceNumber,
    targetVersion: targetNumber,
    added,
    removed,
    sharedLineCount,
    generatedAt: toIsoNow(),
  };
}

function transitionProcessModelVersion(rootDir, modelKey, versionNumber, targetStatus) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const normalizedVersion = normalizeVersionNumber(versionNumber);
  const desiredStatus = normalizeStatus(targetStatus);

  if (desiredStatus === "DEPLOYED") {
    throw createCatalogError(400, "Use deployment endpoint for DEPLOYED transition.");
  }

  const { versionIndex, version } = requireVersion(model, normalizedVersion);

  if (version.status === desiredStatus) {
    return {
      model: toPublicModel(model),
      version: toPublicVersion(version, { includeBpmn: true }),
      changed: false,
    };
  }

  const allowed = ALLOWED_TRANSITIONS[version.status] || [];
  if (!allowed.includes(desiredStatus)) {
    throw createCatalogError(
      409,
      `Cannot transition model '${normalizedKey}' version ${normalizedVersion} from ${version.status} to ${desiredStatus}.`,
    );
  }

  const now = toIsoNow();
  const updated = {
    ...version,
    status: desiredStatus,
    updatedAt: now,
    retiredAt: desiredStatus === "RETIRED" ? now : null,
  };

  model.versions[versionIndex] = updated;
  model.updatedAt = now;

  const saved = saveProcessModel(rootDir, model);
  const savedVersion = requireVersion(saved, normalizedVersion).version;

  return {
    model: toPublicModel(saved),
    version: toPublicVersion(savedVersion, { includeBpmn: true }),
    changed: true,
  };
}

function listDeployedModels(rootDir) {
  return listProcessModels(rootDir)
    .map((model) => {
      const deployed = model.versions
        .filter((version) => version.status === "DEPLOYED")
        .sort((left, right) => right.versionNumber - left.versionNumber)[0];

      if (!deployed) {
        return null;
      }

      return {
        model,
        version: deployed,
      };
    })
    .filter(Boolean);
}

function readProcessModelVersion(rootDir, modelKey, versionNumber) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
  const { version } = requireVersion(model, normalizedVersion);

  return {
    model: toPublicModel(model),
    version: toPublicVersion(version, { includeBpmn: true }),
  };
}

function parseSpecificationPayload(payload) {
  const source = asObject(payload);
  if (!source) {
    return {};
  }

  if (asObject(source.specification)) {
    return source.specification;
  }

  return source;
}

function readProcessModelVersionSpecification(rootDir, modelKey, versionNumber) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
  const { version } = requireVersion(model, normalizedVersion);
  const specificationSnapshot = resolveVersionSpecification(version.specification, version.bpmnXml);

  return {
    model: toPublicModel(model),
    version: toPublicVersion(version),
    specification: specificationSnapshot.specification,
    summary: specificationSnapshot.summary,
    validation: {
      valid: specificationSnapshot.validation.valid,
      errors: specificationSnapshot.validation.errors,
      warnings: specificationSnapshot.validation.warnings,
    },
  };
}

function readProcessModelVersionRuntimeContract(rootDir, modelKey, versionNumber) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
  const { version } = requireVersion(model, normalizedVersion);
  const contract = buildRuntimeContract({ model, version });

  return {
    model: toPublicModel(model),
    version: toPublicVersion(version),
    contract,
  };
}

function validateProcessModelVersionSpecification(rootDir, modelKey, versionNumber, payload = {}) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
  const { version } = requireVersion(model, normalizedVersion);
  const specification = parseSpecificationPayload(payload);
  const validation = validateProcessSpecificationV1(specification, {
    bpmnXml: version.bpmnXml,
    strict: true,
  });

  return {
    model: toPublicModel(model),
    version: toPublicVersion(version),
    specification: validation.normalizedSpecification,
    summary: summarizeProcessSpecificationV1(validation.normalizedSpecification),
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  };
}

function saveProcessModelVersionSpecification(rootDir, modelKey, versionNumber, payload = {}) {
  const normalizedKey = normalizeModelKey(modelKey);
  const model = loadProcessModel(rootDir, normalizedKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedKey}' was not found.`);
  }

  const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
  const { versionIndex, version } = requireVersion(model, normalizedVersion);
  const specification = parseSpecificationPayload(payload);

  let normalizedValidation;
  try {
    normalizedValidation = normalizeProcessSpecificationV1(specification, {
      bpmnXml: version.bpmnXml,
      strict: true,
    });
  } catch (error) {
    if (error?.validation) {
      const details = error.validation.errors
        .map((entry) => `${entry.path}: ${entry.message}`)
        .join(" | ");
      throw createCatalogError(
        400,
        details ? `Specification validation failed. ${details}` : "Specification validation failed.",
      );
    }
    throw error;
  }

  const now = toIsoNow();
  model.versions[versionIndex] = {
    ...version,
    specification: normalizedValidation.normalizedSpecification,
    updatedAt: now,
  };
  model.updatedAt = now;

  const saved = saveProcessModel(rootDir, model);
  const savedVersion = requireVersion(saved, normalizedVersion).version;
  const validation = validateProcessSpecificationV1(savedVersion.specification, {
    bpmnXml: savedVersion.bpmnXml,
    strict: true,
  });

  return {
    model: toPublicModel(saved),
    version: toPublicVersion(savedVersion, { includeSpecification: true }),
    specification: validation.normalizedSpecification,
    summary: summarizeProcessSpecificationV1(validation.normalizedSpecification),
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  };
}

module.exports = {
  PROCESS_STATUSES,
  createCatalogError,
  normalizeModelKey,
  normalizeVersionNumber,
  ensureCatalogLayout,
  loadProcessModel,
  saveProcessModel,
  listProcessModels,
  toPublicModel,
  toPublicVersion,
  createProcessModel,
  createProcessModelVersion,
  compareProcessModelVersions,
  transitionProcessModelVersion,
  listDeployedModels,
  readProcessModelVersion,
  readProcessModelVersionSpecification,
  readProcessModelVersionRuntimeContract,
  validateProcessModelVersionSpecification,
  saveProcessModelVersionSpecification,
};
