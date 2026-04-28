const FEATURE_PACK_DEFINITIONS = Object.freeze([
  {
    id: "backend-platform",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: [],
    description: "Generate strict modular backend baseline.",
  },
  {
    id: "frontend-web-react",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["backend-platform"],
    description: "Generate React web frontend baseline.",
  },
  {
    id: "identity-rbac",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["backend-platform", "frontend-web-react"],
    description: "Generate identity and RBAC foundation (backend + frontend admin panel).",
  },
  {
    id: "auth-flows",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["identity-rbac", "frontend-web-react"],
    description: "Generate account lifecycle auth flows (register, activate, login, reset, OTP/TOTP MFA).",
  },
  {
    id: "external-iam-auth",
    category: "application",
    defaultEnabled: false,
    supportedModes: ["full"],
    dependencies: ["auth-flows", "identity-rbac", "frontend-web-react"],
    description: "Generate external IAM authentication (OIDC-first) while keeping RBAC internal.",
  },
  {
    id: "session-device-security",
    category: "application",
    defaultEnabled: false,
    supportedModes: ["full"],
    dependencies: ["auth-flows", "identity-rbac", "frontend-web-react"],
    description: "Generate session observation, device-risk detection, and session revocation workflows.",
  },
  {
    id: "organization-hierarchy",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["identity-rbac", "frontend-web-react"],
    description: "Generate organization hierarchy management and hierarchy-aware assignment strategies.",
  },
  {
    id: "process-modeling-core",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["backend-platform", "frontend-web-react", "identity-rbac"],
    description: "Enable editor-side BPMN process catalog (version lifecycle, diff, deploy-triggered code generation).",
  },
  {
    id: "notifications-email",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["backend-platform", "frontend-web-react", "identity-rbac"],
    description: "Generate notification templates/channels baseline with operational email workflows.",
  },
  {
    id: "database-liquibase",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: ["backend-platform"],
    description: "Generate Liquibase changelog baseline and migration conventions for reproducible schema evolution.",
  },
  {
    id: "backend-cucumber-bdd",
    category: "application",
    defaultEnabled: false,
    supportedModes: ["full"],
    dependencies: ["backend-platform"],
    description: "Generate backend BDD integration tests using Cucumber + Spring Boot.",
  },
  {
    id: "frontend-cypress-e2e",
    category: "application",
    defaultEnabled: false,
    supportedModes: ["full"],
    dependencies: ["frontend-web-react"],
    description: "Generate frontend E2E tests using Cypress with CI-ready scripts.",
  },
  {
    id: "mobile-placeholder",
    category: "application",
    defaultEnabled: true,
    supportedModes: ["full"],
    dependencies: [],
    description: "Generate mobile placeholder files.",
  },
  {
    id: "deployment-docker",
    category: "infrastructure",
    defaultEnabled: true,
    supportedModes: ["full", "infra"],
    dependencies: ["backend-platform", "frontend-web-react"],
    description: "Generate Docker assets and profile compose files.",
  },
  {
    id: "workspace-scripts",
    category: "infrastructure",
    defaultEnabled: true,
    supportedModes: ["full", "infra"],
    dependencies: ["backend-platform", "frontend-web-react", "deployment-docker"],
    description: "Generate root shortcut scripts for build/test/start.",
  },
  {
    id: "workspace-readme",
    category: "infrastructure",
    defaultEnabled: true,
    supportedModes: ["full", "infra"],
    dependencies: [],
    description: "Generate project workspace readme.",
  },
]);

const FEATURE_PACK_DEFINITION_MAP = new Map(
  FEATURE_PACK_DEFINITIONS.map((definition) => [definition.id, definition]),
);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeString(entry))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    return trimmed
      .split(",")
      .map((entry) => normalizeString(entry))
      .filter(Boolean);
  }

  return [];
}

function getDefaultEnabledFeaturePackIds() {
  return FEATURE_PACK_DEFINITIONS
    .filter((definition) => definition.defaultEnabled)
    .map((definition) => definition.id);
}

function ensureKnownPackIds(packIds) {
  for (const packId of packIds) {
    if (!FEATURE_PACK_DEFINITION_MAP.has(packId)) {
      throw new Error(`Unknown feature pack: ${packId}`);
    }
  }
}

function validateFeaturePackDependencies(enabledPackIds) {
  const enabledSet = new Set(enabledPackIds);

  for (const packId of enabledPackIds) {
    const definition = FEATURE_PACK_DEFINITION_MAP.get(packId);
    for (const dependencyId of definition.dependencies || []) {
      if (!enabledSet.has(dependencyId)) {
        throw new Error(`Feature pack '${packId}' requires '${dependencyId}'.`);
      }
    }
  }
}

function normalizeFeaturePackConfigs(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result = {};
  for (const [packId, packConfig] of Object.entries(value)) {
    if (!FEATURE_PACK_DEFINITION_MAP.has(packId)) {
      continue;
    }

    result[packId] = packConfig && typeof packConfig === "object" ? packConfig : {};
  }

  return result;
}

function normalizeFeaturePacks(rawFeaturePacks) {
  const raw = rawFeaturePacks && typeof rawFeaturePacks === "object" ? rawFeaturePacks : {};

  const enabledInput = normalizeStringList(raw.enabled);
  const enabledPackIds = Array.from(
    new Set(enabledInput.length > 0 ? enabledInput : getDefaultEnabledFeaturePackIds()),
  );

  ensureKnownPackIds(enabledPackIds);
  validateFeaturePackDependencies(enabledPackIds);

  return {
    schemaVersion: 1,
    enabled: enabledPackIds,
    configs: normalizeFeaturePackConfigs(raw.configs),
  };
}

function supportsMode(definition, mode) {
  const supportedModes = Array.isArray(definition.supportedModes) ? definition.supportedModes : ["full"];
  return supportedModes.includes(mode);
}

function resolveFeaturePackSelection(config, options = {}) {
  const mode = options.mode === "infra" ? "infra" : "full";
  const normalizedFeaturePacks = normalizeFeaturePacks(config?.featurePacks);

  const requestedSet = new Set(normalizedFeaturePacks.enabled);
  const activePackIds = FEATURE_PACK_DEFINITIONS
    .filter((definition) => requestedSet.has(definition.id) && supportsMode(definition, mode))
    .map((definition) => definition.id);
  const activeSet = new Set(activePackIds);

  return {
    mode,
    normalizedFeaturePacks,
    requestedPackIds: normalizedFeaturePacks.enabled.slice(),
    activePackIds,
    isEnabled(packId) {
      return activeSet.has(packId);
    },
    getPackConfig(packId) {
      return normalizedFeaturePacks.configs[packId] || {};
    },
  };
}

function compareFeaturePackSelection(currentConfig, targetConfig) {
  const currentPacks = normalizeFeaturePacks(currentConfig?.featurePacks).enabled;
  const targetPacks = normalizeFeaturePacks(targetConfig?.featurePacks).enabled;

  const currentSet = new Set(currentPacks);
  const targetSet = new Set(targetPacks);

  const added = targetPacks.filter((packId) => !currentSet.has(packId));
  const removed = currentPacks.filter((packId) => !targetSet.has(packId));
  const unchanged = targetPacks.filter((packId) => currentSet.has(packId));

  return {
    current: currentPacks,
    target: targetPacks,
    added,
    removed,
    unchanged,
  };
}

function runFeaturePackMigrationHooks({ phase, changeSet }) {
  const phaseName = phase === "before" ? "before" : "after";
  const execution = [];

  const relatedPackIds = Array.from(new Set([...changeSet.added, ...changeSet.removed]));

  for (const packId of relatedPackIds) {
    const definition = FEATURE_PACK_DEFINITION_MAP.get(packId);
    const hooks = definition?.hooks || {};
    const hook = phaseName === "before" ? hooks.beforeMigration : hooks.afterMigration;

    if (typeof hook !== "function") {
      continue;
    }

    hook({
      packId,
      phase: phaseName,
      changeSet,
    });

    execution.push({
      packId,
      phase: phaseName,
      status: "executed",
    });
  }

  return execution;
}

function listFeaturePackDefinitions() {
  return FEATURE_PACK_DEFINITIONS.map((definition) => ({ ...definition }));
}

module.exports = {
  FEATURE_PACK_DEFINITIONS,
  listFeaturePackDefinitions,
  getDefaultEnabledFeaturePackIds,
  normalizeFeaturePacks,
  resolveFeaturePackSelection,
  compareFeaturePackSelection,
  runFeaturePackMigrationHooks,
};
