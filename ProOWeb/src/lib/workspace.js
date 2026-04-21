const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const PROOWEB_DIR = path.join(ROOT_DIR, ".prooweb");
const WORKSPACE_FILE = path.join(PROOWEB_DIR, "workspace.json");
const GENERATED_ROOT_DIRNAME = "workspace";

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

  if (!parsed.backendOptions) {
    parsed.backendOptions = {};
  }

  const swaggerUi = parsed.backendOptions.swaggerUi || {};
  parsed.backendOptions.swaggerUi = {
    enabled: Boolean(swaggerUi.enabled),
    profiles: normalizeStringList(swaggerUi.profiles).map((value) => value.toLowerCase()),
  };

  parsed.managedBy = normalizeManagedBy(parsed);
  return parsed;
}

function readGeneratedManifest(config) {
  if (!config || !config.managedBy) {
    return null;
  }

  const generatedRoot = path.join(ROOT_DIR, config.managedBy.generatedRoot || GENERATED_ROOT_DIRNAME);
  const manifestPath = path.join(generatedRoot, ".prooweb-managed.json");

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
    };
  }

  const editorVersion = getEditorVersion();
  const managedBy = normalizeManagedBy(config);
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
  };
}

function toPublicWorkspaceConfig(config) {
  if (!config) {
    return null;
  }

  const { superAdmin, ...rest } = config;
  return {
    ...rest,
    superAdmin: {
      name: superAdmin.name,
      email: superAdmin.email,
      username: superAdmin.username,
    },
  };
}

function buildWorkspaceConfig(payload) {
  const projectTitle = normalizeString(payload.projectTitle);
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

  const { hash, salt } = hashPassword(superAdminPassword);

  return {
    schemaVersion: 2,
    initializedAt: new Date().toISOString(),
    project: {
      title: projectTitle,
      slug: normalizeSlug(projectTitle),
      gitRepositoryUrl,
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
    },
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

function markWorkspaceMigrated(config) {
  const editorVersion = getEditorVersion();
  const managedBy = normalizeManagedBy(config);

  return {
    ...config,
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
  isWorkspaceInitialized,
  readWorkspaceConfig,
  readGeneratedManifest,
  getEditorVersion,
  getManagementStatus,
  toPublicWorkspaceConfig,
  buildWorkspaceConfig,
  writeWorkspaceConfig,
  markWorkspaceMigrated,
};
