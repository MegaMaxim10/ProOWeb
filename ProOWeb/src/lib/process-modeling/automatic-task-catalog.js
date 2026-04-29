const fs = require("node:fs");
const path = require("node:path");

const AUTOMATIC_TASK_CATALOG_SCHEMA_VERSION = 1;
const AUTOMATIC_TASK_CATALOG_INDEX_PATH = ".prooweb/process-models/automatic-task-catalog.json";
const AUTOMATIC_TASK_SOURCE_ROOT = ".prooweb/process-models/automatic-task-types";

const AUTOMATIC_TASK_KIND_VALUES = Object.freeze(["BUILTIN", "CUSTOM"]);
const LIBRARY_ECOSYSTEM_VALUES = Object.freeze(["MAVEN", "NPM"]);

const DEFAULT_LIBRARY_CATALOG = Object.freeze({
  maven: [
    {
      libraryKey: "spring-boot-mail",
      ecosystem: "MAVEN",
      groupId: "org.springframework.boot",
      artifactId: "spring-boot-starter-mail",
      version: "3.4.4",
      scope: "compile",
      description: "Mail sender integration for runtime notifications and automatic email tasks.",
    },
    {
      libraryKey: "apache-poi-ooxml",
      ecosystem: "MAVEN",
      groupId: "org.apache.poi",
      artifactId: "poi-ooxml",
      version: "5.4.0",
      scope: "compile",
      description: "Spreadsheet and document generation support.",
    },
    {
      libraryKey: "spring-web",
      ecosystem: "MAVEN",
      groupId: "org.springframework",
      artifactId: "spring-web",
      version: "6.2.5",
      scope: "compile",
      description: "HTTP and webhook orchestration support for automatic tasks.",
    },
  ],
  npm: [],
});

const BUILTIN_AUTOMATIC_TASK_TYPES = Object.freeze([
  {
    taskTypeKey: "core.echo",
    kind: "BUILTIN",
    category: "utility",
    displayName: "Echo payload",
    description:
      "Returns mapped input payload for quick bootstrap, smoke tests, and pipeline checks.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        includeInput: { type: "boolean" },
      },
    },
    inputContract: {
      allowedSourceTypes: [
        "PROCESS_CONTEXT",
        "PREVIOUS_ACTIVITY",
        "SHARED_DATA",
        "BACKEND_SERVICE",
        "EXTERNAL_SERVICE",
      ],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["payload.* -> context.*"],
    },
    dependencies: [],
    enabled: true,
  },
  {
    taskTypeKey: "core.email.send",
    kind: "BUILTIN",
    category: "communication",
    displayName: "Send email",
    description:
      "Sends a transactional email to one or multiple recipients resolved from configuration and mapped input data.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["template"],
      properties: {
        to: { type: "array" },
        toFromInputPath: { type: "string" },
        subject: { type: "string" },
        subjectFromInputPath: { type: "string" },
        template: { type: "string" },
        smtpProfile: { type: "string" },
        dataFromInputPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: [
        "PROCESS_CONTEXT",
        "PREVIOUS_ACTIVITY",
        "SHARED_DATA",
        "BACKEND_SERVICE",
        "EXTERNAL_SERVICE",
      ],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["deliveryId -> context.notifications.lastDeliveryId"],
    },
    dependencies: ["spring-boot-mail"],
    enabled: true,
  },
  {
    taskTypeKey: "core.email.broadcast",
    kind: "BUILTIN",
    category: "communication",
    displayName: "Broadcast email",
    description: "Broadcasts an email to a resolved recipient list with optional batching metadata.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["template"],
      properties: {
        recipientListFromInputPath: { type: "string" },
        subject: { type: "string" },
        template: { type: "string" },
        batchSize: { type: "integer" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "SHARED_DATA", "BACKEND_SERVICE", "EXTERNAL_SERVICE"],
      minSources: 1,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["recipientsCount -> context.notifications.recipientsCount"],
    },
    dependencies: ["spring-boot-mail"],
    enabled: true,
  },
  {
    taskTypeKey: "core.document.generate",
    kind: "BUILTIN",
    category: "document",
    displayName: "Generate document",
    description: "Builds a document payload from a template and mapped business data.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["template"],
      properties: {
        template: { type: "string" },
        fileName: { type: "string" },
        format: { type: "string", enum: ["TEXT", "JSON"] },
        dataFromInputPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: [
        "PROCESS_CONTEXT",
        "PREVIOUS_ACTIVITY",
        "SHARED_DATA",
        "BACKEND_SERVICE",
        "EXTERNAL_SERVICE",
      ],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "BOTH",
      mappingHints: [
        "document.content -> shared.documents.latest.content",
        "document.fileName -> shared.documents.latest.fileName",
      ],
    },
    dependencies: ["apache-poi-ooxml"],
    enabled: true,
  },
  {
    taskTypeKey: "core.data.delete",
    kind: "BUILTIN",
    category: "data",
    displayName: "Delete data",
    description:
      "Deletes context/shared data keys using explicit target paths and optional entity filters.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      properties: {
        contextPaths: { type: "array" },
        sharedEntityKeys: { type: "array" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "SHARED_DATA"],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["deletedCount -> context.cleanup.deletedCount"],
    },
    dependencies: [],
    enabled: true,
  },
  {
    taskTypeKey: "core.data.transform",
    kind: "BUILTIN",
    category: "data",
    displayName: "Transform data",
    description: "Applies merge/rename transformations to mapped payload sections.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["MERGE", "RENAME", "PICK"] },
        fromPath: { type: "string" },
        toPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "PREVIOUS_ACTIVITY", "SHARED_DATA"],
      minSources: 1,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["result.* -> context.transform.*"],
    },
    dependencies: [],
    enabled: true,
  },
  {
    taskTypeKey: "core.http.request",
    kind: "BUILTIN",
    category: "integration",
    displayName: "HTTP request",
    description: "Calls an external HTTP endpoint based on resolved configuration and payload mappings.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
        headers: { type: "object" },
        payloadFromInputPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "PREVIOUS_ACTIVITY", "SHARED_DATA", "BACKEND_SERVICE"],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["response.status -> context.http.lastStatus"],
    },
    dependencies: ["spring-web"],
    enabled: true,
  },
  {
    taskTypeKey: "core.webhook.emit",
    kind: "BUILTIN",
    category: "integration",
    displayName: "Emit webhook",
    description: "Sends a webhook event payload to one endpoint with signature metadata.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string" },
        eventName: { type: "string" },
        secretRef: { type: "string" },
        payloadFromInputPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "PREVIOUS_ACTIVITY", "SHARED_DATA"],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["delivery.status -> context.webhooks.lastStatus"],
    },
    dependencies: ["spring-web"],
    enabled: true,
  },
  {
    taskTypeKey: "core.wait.delay",
    kind: "BUILTIN",
    category: "control-flow",
    displayName: "Delay / wait",
    description: "Creates a scheduled delay marker before continuing process execution.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      properties: {
        delaySeconds: { type: "integer" },
        reason: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT"],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["scheduledAt -> context.runtime.delay.scheduledAt"],
    },
    dependencies: [],
    enabled: true,
  },
  {
    taskTypeKey: "core.notification.emit",
    kind: "BUILTIN",
    category: "communication",
    displayName: "Emit internal notification",
    description: "Produces an in-app notification payload for one or many users.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        level: { type: "string", enum: ["INFO", "WARNING", "ERROR"] },
        recipientsFromInputPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "PREVIOUS_ACTIVITY", "SHARED_DATA"],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["notificationsCount -> context.notifications.internalCount"],
    },
    dependencies: [],
    enabled: true,
  },
  {
    taskTypeKey: "core.audit.log",
    kind: "BUILTIN",
    category: "observability",
    displayName: "Audit log event",
    description: "Emits a structured process event for monitoring and process mining.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      required: ["eventName"],
      properties: {
        eventName: { type: "string" },
        category: { type: "string" },
        detailsFromInputPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: [
        "PROCESS_CONTEXT",
        "PREVIOUS_ACTIVITY",
        "SHARED_DATA",
        "BACKEND_SERVICE",
        "EXTERNAL_SERVICE",
      ],
      minSources: 0,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["audit.eventId -> context.audit.lastEventId"],
    },
    dependencies: [],
    enabled: true,
  },
  {
    taskTypeKey: "core.json.merge",
    kind: "BUILTIN",
    category: "data",
    displayName: "Merge JSON objects",
    description:
      "Merges mapped payload fragments into one object before output mapping and storage.",
    runtimeBehavior: "BUILTIN",
    configurationSchema: {
      type: "object",
      properties: {
        sourcePaths: { type: "array" },
        targetPath: { type: "string" },
      },
    },
    inputContract: {
      allowedSourceTypes: ["PROCESS_CONTEXT", "PREVIOUS_ACTIVITY", "SHARED_DATA"],
      minSources: 1,
    },
    outputContract: {
      defaultStorage: "INSTANCE",
      mappingHints: ["merged -> context.merge.result"],
    },
    dependencies: [],
    enabled: true,
  },
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function assertProjectRelativePath(relativePath, fieldName = "path") {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/").filter(Boolean);
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized) || segments.includes("..")) {
    throw new Error(`${fieldName} must stay within project root.`);
  }
  return normalized;
}

function resolveProjectPath(rootDir, relativePath) {
  const safeRelativePath = assertProjectRelativePath(relativePath, "path");
  const resolvedRoot = path.resolve(rootDir);
  const absolutePath = path.resolve(rootDir, safeRelativePath);
  if (absolutePath === resolvedRoot) {
    return absolutePath;
  }
  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes project root: ${relativePath}`);
  }
  return absolutePath;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTaskTypeKey(value) {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[a-z][a-z0-9._-]{2,95}$/.test(normalized)) {
    throw new Error("taskTypeKey must match [a-z][a-z0-9._-]{2,95}.");
  }
  return normalized;
}

function normalizeTaskKind(value, fallback = "CUSTOM") {
  const normalized = normalizeString(value).toUpperCase() || fallback;
  if (!AUTOMATIC_TASK_KIND_VALUES.includes(normalized)) {
    throw new Error(`Unsupported task type kind '${value}'.`);
  }
  return normalized;
}

function normalizeLibraryKey(value) {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new Error("libraryKey is required.");
  }
  return normalized;
}

function normalizeLibraryEcosystem(value) {
  const normalized = normalizeString(value).toUpperCase() || "MAVEN";
  if (!LIBRARY_ECOSYSTEM_VALUES.includes(normalized)) {
    throw new Error(`Unsupported library ecosystem '${value}'.`);
  }
  return normalized;
}

function normalizeMavenCoordinates(value) {
  return normalizeString(value).replace(/\s+/g, "");
}

function inferDefaultCustomSourcePath(taskTypeKey) {
  return normalizePath(
    path.posix.join(
      AUTOMATIC_TASK_SOURCE_ROOT,
      taskTypeKey.replace(/[.]+/g, "/"),
      "handler.java",
    ),
  );
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTaskTypeRecord(rawRecord = {}, options = {}) {
  const source = rawRecord && typeof rawRecord === "object" && !Array.isArray(rawRecord)
    ? rawRecord
    : {};
  const taskTypeKey = normalizeTaskTypeKey(source.taskTypeKey || options.taskTypeKey);
  const kind = normalizeTaskKind(source.kind || options.kind || "CUSTOM");
  const enabled = normalizeBoolean(source.enabled, true);
  const dependencies = ensureArray(source.dependencies)
    .map((entry) => normalizeLibraryKey(entry))
    .filter(Boolean);
  const dependencySet = new Set();
  const normalizedDependencies = [];
  for (const dependency of dependencies) {
    if (dependencySet.has(dependency)) {
      continue;
    }
    dependencySet.add(dependency);
    normalizedDependencies.push(dependency);
  }

  const sourcePath = kind === "CUSTOM"
    ? assertProjectRelativePath(
      source.sourcePath || inferDefaultCustomSourcePath(taskTypeKey),
      "sourcePath",
    )
    : null;

  const configurationSchema = source.configurationSchema && typeof source.configurationSchema === "object" && !Array.isArray(source.configurationSchema)
    ? source.configurationSchema
    : { type: "object", properties: {} };
  const inputContract = source.inputContract && typeof source.inputContract === "object" && !Array.isArray(source.inputContract)
    ? source.inputContract
    : {};
  const outputContract = source.outputContract && typeof source.outputContract === "object" && !Array.isArray(source.outputContract)
    ? source.outputContract
    : {};

  return {
    taskTypeKey,
    kind,
    category: normalizeString(source.category || "custom"),
    displayName: normalizeString(source.displayName || taskTypeKey),
    description: normalizeString(source.description),
    runtimeBehavior: normalizeString(source.runtimeBehavior || (kind === "BUILTIN" ? "BUILTIN" : "CUSTOM_JAVA")),
    configurationSchema,
    inputContract,
    outputContract,
    dependencies: normalizedDependencies,
    sourcePath,
    enabled,
    createdAt: normalizeString(source.createdAt) || null,
    updatedAt: normalizeString(source.updatedAt) || null,
  };
}

function normalizeMavenLibraryRecord(rawRecord = {}) {
  const source = rawRecord && typeof rawRecord === "object" && !Array.isArray(rawRecord)
    ? rawRecord
    : {};
  const ecosystem = normalizeLibraryEcosystem(source.ecosystem || "MAVEN");
  const groupId = normalizeMavenCoordinates(source.groupId);
  const artifactId = normalizeMavenCoordinates(source.artifactId);
  const version = normalizeMavenCoordinates(source.version);
  const scope = normalizeString(source.scope || "compile").toLowerCase() || "compile";
  const libraryKey = normalizeLibraryKey(
    source.libraryKey || `${groupId}:${artifactId}`,
  );
  if (!groupId || !artifactId || !version) {
    throw new Error("Maven library entry requires groupId, artifactId, and version.");
  }

  return {
    libraryKey,
    ecosystem,
    groupId,
    artifactId,
    version,
    scope,
    description: normalizeString(source.description),
  };
}

function normalizeNpmLibraryRecord(rawRecord = {}) {
  const source = rawRecord && typeof rawRecord === "object" && !Array.isArray(rawRecord)
    ? rawRecord
    : {};
  const ecosystem = normalizeLibraryEcosystem(source.ecosystem || "NPM");
  const packageName = normalizeString(source.packageName || source.name);
  const version = normalizeString(source.version);
  const libraryKey = normalizeLibraryKey(source.libraryKey || packageName);
  if (!packageName || !version) {
    throw new Error("NPM library entry requires packageName and version.");
  }

  return {
    libraryKey,
    ecosystem,
    packageName,
    version,
    description: normalizeString(source.description),
  };
}

function normalizeLibraryCatalog(rawCatalog = {}) {
  const source = rawCatalog && typeof rawCatalog === "object" && !Array.isArray(rawCatalog)
    ? rawCatalog
    : {};
  const mavenRows = ensureArray(source.maven).map((entry) => normalizeMavenLibraryRecord(entry));
  const npmRows = ensureArray(source.npm).map((entry) => normalizeNpmLibraryRecord(entry));

  const keyIndex = new Map();
  const mavenCoordinatesIndex = new Map();
  const conflicts = [];

  for (const row of [...mavenRows, ...npmRows]) {
    if (keyIndex.has(row.libraryKey)) {
      conflicts.push({
        type: "DUPLICATE_LIBRARY_KEY",
        libraryKey: row.libraryKey,
      });
    }
    keyIndex.set(row.libraryKey, row);
  }

  for (const row of mavenRows) {
    const coordinate = `${row.groupId}:${row.artifactId}`;
    if (mavenCoordinatesIndex.has(coordinate) && mavenCoordinatesIndex.get(coordinate) !== row.version) {
      conflicts.push({
        type: "MAVEN_COORDINATE_VERSION_CLASH",
        coordinate,
        versions: [mavenCoordinatesIndex.get(coordinate), row.version],
      });
    } else {
      mavenCoordinatesIndex.set(coordinate, row.version);
    }
  }

  return {
    maven: mavenRows.sort((left, right) => left.libraryKey.localeCompare(right.libraryKey)),
    npm: npmRows.sort((left, right) => left.libraryKey.localeCompare(right.libraryKey)),
    conflicts,
  };
}

function defaultCatalogSnapshot() {
  return {
    schemaVersion: AUTOMATIC_TASK_CATALOG_SCHEMA_VERSION,
    generatedBy: "ProOWeb",
    updatedAt: new Date().toISOString(),
    taskTypes: BUILTIN_AUTOMATIC_TASK_TYPES.map((entry) => ({
      ...cloneJson(entry),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourcePath: null,
    })),
    libraries: cloneJson(DEFAULT_LIBRARY_CATALOG),
  };
}

function readCatalogRaw(rootDir) {
  const catalogPath = resolveProjectPath(rootDir, AUTOMATIC_TASK_CATALOG_INDEX_PATH);
  if (!fs.existsSync(catalogPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch (_) {
    return null;
  }
}

function writeCatalogRaw(rootDir, payload) {
  const catalogPath = resolveProjectPath(rootDir, AUTOMATIC_TASK_CATALOG_INDEX_PATH);
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function ensureCatalogPersistence(rootDir) {
  const existing = readCatalogRaw(rootDir);
  if (existing) {
    return existing;
  }
  const defaults = defaultCatalogSnapshot();
  writeCatalogRaw(rootDir, defaults);
  return defaults;
}

function normalizeCatalog(rawCatalog) {
  const source = rawCatalog && typeof rawCatalog === "object" && !Array.isArray(rawCatalog)
    ? rawCatalog
    : defaultCatalogSnapshot();
  const taskTypesSource = ensureArray(source.taskTypes);
  const normalizedTaskTypes = [];
  const taskTypeByKey = new Map();
  const duplicateTaskTypeKeys = [];

  for (const row of taskTypesSource) {
    const normalized = normalizeTaskTypeRecord(row);
    if (taskTypeByKey.has(normalized.taskTypeKey)) {
      duplicateTaskTypeKeys.push(normalized.taskTypeKey);
      continue;
    }
    taskTypeByKey.set(normalized.taskTypeKey, normalized);
    normalizedTaskTypes.push(normalized);
  }

  for (const builtin of BUILTIN_AUTOMATIC_TASK_TYPES) {
    const key = builtin.taskTypeKey;
    if (taskTypeByKey.has(key)) {
      const existing = taskTypeByKey.get(key);
      taskTypeByKey.set(
        key,
        {
          ...existing,
          kind: "BUILTIN",
          runtimeBehavior: "BUILTIN",
          sourcePath: null,
          configurationSchema: existing.configurationSchema || cloneJson(builtin.configurationSchema),
          inputContract: existing.inputContract || cloneJson(builtin.inputContract),
          outputContract: existing.outputContract || cloneJson(builtin.outputContract),
          dependencies: Array.isArray(existing.dependencies) && existing.dependencies.length > 0
            ? existing.dependencies
            : cloneJson(builtin.dependencies || []),
        },
      );
    } else {
      taskTypeByKey.set(
        key,
        normalizeTaskTypeRecord({
          ...builtin,
          sourcePath: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { kind: "BUILTIN" }),
      );
    }
  }

  const taskTypes = Array.from(taskTypeByKey.values())
    .sort((left, right) => left.taskTypeKey.localeCompare(right.taskTypeKey));
  const libraries = normalizeLibraryCatalog(source.libraries || DEFAULT_LIBRARY_CATALOG);

  return {
    schemaVersion: AUTOMATIC_TASK_CATALOG_SCHEMA_VERSION,
    generatedBy: "ProOWeb",
    updatedAt: normalizeString(source.updatedAt) || new Date().toISOString(),
    taskTypes,
    libraries: {
      maven: libraries.maven,
      npm: libraries.npm,
    },
    diagnostics: {
      duplicateTaskTypeKeys,
      libraryConflicts: libraries.conflicts,
    },
  };
}

function ensureSourceFile(rootDir, sourcePath, defaultContent = "") {
  const absolutePath = resolveProjectPath(rootDir, sourcePath);
  if (fs.existsSync(absolutePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, defaultContent, "utf8");
}

function buildDefaultCustomHandlerSource(taskTypeKey) {
  return `// ProOWeb custom automatic task handler body for '${taskTypeKey}'.
// Available variables:
// - Map<String, Object> inputData
// - Map<String, Object> configuration
// - ProcessRuntimeInstance instance
// - GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor
// - Map<String, Object> output
output.put("status", "CUSTOM_NOT_IMPLEMENTED");
output.put("taskTypeKey", "${taskTypeKey}");
return output;
`;
}

function readAutomaticTaskCatalog(rootDir, options = {}) {
  const includeSources = Boolean(options.includeSources);
  const raw = ensureCatalogPersistence(rootDir);
  const catalog = normalizeCatalog(raw);

  for (const taskType of catalog.taskTypes) {
    if (taskType.kind !== "CUSTOM" || !taskType.sourcePath) {
      continue;
    }
    ensureSourceFile(
      rootDir,
      taskType.sourcePath,
      buildDefaultCustomHandlerSource(taskType.taskTypeKey),
    );
    if (includeSources) {
      const absoluteSourcePath = resolveProjectPath(rootDir, taskType.sourcePath);
      taskType.source = fs.readFileSync(absoluteSourcePath, "utf8");
    }
  }

  return catalog;
}

function assertLibraryReferences(catalog) {
  const libraryKeys = new Set([
    ...(catalog?.libraries?.maven || []).map((entry) => entry.libraryKey),
    ...(catalog?.libraries?.npm || []).map((entry) => entry.libraryKey),
  ]);
  const unknownDependencies = [];
  for (const taskType of catalog?.taskTypes || []) {
    for (const dependency of taskType.dependencies || []) {
      if (!libraryKeys.has(dependency)) {
        unknownDependencies.push({
          taskTypeKey: taskType.taskTypeKey,
          dependency,
        });
      }
    }
  }
  return unknownDependencies;
}

function saveAutomaticTaskCatalog(rootDir, payload = {}) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {};
  const catalog = normalizeCatalog({
    ...source,
    updatedAt: new Date().toISOString(),
  });

  if (Array.isArray(catalog.diagnostics?.libraryConflicts) && catalog.diagnostics.libraryConflicts.length > 0) {
    const details = catalog.diagnostics.libraryConflicts
      .map((entry) => `${entry.type}:${entry.coordinate || entry.libraryKey || "-"}`)
      .join(", ");
    throw new Error(`Library version conflicts detected: ${details}`);
  }

  const unknownDependencies = assertLibraryReferences(catalog);
  if (unknownDependencies.length > 0) {
    const details = unknownDependencies
      .map((entry) => `${entry.taskTypeKey} -> ${entry.dependency}`)
      .join(", ");
    throw new Error(`Unknown library references in automatic task catalog: ${details}`);
  }

  for (const taskType of catalog.taskTypes) {
    if (taskType.kind !== "CUSTOM" || !taskType.sourcePath) {
      continue;
    }
    ensureSourceFile(
      rootDir,
      taskType.sourcePath,
      buildDefaultCustomHandlerSource(taskType.taskTypeKey),
    );
  }

  writeCatalogRaw(rootDir, {
    schemaVersion: catalog.schemaVersion,
    generatedBy: catalog.generatedBy,
    updatedAt: catalog.updatedAt,
    taskTypes: catalog.taskTypes,
    libraries: catalog.libraries,
  });

  return readAutomaticTaskCatalog(rootDir, { includeSources: false });
}

function findAutomaticTaskType(catalog, taskTypeKey) {
  const normalizedKey = normalizeTaskTypeKey(taskTypeKey);
  const taskType = (catalog?.taskTypes || []).find((entry) => entry.taskTypeKey === normalizedKey) || null;
  return {
    taskTypeKey: normalizedKey,
    taskType,
  };
}

function readAutomaticTaskTypeSource(rootDir, taskTypeKey) {
  const catalog = readAutomaticTaskCatalog(rootDir, { includeSources: false });
  const match = findAutomaticTaskType(catalog, taskTypeKey);
  if (!match.taskType) {
    const error = new Error(`Automatic task type '${match.taskTypeKey}' not found.`);
    error.statusCode = 404;
    throw error;
  }
  if (match.taskType.kind !== "CUSTOM") {
    const error = new Error(`Automatic task type '${match.taskTypeKey}' is built-in and has no editable source file.`);
    error.statusCode = 409;
    throw error;
  }

  ensureSourceFile(
    rootDir,
    match.taskType.sourcePath,
    buildDefaultCustomHandlerSource(match.taskType.taskTypeKey),
  );
  const absoluteSourcePath = resolveProjectPath(rootDir, match.taskType.sourcePath);
  return {
    taskTypeKey: match.taskType.taskTypeKey,
    sourcePath: match.taskType.sourcePath,
    source: fs.readFileSync(absoluteSourcePath, "utf8"),
    updatedAt: match.taskType.updatedAt,
  };
}

function saveAutomaticTaskTypeSource(rootDir, taskTypeKey, sourceCode) {
  const catalog = readAutomaticTaskCatalog(rootDir, { includeSources: false });
  const match = findAutomaticTaskType(catalog, taskTypeKey);
  if (!match.taskType) {
    const error = new Error(`Automatic task type '${match.taskTypeKey}' not found.`);
    error.statusCode = 404;
    throw error;
  }
  if (match.taskType.kind !== "CUSTOM") {
    const error = new Error(`Automatic task type '${match.taskTypeKey}' is built-in and cannot be edited from source.`);
    error.statusCode = 409;
    throw error;
  }

  const sourcePath = match.taskType.sourcePath || inferDefaultCustomSourcePath(match.taskType.taskTypeKey);
  const absoluteSourcePath = resolveProjectPath(rootDir, sourcePath);
  fs.mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  fs.writeFileSync(absoluteSourcePath, String(sourceCode ?? ""), "utf8");

  const now = new Date().toISOString();
  const nextTaskTypes = (catalog.taskTypes || []).map((entry) =>
    entry.taskTypeKey === match.taskTypeKey
      ? {
        ...entry,
        sourcePath,
        updatedAt: now,
      }
      : entry);
  writeCatalogRaw(rootDir, {
    schemaVersion: catalog.schemaVersion,
    generatedBy: catalog.generatedBy,
    updatedAt: now,
    taskTypes: nextTaskTypes,
    libraries: catalog.libraries,
  });

  return {
    taskTypeKey: match.taskTypeKey,
    sourcePath,
    updatedAt: now,
  };
}

function buildAutomaticTaskTypeLookup(catalog) {
  const map = new Map();
  for (const taskType of catalog?.taskTypes || []) {
    map.set(taskType.taskTypeKey, taskType);
  }
  return map;
}

module.exports = {
  AUTOMATIC_TASK_CATALOG_SCHEMA_VERSION,
  AUTOMATIC_TASK_CATALOG_INDEX_PATH,
  AUTOMATIC_TASK_SOURCE_ROOT,
  AUTOMATIC_TASK_KIND_VALUES,
  LIBRARY_ECOSYSTEM_VALUES,
  BUILTIN_AUTOMATIC_TASK_TYPES,
  normalizeTaskTypeKey,
  normalizeTaskKind,
  normalizeLibraryKey,
  readAutomaticTaskCatalog,
  saveAutomaticTaskCatalog,
  readAutomaticTaskTypeSource,
  saveAutomaticTaskTypeSource,
  buildAutomaticTaskTypeLookup,
};
