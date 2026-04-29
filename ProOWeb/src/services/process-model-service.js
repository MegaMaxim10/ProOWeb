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
  simulateProcessModelVersion,
  runProcessPromotionPipeline,
  rollbackProcessPromotion,
} = require("../lib/process-modeling/promotion-pipeline");
const {
  loadStudioHistory,
  toPublicHistory,
  pushStudioSnapshot,
  undoStudioSnapshot,
  redoStudioSnapshot,
} = require("../lib/process-modeling/history");
const {
  readAutomaticTaskCatalog,
  saveAutomaticTaskCatalog,
  readAutomaticTaskTypeSource,
  saveAutomaticTaskTypeSource,
  buildAutomaticTaskTypeLookup,
} = require("../lib/process-modeling/automatic-task-catalog");
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
    simulateProcessModelVersion,
    runProcessPromotionPipeline,
    rollbackProcessPromotion,
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
    readAutomaticTaskCatalog,
    saveAutomaticTaskCatalog,
    readAutomaticTaskTypeSource,
    saveAutomaticTaskTypeSource,
    buildAutomaticTaskTypeLookup,
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

  function loadAutomaticTaskCatalogSummary() {
    const catalog = deps.readAutomaticTaskCatalog(deps.rootDir, { includeSources: false });
    const enabledTaskTypes = (catalog.taskTypes || []).filter((entry) => entry.enabled !== false).length;
    const builtinTaskTypes = (catalog.taskTypes || []).filter((entry) => entry.kind === "BUILTIN").length;
    const customTaskTypes = (catalog.taskTypes || []).filter((entry) => entry.kind === "CUSTOM").length;
    return {
      schemaVersion: catalog.schemaVersion,
      totalTaskTypes: (catalog.taskTypes || []).length,
      enabledTaskTypes,
      builtinTaskTypes,
      customTaskTypes,
      mavenLibraries: (catalog.libraries?.maven || []).length,
      npmLibraries: (catalog.libraries?.npm || []).length,
      diagnostics: catalog.diagnostics || {
        duplicateTaskTypeKeys: [],
        libraryConflicts: [],
      },
    };
  }

  function buildSpecificationValidationOptions() {
    const catalog = deps.readAutomaticTaskCatalog(deps.rootDir, { includeSources: false });
    return {
      automaticTaskTypesByKey: deps.buildAutomaticTaskTypeLookup(catalog),
    };
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
      automaticTaskCatalog: loadAutomaticTaskCatalogSummary(),
      storageRoot: ".prooweb/process-models",
    };
  }

  function createModel(payload) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const model = deps.createProcessModel(deps.rootDir, payload, {
      validationOptions: buildSpecificationValidationOptions(),
    });
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
      validationOptions: buildSpecificationValidationOptions(),
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
    const result = deps.readProcessModelVersionSpecification(deps.rootDir, modelKey, normalizedVersion);
    const validated = deps.validateProcessModelVersionSpecification(
      deps.rootDir,
      modelKey,
      normalizedVersion,
      { specification: result.specification },
      {
        validationOptions: buildSpecificationValidationOptions(),
      },
    );
    return {
      ...result,
      summary: validated.summary,
      validation: validated.validation,
    };
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
      {
        validationOptions: buildSpecificationValidationOptions(),
      },
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
      {
        validationOptions: buildSpecificationValidationOptions(),
      },
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

  function simulateModelVersion(modelKey, versionNumber, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    const simulation = deps.simulateProcessModelVersion({
      rootDir: deps.rootDir,
      modelKey,
      versionNumber: normalizedVersion,
      options: payload,
    });

    return {
      message: "Process simulation completed.",
      modelKey: simulation.modelKey,
      versionNumber: simulation.versionNumber,
      simulation,
    };
  }

  function promoteModelVersion(modelKey, versionNumber, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    return deps.runProcessPromotionPipeline({
      rootDir: deps.rootDir,
      workspaceConfig: config,
      modelKey,
      versionNumber: normalizedVersion,
      options: payload,
    });
  }

  function rollbackPromotion(modelKey, versionNumber, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);

    const normalizedVersion = normalizeVersionNumber(versionNumber, "versionNumber");
    return deps.rollbackProcessPromotion({
      rootDir: deps.rootDir,
      workspaceConfig: config,
      modelKey,
      versionNumber: normalizedVersion,
      options: payload,
    });
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

  function readAutomaticTasksCatalog() {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);
    const catalog = deps.readAutomaticTaskCatalog(deps.rootDir, { includeSources: false });
    return {
      catalog,
      summary: loadAutomaticTaskCatalogSummary(),
    };
  }

  function saveAutomaticTasksCatalog(payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);
    const catalog = deps.saveAutomaticTaskCatalog(deps.rootDir, payload);
    return {
      message: "Automatic task catalog saved.",
      catalog,
      summary: loadAutomaticTaskCatalogSummary(),
    };
  }

  function readAutomaticTaskSource(taskTypeKey) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);
    return deps.readAutomaticTaskTypeSource(deps.rootDir, taskTypeKey);
  }

  function saveAutomaticTaskSource(taskTypeKey, payload = {}) {
    const config = requireWorkspaceConfig();
    requireProcessModelingEnabled(config);
    const source = payload?.source;
    if (source === undefined || source === null) {
      throw createServiceError(400, "source is required.");
    }
    const result = deps.saveAutomaticTaskTypeSource(deps.rootDir, taskTypeKey, source);
    return {
      message: "Automatic task type source saved.",
      ...result,
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
    simulateModelVersion,
    promoteModelVersion,
    rollbackPromotion,
    undeployModelVersion,
    readStudioHistory,
    createStudioSnapshot,
    undoStudio,
    redoStudio,
    readAutomaticTasksCatalog,
    saveAutomaticTasksCatalog,
    readAutomaticTaskSource,
    saveAutomaticTaskSource,
  };
}

module.exports = {
  createProcessModelService,
};
