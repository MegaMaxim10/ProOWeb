const { ROOT_DIR, isWorkspaceInitialized, readWorkspaceConfig } = require("../lib/workspace");
const {
  listProcessModels,
  toPublicModel,
  createProcessModel,
  createProcessModelVersion,
  compareProcessModelVersions,
  transitionProcessModelVersion,
  normalizeVersionNumber,
  readProcessModelVersion,
  readProcessModelVersionSpecification,
  readProcessModelVersionRuntimeContract,
  readProcessModelVersionDataContract,
  validateProcessModelVersionSpecification,
  saveProcessModelVersionSpecification,
} = require("../lib/process-modeling/catalog");
const {
  deployProcessModelVersion,
  undeployProcessModelVersion,
} = require("../lib/process-modeling/deployment");
const {
  loadStudioHistory,
  toPublicHistory,
  pushStudioSnapshot,
  undoStudioSnapshot,
  redoStudioSnapshot,
} = require("../lib/process-modeling/history");
const { createServiceError } = require("../errors/service-error");

function createProcessModelService(dependencies = {}) {
  const deps = {
    rootDir: ROOT_DIR,
    isWorkspaceInitialized,
    readWorkspaceConfig,
    listProcessModels,
    toPublicModel,
    createProcessModel,
    createProcessModelVersion,
    compareProcessModelVersions,
    transitionProcessModelVersion,
    deployProcessModelVersion,
    undeployProcessModelVersion,
    readProcessModelVersion,
    readProcessModelVersionSpecification,
    readProcessModelVersionRuntimeContract,
    readProcessModelVersionDataContract,
    validateProcessModelVersionSpecification,
    saveProcessModelVersionSpecification,
    loadStudioHistory,
    toPublicHistory,
    pushStudioSnapshot,
    undoStudioSnapshot,
    redoStudioSnapshot,
    ...dependencies,
  };

  function requireWorkspaceConfig() {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is not initialized.");
    }

    const config = deps.readWorkspaceConfig();
    if (!config) {
      throw createServiceError(500, "Workspace configuration could not be loaded.");
    }

    return config;
  }

  function requireProcessModelingEnabled(config) {
    const enabled = config?.backendOptions?.processModeling?.enabled;
    if (!enabled) {
      throw createServiceError(
        409,
        "Process modeling is disabled for this workspace configuration.",
      );
    }
  }

  function listModels() {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const models = deps
      .listProcessModels(deps.rootDir)
      .map((model) => deps.toPublicModel(model));

    return {
      models,
      processModeling: config.backendOptions?.processModeling || null,
      storageRoot: ".prooweb/process-models",
    };
  }

  function createModel(payload) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const model = deps.createProcessModel(deps.rootDir, payload);
    return {
      message: "Process model created.",
      model,
    };
  }

  function createModelVersion(modelKey, payload) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const maxVersionsPerModel = config?.backendOptions?.processModeling?.maxVersionsPerModel || 50;
    const result = deps.createProcessModelVersion(deps.rootDir, modelKey, payload, {
      maxVersionsPerModel,
    });

    return {
      message: "Process model version created.",
      model: result.model,
      version: result.version,
    };
  }

  function compareModelVersions(modelKey, sourceVersion, targetVersion) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const source = normalizeVersionNumber(sourceVersion, "sourceVersion");
    const target = normalizeVersionNumber(targetVersion, "targetVersion");
    const diff = deps.compareProcessModelVersions(deps.rootDir, modelKey, source, target);

    return {
      modelKey: diff.modelKey,
      diff,
    };
  }

  function readModelVersion(modelKey, versionNumber) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    const result = deps.readProcessModelVersion(deps.rootDir, modelKey, normalizedVersion);

    return {
      model: result.model,
      version: result.version,
    };
  }

  function transitionModelVersion(modelKey, versionNumber, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const targetStatus = payload?.targetStatus;
    if (!targetStatus) {
      throw createServiceError(400, "targetStatus is required.");
    }

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    const result = deps.transitionProcessModelVersion(
      deps.rootDir,
      modelKey,
      normalizedVersion,
      targetStatus,
    );

    return {
      message: "Process version transitioned.",
      changed: result.changed,
      model: result.model,
      version: result.version,
    };
  }

  function readModelVersionSpecification(modelKey, versionNumber) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    return deps.readProcessModelVersionSpecification(deps.rootDir, modelKey, normalizedVersion);
  }

  function readModelVersionRuntimeContract(modelKey, versionNumber) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    return deps.readProcessModelVersionRuntimeContract(
      deps.rootDir,
      modelKey,
      normalizedVersion,
    );
  }

  function readModelVersionDataContract(modelKey, versionNumber) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    return deps.readProcessModelVersionDataContract(
      deps.rootDir,
      modelKey,
      normalizedVersion,
    );
  }

  function validateModelVersionSpecification(modelKey, versionNumber, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    return deps.validateProcessModelVersionSpecification(
      deps.rootDir,
      modelKey,
      normalizedVersion,
      payload,
    );
  }

  function saveModelVersionSpecification(modelKey, versionNumber, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    const result = deps.saveProcessModelVersionSpecification(
      deps.rootDir,
      modelKey,
      normalizedVersion,
      payload,
    );

    return {
      message: "Process specification saved.",
      ...result,
    };
  }

  function deployModelVersion(modelKey, versionNumber) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    const result = deps.deployProcessModelVersion({
      rootDir: deps.rootDir,
      workspaceConfig: config,
      modelKey,
      versionNumber: normalizedVersion,
    });

    return {
      message: "Process version deployed and source code generated.",
      model: result.model,
      version: result.version,
      deployment: result.deployment,
    };
  }

  function undeployModelVersion(modelKey, versionNumber) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    const result = deps.undeployProcessModelVersion({
      rootDir: deps.rootDir,
      workspaceConfig: config,
      modelKey,
      versionNumber: normalizedVersion,
    });

    return {
      message: "Process version undeployed and managed runtime artifacts synchronized.",
      model: result.model,
      version: result.version,
      undeployment: result.undeployment,
    };
  }

  function readStudioHistory(modelKey) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const history = deps.loadStudioHistory(deps.rootDir, modelKey);
    return {
      history: deps.toPublicHistory(history, { includeCurrentXml: true }),
    };
  }

  function createStudioSnapshot(modelKey, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const result = deps.pushStudioSnapshot(deps.rootDir, modelKey, payload, {
      maxEntries: 120,
    });

    return {
      message: result.changed ? "Snapshot saved." : "Snapshot unchanged.",
      changed: result.changed,
      history: deps.toPublicHistory(result.history, { includeCurrentXml: true }),
    };
  }

  function undoStudio(modelKey) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const result = deps.undoStudioSnapshot(deps.rootDir, modelKey);
    return {
      message: "Undo applied.",
      history: deps.toPublicHistory(result.history, { includeCurrentXml: true }),
    };
  }

  function redoStudio(modelKey) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const result = deps.redoStudioSnapshot(deps.rootDir, modelKey);
    return {
      message: "Redo applied.",
      history: deps.toPublicHistory(result.history, { includeCurrentXml: true }),
    };
  }

  return {
    listModels,
    createModel,
    createModelVersion,
    compareModelVersions,
    readModelVersion,
    transitionModelVersion,
    readModelVersionSpecification,
    readModelVersionRuntimeContract,
    readModelVersionDataContract,
    validateModelVersionSpecification,
    saveModelVersionSpecification,
    deployModelVersion,
    undeployModelVersion,
    readStudioHistory,
    createStudioSnapshot,
    undoStudio,
    redoStudio,
  };
}

module.exports = {
  createProcessModelService,
};
