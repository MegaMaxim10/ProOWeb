const {
  ROOT_DIR,
  isWorkspaceInitialized,
  readWorkspaceConfig,
  toPublicWorkspaceConfig,
  buildWorkspaceConfig,
  writeWorkspaceConfig,
  getManagementStatus,
  markWorkspaceMigrated,
} = require("../lib/workspace");
const { generateWorkspace } = require("../lib/generator");
const { applyGitRepositoryPolicy } = require("../lib/git");
const { runSmartMigration } = require("../lib/migration");
const { createServiceError } = require("../errors/service-error");

function resolveMigrationMode(payload) {
  return payload?.mode === "full" ? "full" : "infra";
}

function createWorkspaceService(dependencies = {}) {
  const deps = {
    rootDir: ROOT_DIR,
    isWorkspaceInitialized,
    readWorkspaceConfig,
    toPublicWorkspaceConfig,
    buildWorkspaceConfig,
    writeWorkspaceConfig,
    getManagementStatus,
    markWorkspaceMigrated,
    generateWorkspace,
    applyGitRepositoryPolicy,
    runSmartMigration,
    ...dependencies,
  };

  function getWorkspaceStatus() {
    const initialized = deps.isWorkspaceInitialized();
    const config = initialized ? deps.readWorkspaceConfig() : null;

    return {
      initialized,
      workspace: deps.toPublicWorkspaceConfig(config),
      management: deps.getManagementStatus(config),
    };
  }

  function initializeWorkspace(payload) {
    if (deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace deja initialise.");
    }

    const config = deps.buildWorkspaceConfig(payload);
    const generationReport = deps.generateWorkspace(deps.rootDir, config, { mode: "full" });
    const gitPolicy = deps.applyGitRepositoryPolicy(deps.rootDir, config.project.gitRepositoryUrl);

    deps.writeWorkspaceConfig(config);

    return {
      message: "Workspace initialise avec succes.",
      workspace: deps.toPublicWorkspaceConfig(config),
      management: deps.getManagementStatus(config),
      generation: generationReport,
      gitPolicy,
    };
  }

  function migrateWorkspace(payload) {
    if (!deps.isWorkspaceInitialized()) {
      throw createServiceError(409, "Workspace non initialise.");
    }

    const mode = resolveMigrationMode(payload);
    const currentConfig = deps.readWorkspaceConfig();
    const migratedConfig = deps.markWorkspaceMigrated(currentConfig);

    const migrationReport = deps.runSmartMigration({
      rootDir: deps.rootDir,
      currentConfig,
      targetConfig: migratedConfig,
      mode,
    });

    deps.writeWorkspaceConfig(migratedConfig);

    return {
      message: "Migration intelligente appliquee avec succes.",
      workspace: deps.toPublicWorkspaceConfig(migratedConfig),
      management: deps.getManagementStatus(migratedConfig),
      migration: migrationReport,
    };
  }

  return {
    getWorkspaceStatus,
    initializeWorkspace,
    migrateWorkspace,
  };
}

module.exports = {
  createWorkspaceService,
  resolveMigrationMode,
};
