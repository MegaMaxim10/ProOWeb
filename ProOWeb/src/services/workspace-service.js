const {
  ROOT_DIR,
  isWorkspaceInitialized,
  readWorkspaceConfig,
  toPublicWorkspaceConfig,
  buildWorkspaceConfig,
  buildWorkspaceMigrationTargetConfig,
  writeWorkspaceConfig,
  getManagementStatus,
  markWorkspaceMigrated,
} = require("../lib/workspace");
const { generateWorkspace } = require("../lib/generator");
const { applyGitRepositoryPolicy } = require("../lib/git");
const { runSmartMigration } = require("../lib/migration");
const {
  listTemplateOverrides,
  upsertTemplateOverride,
  removeTemplateOverride,
} = require("../lib/template-governance");
const { createServiceError } = require("../errors/service-error");

function resolveMigrationMode(payload) {
  return payload?.mode === "full" ? "full" : "infra";
}

function resolveReconfigurationMode(payload) {
  return payload?.mode === "infra" ? "infra" : "full";
}

function createWorkspaceService(dependencies = {}) {
  const deps = {
    rootDir: ROOT_DIR,
    isWorkspaceInitialized,
    readWorkspaceConfig,
    toPublicWorkspaceConfig,
    buildWorkspaceConfig,
    buildWorkspaceMigrationTargetConfig,
    writeWorkspaceConfig,
    getManagementStatus,
    markWorkspaceMigrated,
    generateWorkspace,
    applyGitRepositoryPolicy,
    runSmartMigration,
    listTemplateOverrides,
    upsertTemplateOverride,
    removeTemplateOverride,
    ...dependencies,
  };

  function getWorkspaceStatus() {
    const initialized = deps.isWorkspaceInitialized();
    const config = initialized ? deps.readWorkspaceConfig() : null;
    let templateCustomization = null;
    if (initialized) {
      try {
        templateCustomization = deps.listTemplateOverrides(deps.rootDir);
      } catch (error) {
        templateCustomization = {
          summary: {
            total: 0,
            enabled: 0,
            missingSourceFiles: 0,
          },
          diagnostics: {
            loadError: error.message || "Template overrides could not be loaded.",
          },
          overrides: [],
        };
      }
    }

    return {
      initialized,
      workspace: deps.toPublicWorkspaceConfig(config),
      management: deps.getManagementStatus(config),
      templateCustomization,
    };
  }

  function initializeWorkspace(payload) {
    if (deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is already initialized.");
    }

    const config = deps.buildWorkspaceConfig(payload);
    const generationReport = deps.generateWorkspace(deps.rootDir, config, { mode: "full" });
    const gitPolicy = deps.applyGitRepositoryPolicy(deps.rootDir, config.project.gitRepositoryUrl);

    deps.writeWorkspaceConfig(config);

    return {
      message: "Workspace initialized successfully.",
      workspace: deps.toPublicWorkspaceConfig(config),
      management: deps.getManagementStatus(config),
      generation: generationReport,
      gitPolicy,
    };
  }

  function migrateWorkspace(payload) {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is not initialized.");
    }

    const mode = resolveMigrationMode(payload);
    const currentConfig = deps.readWorkspaceConfig();
    const targetConfig = deps.buildWorkspaceMigrationTargetConfig(currentConfig, payload);
    const migratedConfig = deps.markWorkspaceMigrated(targetConfig);

    const migrationReport = deps.runSmartMigration({
      rootDir: deps.rootDir,
      currentConfig,
      targetConfig: migratedConfig,
      mode,
    });

    deps.writeWorkspaceConfig(migratedConfig);

    return {
      message: "Smart migration completed successfully.",
      workspace: deps.toPublicWorkspaceConfig(migratedConfig),
      management: deps.getManagementStatus(migratedConfig),
      migration: migrationReport,
    };
  }

  function reconfigureWorkspace(payload) {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is not initialized.");
    }

    const mode = resolveReconfigurationMode(payload);
    const currentConfig = deps.readWorkspaceConfig();
    const targetConfig = deps.buildWorkspaceMigrationTargetConfig(currentConfig, payload);
    const migratedConfig = deps.markWorkspaceMigrated(targetConfig);

    const migrationReport = deps.runSmartMigration({
      rootDir: deps.rootDir,
      currentConfig,
      targetConfig: migratedConfig,
      mode,
    });

    deps.writeWorkspaceConfig(migratedConfig);

    return {
      message: "Workspace reconfiguration completed successfully.",
      workspace: deps.toPublicWorkspaceConfig(migratedConfig),
      management: deps.getManagementStatus(migratedConfig),
      migration: migrationReport,
    };
  }

  function listWorkspaceTemplateOverrides() {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is not initialized.");
    }

    return deps.listTemplateOverrides(deps.rootDir);
  }

  function saveWorkspaceTemplateOverride(payload) {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is not initialized.");
    }

    const result = deps.upsertTemplateOverride(deps.rootDir, payload || {});
    return {
      message: "Template override saved.",
      override: result.override,
      templateCustomization: deps.listTemplateOverrides(deps.rootDir),
    };
  }

  function deleteWorkspaceTemplateOverride(overrideId, payload = {}) {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace is not initialized.");
    }

    const result = deps.removeTemplateOverride(deps.rootDir, overrideId, payload);
    return {
      message: result.removed ? "Template override deleted." : "Template override not found.",
      removed: result.removed,
      overrideId: result.overrideId,
      templateCustomization: deps.listTemplateOverrides(deps.rootDir),
    };
  }

  return {
    getWorkspaceStatus,
    initializeWorkspace,
    migrateWorkspace,
    reconfigureWorkspace,
    listWorkspaceTemplateOverrides,
    saveWorkspaceTemplateOverride,
    deleteWorkspaceTemplateOverride,
  };
}

module.exports = {
  createWorkspaceService,
  resolveMigrationMode,
  resolveReconfigurationMode,
};
