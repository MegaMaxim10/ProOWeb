const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { normalizeFeaturePacks } = require("./feature-packs");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const PROOWEB_DIR = path.join(ROOT_DIR, ".prooweb");
const WORKSPACE_FILE = path.join(PROOWEB_DIR, "workspace.json");
const GENERATED_ROOT_DIRNAME = "root";
const DEFAULT_BASE_PACKAGE = "com.prooweb.generated";
const EXTERNAL_IAM_FEATURE_PACK_ID = "external-iam-auth";
const SESSION_DEVICE_SECURITY_FEATURE_PACK_ID = "session-device-security";
const ORGANIZATION_HIERARCHY_FEATURE_PACK_ID = "organization-hierarchy";
const NOTIFICATIONS_EMAIL_FEATURE_PACK_ID = "notifications-email";
const DATABASE_LIQUIBASE_FEATURE_PACK_ID = "database-liquibase";
const ORGANIZATION_ASSIGNMENT_STRATEGIES = [
  "SUPERVISOR_ONLY",
  "SUPERVISOR_THEN_ANCESTORS",
  "UNIT_MEMBERS",
];

const SUPPORTED_STACK = {
  backendTech: ["springboot"],
  frontendWebTech: ["react"],
  frontendMobileTech: ["none"],
  databaseTech: ["postgresql"],
};

const SWAGGER_ALLOWED_PROFILES = ["dev", "demo", "test"];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeSlug(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "prooweb-app";
}

function normalizeBool(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeString(entry)).filter(Boolean);
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

function normalizeJavaPackage(value) {
  const normalized = normalizeString(value || DEFAULT_BASE_PACKAGE).toLowerCase();
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(normalized)) {
    throw new Error(
      "Base package Java invalide. Exemple attendu: com.example.myapp",
    );
  }

  return normalized;
}

function safeNormalizeJavaPackage(value) {
  try {
    return normalizeJavaPackage(value || DEFAULT_BASE_PACKAGE);
  } catch (_) {
    return DEFAULT_BASE_PACKAGE;
  }
}

function normalizeExternalIamProvider(rawProvider = {}, options = {}) {
  const providerId = normalizeString(rawProvider.id || rawProvider.providerId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default-oidc";
  const provider = {
    id: providerId,
    issuerUri: normalizeString(rawProvider.issuerUri),
    clientId: normalizeString(rawProvider.clientId),
    clientSecret: normalizeString(rawProvider.clientSecret),
    sharedSecret: normalizeString(rawProvider.sharedSecret),
    usernameClaim: normalizeString(rawProvider.usernameClaim) || "preferred_username",
    emailClaim: normalizeString(rawProvider.emailClaim) || "email",
  };

  if (options.strict) {
    assertRequired("externalIam.provider.id", provider.id);
    assertRequired("externalIam.provider.issuerUri", provider.issuerUri);
    assertRequired("externalIam.provider.clientId", provider.clientId);

    if (!/^https?:\/\/.+/i.test(provider.issuerUri)) {
      throw new Error("Issuer URI externe invalide. Exemple attendu: https://issuer.example.com");
    }

    if (!provider.clientSecret && !provider.sharedSecret) {
      throw new Error(
        "Configurer au moins un secret externe IAM (client secret ou shared secret).",
      );
    }
  }

  return provider;
}

function normalizeExternalIamProviders(value, options = {}) {
  const providers = Array.isArray(value) ? value : [];
  const normalizedProviders = [];
  const usedIds = new Set();

  for (const rawProvider of providers) {
    const normalizedProvider = normalizeExternalIamProvider(rawProvider, options);
    if (usedIds.has(normalizedProvider.id)) {
      continue;
    }

    usedIds.add(normalizedProvider.id);
    normalizedProviders.push(normalizedProvider);
  }

  return normalizedProviders;
}

function mergeExternalIamProviderPayload(payload) {
  return [
    {
      id: payload?.externalIamProviderId,
      issuerUri: payload?.externalIamIssuerUri,
      clientId: payload?.externalIamClientId,
      clientSecret: payload?.externalIamClientSecret,
      sharedSecret: payload?.externalIamSharedSecret,
      usernameClaim: payload?.externalIamUsernameClaim,
      emailClaim: payload?.externalIamEmailClaim,
    },
  ];
}

function normalizePositiveInteger(value, fallback, fieldName) {
  const raw = normalizeString(value);
  if (!raw) {
    return fallback;
  }

  const numeric = Number.parseInt(raw, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return numeric;
}

function normalizeSessionSecurityConfig(rawConfig = {}, options = {}) {
  const enabled = options.forceEnabled !== undefined
    ? Boolean(options.forceEnabled)
    : normalizeBool(rawConfig.enabled);
  const suspiciousWindowMinutes = normalizePositiveInteger(
    rawConfig.suspiciousWindowMinutes,
    60,
    "sessionSecurity.suspiciousWindowMinutes",
  );
  const maxDistinctDevices = normalizePositiveInteger(
    rawConfig.maxDistinctDevices,
    3,
    "sessionSecurity.maxDistinctDevices",
  );

  if (options.strict && enabled) {
    if (suspiciousWindowMinutes < 1 || suspiciousWindowMinutes > 1440) {
      throw new Error("sessionSecurity.suspiciousWindowMinutes must be between 1 and 1440.");
    }

    if (maxDistinctDevices < 1 || maxDistinctDevices > 64) {
      throw new Error("sessionSecurity.maxDistinctDevices must be between 1 and 64.");
    }
  }

  return {
    enabled,
    suspiciousWindowMinutes,
    maxDistinctDevices,
  };
}

function normalizeAssignmentStrategy(value) {
  const normalized = normalizeString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (ORGANIZATION_ASSIGNMENT_STRATEGIES.includes(normalized)) {
    return normalized;
  }

  return "SUPERVISOR_THEN_ANCESTORS";
}

function normalizeOrganizationHierarchyConfig(rawConfig = {}, options = {}) {
  const enabled = options.forceEnabled !== undefined
    ? Boolean(options.forceEnabled)
    : (rawConfig.enabled === undefined ? true : normalizeBool(rawConfig.enabled));
  const defaultAssignmentStrategy = normalizeAssignmentStrategy(rawConfig.defaultAssignmentStrategy);
  const maxTraversalDepth = normalizePositiveInteger(
    rawConfig.maxTraversalDepth,
    8,
    "organizationHierarchy.maxTraversalDepth",
  );

  if (options.strict && enabled) {
    if (maxTraversalDepth < 1 || maxTraversalDepth > 16) {
      throw new Error("organizationHierarchy.maxTraversalDepth must be between 1 and 16.");
    }
  }

  return {
    enabled,
    defaultAssignmentStrategy,
    maxTraversalDepth,
  };
}

function normalizeNotificationsConfig(rawConfig = {}, options = {}) {
  const enabled = options.forceEnabled !== undefined
    ? Boolean(options.forceEnabled)
    : (rawConfig.enabled === undefined ? true : normalizeBool(rawConfig.enabled));
  const senderAddress = normalizeString(rawConfig.senderAddress) || "no-reply@prooweb.local";
  const auditEnabled = rawConfig.auditEnabled === undefined ? true : normalizeBool(rawConfig.auditEnabled);

  if (options.strict && enabled && !/^\S+@\S+\.\S+$/.test(senderAddress)) {
    throw new Error("notifications.senderAddress must be a valid email address.");
  }

  return {
    enabled,
    senderAddress,
    auditEnabled,
  };
}

function normalizeDatabaseMigrationConfig(rawConfig = {}, options = {}) {
  const liquibaseEnabled = options.forceEnabled !== undefined
    ? Boolean(options.forceEnabled)
    : (rawConfig.liquibaseEnabled === undefined ? true : normalizeBool(rawConfig.liquibaseEnabled));
  const changelogPath = normalizeString(rawConfig.changelogPath) || "classpath:db/changelog/db.changelog-master.yaml";
  const contexts = normalizeString(rawConfig.contexts) || "baseline,reference-data";

  if (options.strict && liquibaseEnabled) {
    if (!/^classpath:.+/i.test(changelogPath)) {
      throw new Error("databaseMigration.changelogPath must start with classpath:");
    }
  }

  return {
    liquibaseEnabled,
    changelogPath,
    contexts,
  };
}

function withConfigDrivenFeaturePacks(featurePacks, options = {}) {
  const enabled = Array.isArray(featurePacks?.enabled) ? featurePacks.enabled : [];
  const enabledSet = new Set(enabled);

  if (options.externalIamEnabled) {
    enabledSet.add(EXTERNAL_IAM_FEATURE_PACK_ID);
  } else {
    enabledSet.delete(EXTERNAL_IAM_FEATURE_PACK_ID);
  }

  if (options.sessionSecurityEnabled) {
    enabledSet.add(SESSION_DEVICE_SECURITY_FEATURE_PACK_ID);
  } else {
    enabledSet.delete(SESSION_DEVICE_SECURITY_FEATURE_PACK_ID);
  }

  if (options.organizationHierarchyEnabled) {
    enabledSet.add(ORGANIZATION_HIERARCHY_FEATURE_PACK_ID);
  } else {
    enabledSet.delete(ORGANIZATION_HIERARCHY_FEATURE_PACK_ID);
  }

  if (options.notificationsEnabled) {
    enabledSet.add(NOTIFICATIONS_EMAIL_FEATURE_PACK_ID);
  } else {
    enabledSet.delete(NOTIFICATIONS_EMAIL_FEATURE_PACK_ID);
  }

  if (options.liquibaseEnabled) {
    enabledSet.add(DATABASE_LIQUIBASE_FEATURE_PACK_ID);
  } else {
    enabledSet.delete(DATABASE_LIQUIBASE_FEATURE_PACK_ID);
  }

  return normalizeFeaturePacks({
    ...(featurePacks || {}),
    enabled: Array.from(enabledSet),
  });
}

function assertChoice(fieldName, value) {
  if (!SUPPORTED_STACK[fieldName].includes(value)) {
    throw new Error(
      `${fieldName} non supporte. Valeurs acceptees: ${SUPPORTED_STACK[fieldName].join(", ")}`,
    );
  }
}

function assertRequired(fieldName, value) {
  if (!normalizeString(value)) {
    throw new Error(`Champ obligatoire: ${fieldName}`);
  }
}

function assertGitUrl(candidateUrl) {
  if (!candidateUrl) {
    return;
  }

  const httpSshPattern = /^(https?:\/\/|ssh:\/\/).+/i;
  const scpLikePattern = /^git@[^:]+:.+/i;
  if (!httpSshPattern.test(candidateUrl) && !scpLikePattern.test(candidateUrl)) {
    throw new Error(
      "Lien Git invalide. Utiliser par exemple https://...git ou git@host:owner/repo.git",
    );
  }
}

function hashPassword(rawPassword) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(rawPassword, salt, 120000, 32, "sha256").toString("hex");
  return { hash, salt };
}

function ensureConfigDir() {
  fs.mkdirSync(PROOWEB_DIR, { recursive: true });
}

function getEditorVersion() {
  try {
    const packagePath = path.join(ROOT_DIR, "package.json");
    const content = fs.readFileSync(packagePath, "utf8").replace(/^\uFEFF/, "");
    const pkg = JSON.parse(content);
    return normalizeString(pkg.version) || "0.0.0";
  } catch (_) {
    return "0.0.0";
  }
}

function normalizeManagedBy(config) {
  const editorVersion = getEditorVersion();
  const managedBy = config.managedBy || {};

  return {
    editorVersion: normalizeString(managedBy.editorVersion) || editorVersion,
    managedProjectVersion: Number.isFinite(managedBy.managedProjectVersion)
      ? managedBy.managedProjectVersion
      : 1,
    layoutVersion: Number.isFinite(managedBy.layoutVersion) ? managedBy.layoutVersion : 2,
    generatedRoot: normalizeString(managedBy.generatedRoot) || GENERATED_ROOT_DIRNAME,
    lastMigratedAt: managedBy.lastMigratedAt || null,
  };
}

function resolveManagedProjectRoot(generatedRoot) {
  const normalized = normalizeString(generatedRoot) || GENERATED_ROOT_DIRNAME;
  return normalized === GENERATED_ROOT_DIRNAME ? ROOT_DIR : path.join(ROOT_DIR, normalized);
}

function isWorkspaceInitialized() {
  return fs.existsSync(WORKSPACE_FILE);
}

function readWorkspaceConfig() {
  if (!isWorkspaceInitialized()) {
    return null;
  }

  const raw = fs.readFileSync(WORKSPACE_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed.project) {
    parsed.project = {};
  }

  if (!Object.prototype.hasOwnProperty.call(parsed.project, "gitRepositoryUrl")) {
    parsed.project.gitRepositoryUrl = null;
  }
  parsed.project.basePackage = safeNormalizeJavaPackage(parsed.project.basePackage);

  if (!parsed.backendOptions) {
    parsed.backendOptions = {};
  }

  const swaggerUi = parsed.backendOptions.swaggerUi || {};
  const externalIam = parsed.backendOptions.externalIam || {};
  const sessionSecurity = parsed.backendOptions.sessionSecurity || {};
  const organizationHierarchy = parsed.backendOptions.organizationHierarchy || {};
  const notifications = parsed.backendOptions.notifications || {};
  const databaseMigration = parsed.backendOptions.databaseMigration || {};
  parsed.backendOptions.swaggerUi = {
    enabled: Boolean(swaggerUi.enabled),
    profiles: normalizeStringList(swaggerUi.profiles).map((value) => value.toLowerCase()),
  };
  parsed.backendOptions.externalIam = {
    enabled: Boolean(externalIam.enabled),
    providers: normalizeExternalIamProviders(externalIam.providers),
  };
  parsed.backendOptions.sessionSecurity = normalizeSessionSecurityConfig(
    {
      enabled: sessionSecurity.enabled,
      suspiciousWindowMinutes: sessionSecurity.suspiciousWindowMinutes,
      maxDistinctDevices: sessionSecurity.maxDistinctDevices,
    },
    { strict: false },
  );
  parsed.backendOptions.organizationHierarchy = normalizeOrganizationHierarchyConfig(
    {
      enabled: organizationHierarchy.enabled,
      defaultAssignmentStrategy: organizationHierarchy.defaultAssignmentStrategy,
      maxTraversalDepth: organizationHierarchy.maxTraversalDepth,
    },
    { strict: false },
  );
  parsed.backendOptions.notifications = normalizeNotificationsConfig(
    {
      enabled: notifications.enabled,
      senderAddress: notifications.senderAddress,
      auditEnabled: notifications.auditEnabled,
    },
    { strict: false },
  );
  parsed.backendOptions.databaseMigration = normalizeDatabaseMigrationConfig(
    {
      liquibaseEnabled: databaseMigration.liquibaseEnabled,
      changelogPath: databaseMigration.changelogPath,
      contexts: databaseMigration.contexts,
    },
    { strict: false },
  );

  parsed.featurePacks = withConfigDrivenFeaturePacks(
    normalizeFeaturePacks(parsed.featurePacks),
    {
      externalIamEnabled: parsed.backendOptions.externalIam.enabled,
      sessionSecurityEnabled: parsed.backendOptions.sessionSecurity.enabled,
      organizationHierarchyEnabled: parsed.backendOptions.organizationHierarchy.enabled,
      notificationsEnabled: parsed.backendOptions.notifications.enabled,
      liquibaseEnabled: parsed.backendOptions.databaseMigration.liquibaseEnabled,
    },
  );
  parsed.managedBy = normalizeManagedBy(parsed);
  return parsed;
}

function readGeneratedManifest(config) {
  if (!config || !config.managedBy) {
    return null;
  }

  const generatedProjectRoot = resolveManagedProjectRoot(config.managedBy.generatedRoot);
  const manifestPath = path.join(generatedProjectRoot, ".prooweb-managed.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function getManagementStatus(config) {
  if (!config) {
    return {
      editorVersion: getEditorVersion(),
      migrationRequired: false,
      generatedRoot: GENERATED_ROOT_DIRNAME,
      activeFeaturePackCount: 0,
      activeFeaturePacks: [],
    };
  }

  const editorVersion = getEditorVersion();
  const managedBy = normalizeManagedBy(config);
  const featurePacks = normalizeFeaturePacks(config.featurePacks);
  const migrationRequired = managedBy.editorVersion !== editorVersion;
  const generatedManifest = readGeneratedManifest(config);

  return {
    editorVersion,
    projectEditorVersion: managedBy.editorVersion,
    managedProjectVersion: managedBy.managedProjectVersion,
    layoutVersion: managedBy.layoutVersion,
    generatedRoot: managedBy.generatedRoot,
    migrationRequired,
    lastMigratedAt: managedBy.lastMigratedAt,
    generatedManifestFound: Boolean(generatedManifest),
    managedFilesCount: Array.isArray(generatedManifest?.managedFiles)
      ? generatedManifest.managedFiles.length
      : 0,
    activeFeaturePackCount: featurePacks.enabled.length,
    activeFeaturePacks: featurePacks.enabled,
  };
}

function toPublicWorkspaceConfig(config) {
  if (!config) {
    return null;
  }

  const { superAdmin, ...rest } = config;
  const backendOptions = {
    ...(rest.backendOptions || {}),
  };
  const externalIam = backendOptions.externalIam || {};
  const sessionSecurity = backendOptions.sessionSecurity || {};
  const organizationHierarchy = backendOptions.organizationHierarchy || {};
  const notifications = backendOptions.notifications || {};
  const databaseMigration = backendOptions.databaseMigration || {};
  backendOptions.externalIam = {
    enabled: Boolean(externalIam.enabled),
    providers: normalizeExternalIamProviders(externalIam.providers).map((provider) => ({
      id: provider.id,
      issuerUri: provider.issuerUri,
      clientId: provider.clientId,
      usernameClaim: provider.usernameClaim,
      emailClaim: provider.emailClaim,
      clientSecretConfigured: Boolean(provider.clientSecret),
      sharedSecretConfigured: Boolean(provider.sharedSecret),
    })),
  };
  backendOptions.sessionSecurity = normalizeSessionSecurityConfig(
    {
      enabled: sessionSecurity.enabled,
      suspiciousWindowMinutes: sessionSecurity.suspiciousWindowMinutes,
      maxDistinctDevices: sessionSecurity.maxDistinctDevices,
    },
    { strict: false },
  );
  backendOptions.organizationHierarchy = normalizeOrganizationHierarchyConfig(
    {
      enabled: organizationHierarchy.enabled,
      defaultAssignmentStrategy: organizationHierarchy.defaultAssignmentStrategy,
      maxTraversalDepth: organizationHierarchy.maxTraversalDepth,
    },
    { strict: false },
  );
  backendOptions.notifications = normalizeNotificationsConfig(
    {
      enabled: notifications.enabled,
      senderAddress: notifications.senderAddress,
      auditEnabled: notifications.auditEnabled,
    },
    { strict: false },
  );
  backendOptions.databaseMigration = normalizeDatabaseMigrationConfig(
    {
      liquibaseEnabled: databaseMigration.liquibaseEnabled,
      changelogPath: databaseMigration.changelogPath,
      contexts: databaseMigration.contexts,
    },
    { strict: false },
  );

  return {
    ...rest,
    backendOptions,
    superAdmin: {
      name: superAdmin.name,
      email: superAdmin.email,
      username: superAdmin.username,
    },
  };
}

function buildWorkspaceConfig(payload) {
  const projectTitle = normalizeString(payload.projectTitle);
  const basePackage = normalizeJavaPackage(payload.basePackage || DEFAULT_BASE_PACKAGE);
  const backendTech = normalizeString(payload.backendTech).toLowerCase();
  const frontendWebTech = normalizeString(payload.frontendWebTech).toLowerCase();
  const frontendMobileTech = normalizeString(payload.frontendMobileTech || "none").toLowerCase();
  const databaseTech = normalizeString(payload.databaseTech).toLowerCase();
  const gitRepositoryUrl = normalizeString(payload.gitRepositoryUrl) || null;

  const superAdminName = normalizeString(payload.superAdminName);
  const superAdminEmail = normalizeString(payload.superAdminEmail);
  const superAdminUsername = normalizeString(payload.superAdminUsername);
  const superAdminPassword = normalizeString(payload.superAdminPassword);

  const swaggerUiEnabled = normalizeBool(payload.swaggerUiEnabled);
  const swaggerProfiles = normalizeStringList(payload.swaggerProfiles).map((entry) => entry.toLowerCase());
  const externalIamEnabled = normalizeBool(payload.externalIamEnabled);
  const externalIamProviders = externalIamEnabled
    ? normalizeExternalIamProviders(
      Array.isArray(payload?.externalIamProviders)
        ? payload.externalIamProviders
        : mergeExternalIamProviderPayload(payload),
      { strict: true },
    )
    : [];
  const sessionSecurityEnabled = normalizeBool(payload.sessionSecurityEnabled);
  const sessionSecurityConfig = normalizeSessionSecurityConfig(
    {
      enabled: sessionSecurityEnabled,
      suspiciousWindowMinutes: payload.sessionSecurityWindowMinutes,
      maxDistinctDevices: payload.sessionSecurityMaxDistinctDevices,
    },
    { strict: true, forceEnabled: sessionSecurityEnabled },
  );
  const organizationHierarchyEnabled = Object.prototype.hasOwnProperty.call(payload, "organizationHierarchyEnabled")
    ? normalizeBool(payload.organizationHierarchyEnabled)
    : true;
  const organizationHierarchyConfig = normalizeOrganizationHierarchyConfig(
    {
      enabled: organizationHierarchyEnabled,
      defaultAssignmentStrategy: payload.organizationDefaultAssignmentStrategy,
      maxTraversalDepth: payload.organizationMaxTraversalDepth,
    },
    { strict: true, forceEnabled: organizationHierarchyEnabled },
  );
  const notificationsEnabled = Object.prototype.hasOwnProperty.call(payload, "notificationsEnabled")
    ? normalizeBool(payload.notificationsEnabled)
    : true;
  const notificationsConfig = normalizeNotificationsConfig(
    {
      enabled: notificationsEnabled,
      senderAddress: payload.notificationsSenderAddress,
      auditEnabled: payload.notificationsAuditEnabled,
    },
    { strict: true, forceEnabled: notificationsEnabled },
  );
  const liquibaseEnabled = Object.prototype.hasOwnProperty.call(payload, "liquibaseEnabled")
    ? normalizeBool(payload.liquibaseEnabled)
    : true;
  const databaseMigrationConfig = normalizeDatabaseMigrationConfig(
    {
      liquibaseEnabled,
      changelogPath: payload.liquibaseChangelogPath,
      contexts: payload.liquibaseContexts,
    },
    { strict: true, forceEnabled: liquibaseEnabled },
  );
  const featurePacksEnabled = normalizeStringList(payload.featurePacksEnabled).map((entry) => entry.toLowerCase());
  const featurePackConfigs = payload?.featurePackConfigs;

  assertRequired("projectTitle", projectTitle);
  assertRequired("superAdminName", superAdminName);
  assertRequired("superAdminEmail", superAdminEmail);
  assertRequired("superAdminUsername", superAdminUsername);
  assertRequired("superAdminPassword", superAdminPassword);

  assertChoice("backendTech", backendTech);
  assertChoice("frontendWebTech", frontendWebTech);
  assertChoice("frontendMobileTech", frontendMobileTech);
  assertChoice("databaseTech", databaseTech);

  assertGitUrl(gitRepositoryUrl);

  if (!/^\S+@\S+\.\S+$/.test(superAdminEmail)) {
    throw new Error("Format email invalide pour le super administrateur.");
  }

  if (superAdminPassword.length < 8) {
    throw new Error("Le mot de passe du super administrateur doit contenir au moins 8 caracteres.");
  }

  if (swaggerUiEnabled) {
    if (swaggerProfiles.length === 0) {
      throw new Error("Swagger UI est active: selectionner au moins un profil (dev/demo/test).");
    }

    for (const profile of swaggerProfiles) {
      if (!SWAGGER_ALLOWED_PROFILES.includes(profile)) {
        throw new Error(
          `Profil Swagger invalide: ${profile}. Profils autorises: ${SWAGGER_ALLOWED_PROFILES.join(", ")}.`,
        );
      }
    }
  }

  const uniqueSwaggerProfiles = Array.from(new Set(swaggerUiEnabled ? swaggerProfiles : []));
  const featurePacks = withConfigDrivenFeaturePacks(
    normalizeFeaturePacks(
      payload?.featurePacks ||
        (featurePacksEnabled.length > 0
          ? {
              enabled: featurePacksEnabled,
              configs: featurePackConfigs,
            }
          : null),
    ),
    {
      externalIamEnabled,
      sessionSecurityEnabled: sessionSecurityConfig.enabled,
      organizationHierarchyEnabled: organizationHierarchyConfig.enabled,
      notificationsEnabled: notificationsConfig.enabled,
      liquibaseEnabled: databaseMigrationConfig.liquibaseEnabled,
    },
  );

  const { hash, salt } = hashPassword(superAdminPassword);

  return {
    schemaVersion: 4,
    initializedAt: new Date().toISOString(),
    project: {
      title: projectTitle,
      slug: normalizeSlug(projectTitle),
      gitRepositoryUrl,
      basePackage,
    },
    stack: {
      backendTech,
      frontendWebTech,
      frontendMobileTech,
      databaseTech,
    },
    backendOptions: {
      swaggerUi: {
        enabled: swaggerUiEnabled,
        profiles: uniqueSwaggerProfiles,
      },
      externalIam: {
        enabled: externalIamEnabled,
        providers: externalIamProviders,
      },
      sessionSecurity: sessionSecurityConfig,
      organizationHierarchy: organizationHierarchyConfig,
      notifications: notificationsConfig,
      databaseMigration: databaseMigrationConfig,
    },
    featurePacks,
    managedBy: {
      editorVersion: getEditorVersion(),
      managedProjectVersion: 1,
      layoutVersion: 2,
      generatedRoot: GENERATED_ROOT_DIRNAME,
      lastMigratedAt: null,
    },
    superAdmin: {
      name: superAdminName,
      email: superAdminEmail,
      username: superAdminUsername,
      passwordHash: hash,
      passwordSalt: salt,
    },
  };
}

function buildWorkspaceMigrationTargetConfig(currentConfig, payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const currentBasePackage = currentConfig?.project?.basePackage || DEFAULT_BASE_PACKAGE;
  const hasBasePackageOverride = Object.prototype.hasOwnProperty.call(safePayload, "basePackage");
  const basePackage = hasBasePackageOverride
    ? normalizeJavaPackage(safePayload.basePackage || DEFAULT_BASE_PACKAGE)
    : safeNormalizeJavaPackage(currentBasePackage);
  const hasSwaggerEnabledOverride = Object.prototype.hasOwnProperty.call(safePayload, "swaggerUiEnabled");
  const currentSwaggerUi = currentConfig?.backendOptions?.swaggerUi || {};
  const swaggerUiEnabled = hasSwaggerEnabledOverride
    ? normalizeBool(safePayload.swaggerUiEnabled)
    : Boolean(currentSwaggerUi.enabled);
  const hasSwaggerProfilesOverride = Object.prototype.hasOwnProperty.call(safePayload, "swaggerProfiles");
  const swaggerProfiles = (hasSwaggerProfilesOverride
    ? normalizeStringList(safePayload.swaggerProfiles)
    : normalizeStringList(currentSwaggerUi.profiles))
    .map((entry) => entry.toLowerCase());

  if (swaggerUiEnabled) {
    if (swaggerProfiles.length === 0) {
      throw new Error("Swagger UI est active: selectionner au moins un profil (dev/demo/test).");
    }

    for (const profile of swaggerProfiles) {
      if (!SWAGGER_ALLOWED_PROFILES.includes(profile)) {
        throw new Error(
          `Profil Swagger invalide: ${profile}. Profils autorises: ${SWAGGER_ALLOWED_PROFILES.join(", ")}.`,
        );
      }
    }
  }

  const uniqueSwaggerProfiles = Array.from(new Set(swaggerUiEnabled ? swaggerProfiles : []));

  const hasExternalIamEnabledOverride = Object.prototype.hasOwnProperty.call(safePayload, "externalIamEnabled");
  const externalIamEnabled = hasExternalIamEnabledOverride
    ? normalizeBool(safePayload.externalIamEnabled)
    : Boolean(currentConfig?.backendOptions?.externalIam?.enabled);
  const hasExternalIamProviderOverride = Array.isArray(safePayload.externalIamProviders)
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamProviderId")
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamIssuerUri")
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamClientId")
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamClientSecret")
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamSharedSecret")
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamUsernameClaim")
    || Object.prototype.hasOwnProperty.call(safePayload, "externalIamEmailClaim");
  const externalIamProviders = externalIamEnabled
    ? (hasExternalIamProviderOverride
      ? normalizeExternalIamProviders(
        Array.isArray(safePayload.externalIamProviders)
          ? safePayload.externalIamProviders
          : mergeExternalIamProviderPayload(safePayload),
        { strict: true },
      )
      : normalizeExternalIamProviders(currentConfig?.backendOptions?.externalIam?.providers || []))
    : [];
  if (externalIamEnabled && externalIamProviders.length === 0) {
    throw new Error("External IAM active: configurer au moins un provider.");
  }

  const hasSessionSecurityEnabledOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "sessionSecurityEnabled",
  );
  const currentSessionSecurity = currentConfig?.backendOptions?.sessionSecurity || {};
  const sessionSecurityEnabled = hasSessionSecurityEnabledOverride
    ? normalizeBool(safePayload.sessionSecurityEnabled)
    : Boolean(currentSessionSecurity.enabled);
  const hasSessionSecurityWindowOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "sessionSecurityWindowMinutes",
  );
  const hasSessionSecurityMaxDevicesOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "sessionSecurityMaxDistinctDevices",
  );
  const sessionSecurityConfig = normalizeSessionSecurityConfig(
    {
      enabled: sessionSecurityEnabled,
      suspiciousWindowMinutes: hasSessionSecurityWindowOverride
        ? safePayload.sessionSecurityWindowMinutes
        : currentSessionSecurity.suspiciousWindowMinutes,
      maxDistinctDevices: hasSessionSecurityMaxDevicesOverride
        ? safePayload.sessionSecurityMaxDistinctDevices
        : currentSessionSecurity.maxDistinctDevices,
    },
    { strict: true, forceEnabled: sessionSecurityEnabled },
  );
  const hasOrganizationHierarchyEnabledOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "organizationHierarchyEnabled",
  );
  const currentOrganizationHierarchy = currentConfig?.backendOptions?.organizationHierarchy || {};
  const organizationHierarchyEnabled = hasOrganizationHierarchyEnabledOverride
    ? normalizeBool(safePayload.organizationHierarchyEnabled)
    : (currentOrganizationHierarchy.enabled === undefined ? true : Boolean(currentOrganizationHierarchy.enabled));
  const hasOrganizationDefaultStrategyOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "organizationDefaultAssignmentStrategy",
  );
  const hasOrganizationMaxDepthOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "organizationMaxTraversalDepth",
  );
  const organizationHierarchyConfig = normalizeOrganizationHierarchyConfig(
    {
      enabled: organizationHierarchyEnabled,
      defaultAssignmentStrategy: hasOrganizationDefaultStrategyOverride
        ? safePayload.organizationDefaultAssignmentStrategy
        : currentOrganizationHierarchy.defaultAssignmentStrategy,
      maxTraversalDepth: hasOrganizationMaxDepthOverride
        ? safePayload.organizationMaxTraversalDepth
        : currentOrganizationHierarchy.maxTraversalDepth,
    },
    { strict: true, forceEnabled: organizationHierarchyEnabled },
  );
  const hasNotificationsEnabledOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "notificationsEnabled",
  );
  const currentNotifications = currentConfig?.backendOptions?.notifications || {};
  const notificationsEnabled = hasNotificationsEnabledOverride
    ? normalizeBool(safePayload.notificationsEnabled)
    : (currentNotifications.enabled === undefined ? true : Boolean(currentNotifications.enabled));
  const hasNotificationsSenderAddressOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "notificationsSenderAddress",
  );
  const hasNotificationsAuditOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "notificationsAuditEnabled",
  );
  const notificationsConfig = normalizeNotificationsConfig(
    {
      enabled: notificationsEnabled,
      senderAddress: hasNotificationsSenderAddressOverride
        ? safePayload.notificationsSenderAddress
        : currentNotifications.senderAddress,
      auditEnabled: hasNotificationsAuditOverride
        ? safePayload.notificationsAuditEnabled
        : currentNotifications.auditEnabled,
    },
    { strict: true, forceEnabled: notificationsEnabled },
  );
  const hasLiquibaseEnabledOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "liquibaseEnabled",
  );
  const currentDatabaseMigration = currentConfig?.backendOptions?.databaseMigration || {};
  const liquibaseEnabled = hasLiquibaseEnabledOverride
    ? normalizeBool(safePayload.liquibaseEnabled)
    : (currentDatabaseMigration.liquibaseEnabled === undefined
      ? true
      : Boolean(currentDatabaseMigration.liquibaseEnabled));
  const hasLiquibaseChangelogPathOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "liquibaseChangelogPath",
  );
  const hasLiquibaseContextsOverride = Object.prototype.hasOwnProperty.call(
    safePayload,
    "liquibaseContexts",
  );
  const databaseMigrationConfig = normalizeDatabaseMigrationConfig(
    {
      liquibaseEnabled,
      changelogPath: hasLiquibaseChangelogPathOverride
        ? safePayload.liquibaseChangelogPath
        : currentDatabaseMigration.changelogPath,
      contexts: hasLiquibaseContextsOverride
        ? safePayload.liquibaseContexts
        : currentDatabaseMigration.contexts,
    },
    { strict: true, forceEnabled: liquibaseEnabled },
  );

  const featurePacksEnabled = normalizeStringList(safePayload.featurePacksEnabled).map((entry) => entry.toLowerCase());
  const rawFeaturePacks =
    safePayload.featurePacks ||
    (featurePacksEnabled.length > 0
      ? {
          enabled: featurePacksEnabled,
          configs: safePayload.featurePackConfigs,
        }
      : currentConfig.featurePacks);

  const featurePacks = withConfigDrivenFeaturePacks(
    normalizeFeaturePacks(rawFeaturePacks),
    {
      externalIamEnabled,
      sessionSecurityEnabled: sessionSecurityConfig.enabled,
      organizationHierarchyEnabled: organizationHierarchyConfig.enabled,
      notificationsEnabled: notificationsConfig.enabled,
      liquibaseEnabled: databaseMigrationConfig.liquibaseEnabled,
    },
  );

  return {
    ...currentConfig,
    schemaVersion: 4,
    project: {
      ...currentConfig.project,
      basePackage,
    },
    backendOptions: {
      ...(currentConfig.backendOptions || {}),
      swaggerUi: {
        enabled: swaggerUiEnabled,
        profiles: uniqueSwaggerProfiles,
      },
      externalIam: {
        enabled: externalIamEnabled,
        providers: externalIamProviders,
      },
      sessionSecurity: sessionSecurityConfig,
      organizationHierarchy: organizationHierarchyConfig,
      notifications: notificationsConfig,
      databaseMigration: databaseMigrationConfig,
    },
    featurePacks,
  };
}

function markWorkspaceMigrated(config) {
  const editorVersion = getEditorVersion();
  const managedBy = normalizeManagedBy(config);

  return {
    ...config,
    featurePacks: withConfigDrivenFeaturePacks(
      normalizeFeaturePacks(config.featurePacks),
      {
        externalIamEnabled: Boolean(config?.backendOptions?.externalIam?.enabled),
        sessionSecurityEnabled: Boolean(config?.backendOptions?.sessionSecurity?.enabled),
        organizationHierarchyEnabled: config?.backendOptions?.organizationHierarchy?.enabled === undefined
          ? true
          : Boolean(config?.backendOptions?.organizationHierarchy?.enabled),
        notificationsEnabled: config?.backendOptions?.notifications?.enabled === undefined
          ? true
          : Boolean(config?.backendOptions?.notifications?.enabled),
        liquibaseEnabled: config?.backendOptions?.databaseMigration?.liquibaseEnabled === undefined
          ? true
          : Boolean(config?.backendOptions?.databaseMigration?.liquibaseEnabled),
      },
    ),
    managedBy: {
      ...managedBy,
      editorVersion,
      lastMigratedAt: new Date().toISOString(),
    },
  };
}

function writeWorkspaceConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(WORKSPACE_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

module.exports = {
  ROOT_DIR,
  WORKSPACE_FILE,
  GENERATED_ROOT_DIRNAME,
  SUPPORTED_STACK,
  SWAGGER_ALLOWED_PROFILES,
  resolveManagedProjectRoot,
  isWorkspaceInitialized,
  readWorkspaceConfig,
  readGeneratedManifest,
  getEditorVersion,
  getManagementStatus,
  toPublicWorkspaceConfig,
  buildWorkspaceConfig,
  buildWorkspaceMigrationTargetConfig,
  writeWorkspaceConfig,
  markWorkspaceMigrated,
};
