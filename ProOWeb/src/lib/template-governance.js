const fs = require("node:fs");
const path = require("node:path");

const TEMPLATE_OVERRIDES_SCHEMA_VERSION = 1;
const TEMPLATE_OVERRIDES_INDEX_PATH = ".prooweb/template-overrides.json";
const TEMPLATE_OVERRIDES_SOURCE_ROOT = ".prooweb/template-overrides";
const SUPPORTED_OVERRIDE_STRATEGIES = new Set([
  "replace",
  "prepend",
  "append",
  "replace-block",
]);

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return fallback;
}

function toSlug(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 120);
}

function assertRelativeProjectPath(relativePath, fieldName) {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/").filter(Boolean);

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized) || segments.includes("..")) {
    throw new Error(`${fieldName} must stay within the project root.`);
  }

  return normalized;
}

function resolveProjectPath(rootDir, relativePath) {
  const normalized = assertRelativeProjectPath(relativePath, "path");
  const resolvedRoot = path.resolve(rootDir);
  const absolutePath = path.resolve(rootDir, normalized);
  if (absolutePath === resolvedRoot) {
    return absolutePath;
  }
  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path '${normalized}' escapes project root.`);
  }
  return absolutePath;
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function normalizeOverrideStrategy(value) {
  const strategy = normalizeString(value).toLowerCase() || "replace";
  if (!SUPPORTED_OVERRIDE_STRATEGIES.has(strategy)) {
    throw new Error(
      `Unsupported override strategy '${strategy}'. Supported strategies: ${Array.from(
        SUPPORTED_OVERRIDE_STRATEGIES,
      ).join(", ")}.`,
    );
  }

  return strategy;
}

function buildDefaultSourcePath(overrideId) {
  return normalizePath(path.posix.join(TEMPLATE_OVERRIDES_SOURCE_ROOT, `${overrideId}.txt`));
}

function normalizeOverrideRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const targetPath = normalizePath(record.targetPath);
  const baseId = normalizeString(record.id) || toSlug(targetPath);
  const overrideId = baseId || `override-${Date.now()}`;
  const strategy = normalizeOverrideStrategy(record.strategy);
  const sourcePath = normalizePath(record.sourcePath) || buildDefaultSourcePath(overrideId);
  const priority = Number.isFinite(record.priority) ? Number(record.priority) : 100;
  const enabled = normalizeBoolean(record.enabled, true);
  const description = normalizeString(record.description) || null;
  const matchText = normalizeString(record.matchText) || null;
  const replacementText = record.replacementText == null ? null : String(record.replacementText);

  if (!targetPath) {
    return null;
  }

  assertRelativeProjectPath(targetPath, "targetPath");
  assertRelativeProjectPath(sourcePath, "sourcePath");

  if (strategy === "replace-block" && !matchText) {
    throw new Error(`Override '${overrideId}' requires matchText when strategy is replace-block.`);
  }

  return {
    id: overrideId,
    targetPath,
    strategy,
    sourcePath,
    priority,
    enabled,
    description,
    matchText,
    replacementText,
    updatedAt: normalizeString(record.updatedAt) || null,
    createdAt: normalizeString(record.createdAt) || null,
  };
}

function readTemplateOverrideRegistry(rootDir) {
  const indexPath = resolveProjectPath(rootDir, TEMPLATE_OVERRIDES_INDEX_PATH);
  const raw = readJsonFile(indexPath);
  const rows = Array.isArray(raw?.overrides) ? raw.overrides : [];
  const overrides = [];
  const invalidOverrides = [];

  for (const row of rows) {
    try {
      const normalized = normalizeOverrideRecord(row);
      if (normalized) {
        overrides.push(normalized);
      }
    } catch (error) {
      invalidOverrides.push({
        id: normalizeString(row?.id) || null,
        reason: error.message || "Invalid override record.",
      });
    }
  }

  return {
    schemaVersion: TEMPLATE_OVERRIDES_SCHEMA_VERSION,
    overrides,
    invalidOverrides,
  };
}

function writeTemplateOverrideRegistry(rootDir, registry) {
  const normalizedOverrides = Array.isArray(registry?.overrides)
    ? registry.overrides.map((entry) => normalizeOverrideRecord(entry)).filter(Boolean)
    : [];
  const payload = {
    schemaVersion: TEMPLATE_OVERRIDES_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    overrides: normalizedOverrides,
  };

  const indexPath = resolveProjectPath(rootDir, TEMPLATE_OVERRIDES_INDEX_PATH);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function writeOverrideSourceContent(rootDir, sourcePath, sourceContent) {
  const absoluteSourcePath = resolveProjectPath(rootDir, sourcePath);
  fs.mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  fs.writeFileSync(absoluteSourcePath, String(sourceContent ?? ""), "utf8");
}

function upsertTemplateOverride(rootDir, payload = {}) {
  const registry = readTemplateOverrideRegistry(rootDir);
  const normalizedPayload = normalizeOverrideRecord(payload);
  if (!normalizedPayload) {
    throw new Error("Override payload is invalid.");
  }

  const now = new Date().toISOString();
  const existingIndex = registry.overrides.findIndex((entry) => entry.id === normalizedPayload.id);
  const createdAt = existingIndex >= 0
    ? registry.overrides[existingIndex].createdAt || now
    : now;
  const merged = {
    ...normalizedPayload,
    createdAt,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    registry.overrides[existingIndex] = merged;
  } else {
    registry.overrides.push(merged);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sourceContent")) {
    writeOverrideSourceContent(rootDir, merged.sourcePath, payload.sourceContent);
  } else if (!fs.existsSync(resolveProjectPath(rootDir, merged.sourcePath))) {
    writeOverrideSourceContent(rootDir, merged.sourcePath, "");
  }

  const persisted = writeTemplateOverrideRegistry(rootDir, registry);
  return {
    override: merged,
    registry: persisted,
  };
}

function removeTemplateOverride(rootDir, overrideId, options = {}) {
  const safeId = normalizeString(overrideId);
  if (!safeId) {
    throw new Error("overrideId is required.");
  }

  const removeSourceFile = normalizeBoolean(options.removeSourceFile, true);
  const registry = readTemplateOverrideRegistry(rootDir);
  const existingIndex = registry.overrides.findIndex((entry) => entry.id === safeId);
  if (existingIndex < 0) {
    return {
      removed: false,
      overrideId: safeId,
    };
  }

  const [removedOverride] = registry.overrides.splice(existingIndex, 1);
  if (removeSourceFile && removedOverride?.sourcePath) {
    const absoluteSourcePath = resolveProjectPath(rootDir, removedOverride.sourcePath);
    if (fs.existsSync(absoluteSourcePath)) {
      fs.rmSync(absoluteSourcePath, { force: true });
    }
  }

  const persisted = writeTemplateOverrideRegistry(rootDir, registry);
  return {
    removed: true,
    overrideId: safeId,
    registry: persisted,
  };
}

function sortOverrides(overrides) {
  return overrides
    .slice()
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }
      return left.id.localeCompare(right.id);
    });
}

function loadTemplateOverrideRuntime(rootDir) {
  const registry = readTemplateOverrideRegistry(rootDir);
  const enabledOverrides = sortOverrides(
    registry.overrides.filter((entry) => normalizeBoolean(entry.enabled, true)),
  );
  const overridesByTargetPath = new Map();
  const diagnostics = {
    missingSourceFiles: [],
    invalidOverrides: Array.isArray(registry.invalidOverrides) ? registry.invalidOverrides : [],
  };

  for (const override of enabledOverrides) {
    const absoluteSourcePath = resolveProjectPath(rootDir, override.sourcePath);
    let sourceContent = null;
    if (fs.existsSync(absoluteSourcePath)) {
      sourceContent = fs.readFileSync(absoluteSourcePath, "utf8");
    } else {
      diagnostics.missingSourceFiles.push({
        id: override.id,
        sourcePath: override.sourcePath,
      });
      if (override.strategy !== "replace-block" && override.strategy !== "replace") {
        continue;
      }
      sourceContent = "";
    }

    if (!overridesByTargetPath.has(override.targetPath)) {
      overridesByTargetPath.set(override.targetPath, []);
    }

    overridesByTargetPath.get(override.targetPath).push({
      ...override,
      sourceContent,
    });
  }

  return {
    registry,
    overridesByTargetPath,
    diagnostics,
  };
}

function applySingleOverride(content, override) {
  const strategy = override.strategy;
  const sourceContent = override.sourceContent == null ? "" : String(override.sourceContent);

  if (strategy === "replace") {
    return {
      content: sourceContent,
      applied: true,
      reason: null,
    };
  }

  if (strategy === "prepend") {
    return {
      content: `${sourceContent}${content}`,
      applied: true,
      reason: null,
    };
  }

  if (strategy === "append") {
    return {
      content: `${content}${sourceContent}`,
      applied: true,
      reason: null,
    };
  }

  const matchText = override.matchText || "";
  const replacementText = override.replacementText != null
    ? String(override.replacementText)
    : sourceContent;

  if (!matchText) {
    return {
      content,
      applied: false,
      reason: "missing-match-text",
    };
  }

  if (!content.includes(matchText)) {
    return {
      content,
      applied: false,
      reason: "match-text-not-found",
    };
  }

  return {
    content: content.split(matchText).join(replacementText),
    applied: true,
    reason: null,
  };
}

function applyTemplateOverridesToFile(runtime, relativePath, content) {
  const normalizedPath = normalizePath(relativePath);
  const overrides = runtime?.overridesByTargetPath?.get(normalizedPath) || [];
  if (!overrides.length) {
    return {
      content,
      appliedOverrides: [],
      skippedOverrides: [],
    };
  }

  let nextContent = content;
  const appliedOverrides = [];
  const skippedOverrides = [];

  for (const override of overrides) {
    const result = applySingleOverride(nextContent, override);
    nextContent = result.content;
    if (result.applied) {
      appliedOverrides.push(override.id);
    } else {
      skippedOverrides.push({
        id: override.id,
        reason: result.reason || "skipped",
      });
    }
  }

  return {
    content: nextContent,
    appliedOverrides,
    skippedOverrides,
  };
}

function listTemplateOverrides(rootDir) {
  const runtime = loadTemplateOverrideRuntime(rootDir);
  return {
    schemaVersion: TEMPLATE_OVERRIDES_SCHEMA_VERSION,
    indexPath: TEMPLATE_OVERRIDES_INDEX_PATH,
    sourceRoot: TEMPLATE_OVERRIDES_SOURCE_ROOT,
    overrides: runtime.registry.overrides,
    diagnostics: runtime.diagnostics,
    summary: {
      total: runtime.registry.overrides.length,
      enabled: runtime.registry.overrides.filter((entry) => entry.enabled !== false).length,
      missingSourceFiles: runtime.diagnostics.missingSourceFiles.length,
      invalidOverrides: runtime.diagnostics.invalidOverrides.length,
    },
  };
}

module.exports = {
  TEMPLATE_OVERRIDES_INDEX_PATH,
  TEMPLATE_OVERRIDES_SOURCE_ROOT,
  SUPPORTED_OVERRIDE_STRATEGIES: Array.from(SUPPORTED_OVERRIDE_STRATEGIES),
  normalizeTemplatePath: normalizePath,
  readTemplateOverrideRegistry,
  writeTemplateOverrideRegistry,
  loadTemplateOverrideRuntime,
  applyTemplateOverridesToFile,
  listTemplateOverrides,
  upsertTemplateOverride,
  removeTemplateOverride,
};
