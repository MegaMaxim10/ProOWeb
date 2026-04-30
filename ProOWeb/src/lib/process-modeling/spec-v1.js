const SPECIFICATION_SCHEMA_VERSION = 1;

const ACTIVITY_TYPE_VALUES = Object.freeze(["MANUAL", "AUTOMATIC"]);
const ASSIGNMENT_MODE_VALUES = Object.freeze(["AUTOMATIC", "MANUAL"]);
const ASSIGNMENT_STRATEGY_VALUES = Object.freeze([
  "ROLE_QUEUE",
  "SUPERVISOR_ONLY",
  "SUPERVISOR_THEN_ANCESTORS",
  "UNIT_MEMBERS",
  "SINGLE_MATCH_ONLY",
  "MANUAL_ONLY",
  "ROUND_ROBIN",
]);
const AUTOMATIC_TRIGGER_MODE_VALUES = Object.freeze(["MANUAL_TRIGGER", "IMMEDIATE", "DEFERRED"]);
const INPUT_SOURCE_TYPE_VALUES = Object.freeze([
  "PREVIOUS_ACTIVITY",
  "PROCESS_CONTEXT",
  "SHARED_DATA",
  "BACKEND_SERVICE",
  "EXTERNAL_SERVICE",
]);
const OUTPUT_STORAGE_VALUES = Object.freeze(["INSTANCE", "SHARED", "BOTH"]);
const SHARED_ENTITY_FIELD_TYPE_VALUES = Object.freeze([
  "STRING",
  "TEXT",
  "INTEGER",
  "LONG",
  "DECIMAL",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "JSON",
  "UUID",
]);
const SHARED_ENTITY_RELATION_TYPE_VALUES = Object.freeze([
  "MANY_TO_ONE",
  "ONE_TO_MANY",
  "ONE_TO_ONE",
  "MANY_TO_MANY",
]);
const DEFAULT_AUTOMATIC_TASK_TYPE_KEY = "core.echo";
const SHARED_DATA_PATH_PREFIXES = Object.freeze([
  "shared.",
  "shared_data.",
  "shareddata.",
]);

const BPMN_ACTIVITY_TAGS = Object.freeze([
  "task",
  "userTask",
  "manualTask",
  "serviceTask",
  "scriptTask",
  "businessRuleTask",
  "sendTask",
  "receiveTask",
  "callActivity",
  "subProcess",
]);

const AUTOMATIC_ACTIVITY_TAGS = new Set([
  "serviceTask",
  "scriptTask",
  "businessRuleTask",
  "sendTask",
  "receiveTask",
  "callActivity",
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeBoolean(value, fallback = false) {
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

function pushIssue(target, path, message) {
  target.push({
    path,
    message,
  });
}

function normalizeRoleCode(value) {
  return normalizeString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeEntityKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isValidEntityKey(value) {
  return /^[a-z0-9][a-z0-9._-]{1,63}$/.test(String(value || ""));
}

function normalizeSharedFieldName(value) {
  return normalizeString(value).replace(/[^a-zA-Z0-9_]+/g, "_");
}

function isValidSharedFieldName(value) {
  return /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(String(value || ""));
}

function toDefaultSharedTableName(entityKey) {
  const normalized = String(entityKey || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized || "entity";
  const prefixed = `shared_${base}`.slice(0, 63);
  return prefixed.replace(/_+$/g, "") || "shared_entity";
}

function isValidTableName(value) {
  return /^[a-z][a-z0-9_]{1,62}$/.test(String(value || ""));
}

function toDefaultJoinColumnName(relationName) {
  const normalized = normalizeString(relationName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized || "related";
  const prefixed = `${base}_id`.slice(0, 63);
  return prefixed.replace(/_+$/g, "") || "related_id";
}

function toDefaultJoinTableName(sourceEntityKey, relationName, targetEntityKey) {
  const left = normalizeString(sourceEntityKey)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const middle = normalizeString(relationName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const right = normalizeString(targetEntityKey)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const value = `shared_rel_${left || "source"}_${middle || "rel"}_${right || "target"}`;
  const truncated = value.slice(0, 63);
  return truncated.replace(/_+$/g, "") || "shared_rel_source_target";
}

function isValidRoleCode(value) {
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(String(value || ""));
}

function normalizeRoleList(rawValue, path, errors, fallback = []) {
  const source = Array.isArray(rawValue) ? rawValue : fallback;
  const normalized = [];
  const seen = new Set();

  for (const entry of source) {
    const role = normalizeRoleCode(entry);
    if (!role) {
      continue;
    }

    if (!isValidRoleCode(role)) {
      pushIssue(errors, path, `Invalid role code '${entry}'. Expected uppercase role code, e.g. PROCESS_MONITOR.`);
      continue;
    }

    if (seen.has(role)) {
      continue;
    }
    seen.add(role);
    normalized.push(role);
  }

  return normalized;
}

function normalizeEnum(value, allowedValues, fallback, path, errors) {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) {
    return fallback;
  }

  if (!allowedValues.includes(normalized)) {
    pushIssue(
      errors,
      path,
      `Invalid value '${value}'. Allowed values: ${allowedValues.join(", ")}.`,
    );
    return fallback;
  }

  return normalized;
}

function normalizeJsonObject(value, fallback = {}) {
  const source = asObject(value);
  if (!source) {
    return { ...fallback };
  }
  return JSON.parse(JSON.stringify(source));
}

function validateConfigurationAgainstSchema(configuration, schema, path, errors) {
  const config = asObject(configuration) || {};
  const schemaObject = asObject(schema) || {};
  const required = Array.isArray(schemaObject.required) ? schemaObject.required : [];
  const properties = asObject(schemaObject.properties) || {};

  for (const propertyName of required) {
    const normalizedName = normalizeString(propertyName);
    if (!normalizedName) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(config, normalizedName)) {
      pushIssue(
        errors,
        `${path}.configuration.${normalizedName}`,
        `Missing required configuration key '${normalizedName}'.`,
      );
    }
  }

  for (const [propertyName, value] of Object.entries(config)) {
    const propertySchema = asObject(properties[propertyName]) || {};
    const expectedType = normalizeString(propertySchema.type).toLowerCase();
    const enumValues = Array.isArray(propertySchema.enum) ? propertySchema.enum : null;

    if (expectedType === "string" && typeof value !== "string") {
      pushIssue(errors, `${path}.configuration.${propertyName}`, `Expected string for '${propertyName}'.`);
      continue;
    }
    if (expectedType === "number" && typeof value !== "number") {
      pushIssue(errors, `${path}.configuration.${propertyName}`, `Expected number for '${propertyName}'.`);
      continue;
    }
    if (expectedType === "integer" && (!Number.isInteger(value))) {
      pushIssue(errors, `${path}.configuration.${propertyName}`, `Expected integer for '${propertyName}'.`);
      continue;
    }
    if (expectedType === "boolean" && typeof value !== "boolean") {
      pushIssue(errors, `${path}.configuration.${propertyName}`, `Expected boolean for '${propertyName}'.`);
      continue;
    }
    if (expectedType === "array" && !Array.isArray(value)) {
      pushIssue(errors, `${path}.configuration.${propertyName}`, `Expected array for '${propertyName}'.`);
      continue;
    }
    if (expectedType === "object" && !asObject(value)) {
      pushIssue(errors, `${path}.configuration.${propertyName}`, `Expected object for '${propertyName}'.`);
      continue;
    }
    if (enumValues && enumValues.length > 0) {
      const contains = enumValues.some((entry) => String(entry) === String(value));
      if (!contains) {
        pushIssue(
          errors,
          `${path}.configuration.${propertyName}`,
          `Invalid value for '${propertyName}'. Allowed values: ${enumValues.join(", ")}.`,
        );
      }
    }
  }
}

function toPositiveInteger(value, fallback, path, errors) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numeric = Number.parseInt(String(value), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    pushIssue(errors, path, "Expected a positive integer.");
    return fallback;
  }

  return numeric;
}

function extractTagAttribute(tagSource, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`, "i");
  const match = String(tagSource || "").match(pattern);
  if (!match) {
    return "";
  }

  return match[1] || match[2] || "";
}

function extractBpmnActivities(bpmnXml) {
  const xml = String(bpmnXml || "");
  const map = new Map();
  const pattern = /<(?:[A-Za-z0-9_-]+:)?(task|userTask|manualTask|serviceTask|scriptTask|businessRuleTask|sendTask|receiveTask|callActivity|subProcess)\b[^>]*>/g;
  let match = pattern.exec(xml);
  while (match) {
    const tagName = match[1];
    const fullTag = match[0];
    const elementId = extractTagAttribute(fullTag, "id");
    if (elementId && !map.has(elementId)) {
      map.set(elementId, {
        activityId: elementId,
        tagName,
      });
    }
    match = pattern.exec(xml);
  }

  return map;
}

function toHandlerRef(activityId) {
  const normalized = String(activityId || "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((entry, index) =>
      index === 0
        ? entry.toLowerCase()
        : entry.charAt(0).toUpperCase() + entry.slice(1).toLowerCase())
    .join("");

  return `handlers.${normalized || "activityHandler"}`;
}

function buildDefaultActivitySpec(activityId, tagName) {
  const isAutomatic = AUTOMATIC_ACTIVITY_TAGS.has(String(tagName || ""));

  return {
    activityType: isAutomatic ? "AUTOMATIC" : "MANUAL",
    candidateRoles: ["PROCESS_USER"],
    assignment: {
      mode: "AUTOMATIC",
      strategy: isAutomatic ? "SINGLE_MATCH_ONLY" : "ROLE_QUEUE",
      allowPreviouslyAssignedAssignee: true,
      manualAssignerRoles: ["PROCESS_MONITOR", "ADMINISTRATOR"],
      maxAssignees: 1,
    },
    automaticExecution: isAutomatic
      ? {
          handlerRef: toHandlerRef(activityId),
          taskTypeKey: DEFAULT_AUTOMATIC_TASK_TYPE_KEY,
          triggerMode: "MANUAL_TRIGGER",
          deferredDelayMinutes: null,
          configuration: {},
        }
      : null,
    input: {
      sources: [],
    },
    output: {
      storage: "INSTANCE",
      mappings: [],
    },
    visibility: {
      activityViewerRoles: ["PROCESS_USER", "PROCESS_MONITOR", "ADMINISTRATOR"],
      dataViewerRoles: ["PROCESS_USER", "PROCESS_MONITOR", "ADMINISTRATOR"],
    },
  };
}

function normalizeMappingList(rawMappings, path, errors) {
  const source = Array.isArray(rawMappings) ? rawMappings : [];
  const normalized = [];

  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    const entryPath = `${path}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      pushIssue(errors, entryPath, "Mapping must be an object.");
      continue;
    }

    const from = normalizeString(entry.from);
    const to = normalizeString(entry.to);
    if (!from || !to) {
      pushIssue(errors, entryPath, "Mapping requires both 'from' and 'to'.");
      continue;
    }

    normalized.push({
      from,
      to,
    });
  }

  return normalized;
}

function normalizeInputSources(rawSources, path, errors) {
  const source = Array.isArray(rawSources) ? rawSources : [];
  const normalized = [];

  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    const entryPath = `${path}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      pushIssue(errors, entryPath, "Input source must be an object.");
      continue;
    }

    const sourceType = normalizeEnum(
      entry.sourceType,
      INPUT_SOURCE_TYPE_VALUES,
      "PROCESS_CONTEXT",
      `${entryPath}.sourceType`,
      errors,
    );
    const sourceRef = normalizeString(entry.sourceRef);
    const mappings = normalizeMappingList(entry.mappings, `${entryPath}.mappings`, errors);

    normalized.push({
      sourceType,
      sourceRef,
      mappings,
    });
  }

  return normalized;
}

function resolveSharedTargetPath(pathValue) {
  const raw = normalizeString(pathValue);
  if (!raw) {
    return null;
  }

  const lowered = raw.toLowerCase();
  let stripped = "";
  for (const prefix of SHARED_DATA_PATH_PREFIXES) {
    if (lowered.startsWith(prefix)) {
      stripped = raw.slice(prefix.length);
      break;
    }
  }
  if (!stripped) {
    return null;
  }

  const clean = stripped
    .replace(/^\.+/, "")
    .replace(/\[(\d+)\]/g, "")
    .trim();
  if (!clean) {
    return null;
  }

  const separator = clean.indexOf(".");
  const entityKey = normalizeEntityKey(separator < 0 ? clean : clean.slice(0, separator));
  const fieldPath = separator < 0 ? "value" : normalizeString(clean.slice(separator + 1));
  if (!entityKey) {
    return null;
  }

  return {
    entityKey,
    fieldPath: fieldPath || "value",
  };
}

function inferSharedEntityKeyFromSource(sourceRef) {
  const sharedTarget = resolveSharedTargetPath(sourceRef);
  if (sharedTarget) {
    return sharedTarget.entityKey;
  }

  const normalized = normalizeString(sourceRef)
    .replace(/^\.+/, "")
    .replace(/\[(\d+)\]/g, "");
  const separator = normalized.search(/[.:/]/);
  if (separator < 0) {
    return normalizeEntityKey(normalized);
  }
  return normalizeEntityKey(normalized.slice(0, separator));
}

function normalizeSharedEntityFields(rawFields, path, errors) {
  const source = Array.isArray(rawFields) ? rawFields : [];
  const fields = [];
  const seenNames = new Set();

  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    const entryPath = `${path}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      pushIssue(errors, entryPath, "Shared entity field must be an object.");
      continue;
    }

    const rawName = normalizeString(entry.name);
    const name = normalizeSharedFieldName(rawName);
    if (!name) {
      pushIssue(errors, `${entryPath}.name`, "Shared entity field name is required.");
      continue;
    }
    if (!isValidSharedFieldName(name)) {
      pushIssue(
        errors,
        `${entryPath}.name`,
        `Invalid shared field name '${rawName}'. Expected [a-zA-Z][a-zA-Z0-9_]{0,63}.`,
      );
      continue;
    }
    if (seenNames.has(name)) {
      pushIssue(errors, `${entryPath}.name`, `Duplicate shared field '${name}'.`);
      continue;
    }

    seenNames.add(name);
    fields.push({
      name,
      type: normalizeEnum(
        entry.type,
        SHARED_ENTITY_FIELD_TYPE_VALUES,
        "STRING",
        `${entryPath}.type`,
        errors,
      ),
      required: normalizeBoolean(entry.required, false),
      indexed: normalizeBoolean(entry.indexed, false),
      unique: normalizeBoolean(entry.unique, false),
    });
  }

  return fields;
}

function normalizeSharedEntityRelations(rawRelations, path, errors, sourceEntity, knownEntityKeys) {
  const source = Array.isArray(rawRelations) ? rawRelations : [];
  const relations = [];
  const seenNames = new Set();
  const sourceFields = Array.isArray(sourceEntity?.fields)
    ? new Set(sourceEntity.fields.map((field) => field.name))
    : new Set();

  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    const entryPath = `${path}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      pushIssue(errors, entryPath, "Shared entity relation must be an object.");
      continue;
    }

    const rawName = normalizeString(
      entry.name
      || entry.relationName
      || entry.targetEntityKey
      || entry.targetEntity
      || entry.target,
    );
    const relationName = normalizeSharedFieldName(rawName);
    if (!relationName) {
      pushIssue(errors, `${entryPath}.name`, "Shared entity relation name is required.");
      continue;
    }
    if (!isValidSharedFieldName(relationName)) {
      pushIssue(
        errors,
        `${entryPath}.name`,
        `Invalid shared relation name '${rawName}'. Expected [a-zA-Z][a-zA-Z0-9_]{0,63}.`,
      );
      continue;
    }
    if (seenNames.has(relationName)) {
      pushIssue(errors, `${entryPath}.name`, `Duplicate shared relation '${relationName}'.`);
      continue;
    }
    if (sourceFields.has(relationName)) {
      pushIssue(
        errors,
        `${entryPath}.name`,
        `Relation '${relationName}' conflicts with an existing field name in entity '${sourceEntity.entityKey}'.`,
      );
      continue;
    }

    const relationType = normalizeEnum(
      entry.type,
      SHARED_ENTITY_RELATION_TYPE_VALUES,
      "MANY_TO_ONE",
      `${entryPath}.type`,
      errors,
    );

    const rawTargetEntityKey = normalizeString(entry.targetEntityKey || entry.targetEntity || entry.target || "");
    const targetEntityKey = normalizeEntityKey(rawTargetEntityKey);
    if (!targetEntityKey) {
      pushIssue(errors, `${entryPath}.targetEntityKey`, "Shared entity relation targetEntityKey is required.");
      continue;
    }
    if (!knownEntityKeys.has(targetEntityKey)) {
      pushIssue(
        errors,
        `${entryPath}.targetEntityKey`,
        `Shared relation target '${targetEntityKey}' is not modeled in sharedData.entities.`,
      );
    }

    const mappedBy = normalizeSharedFieldName(entry.mappedBy || "");
    let joinColumn = normalizeString(entry.joinColumn);
    let joinTable = normalizeString(entry.joinTable);
    let inverseJoinColumn = normalizeString(entry.inverseJoinColumn || entry.targetJoinColumn);

    if (relationType === "MANY_TO_ONE" || (relationType === "ONE_TO_ONE" && !mappedBy)) {
      joinColumn = joinColumn || toDefaultJoinColumnName(relationName);
    }
    if (relationType === "MANY_TO_MANY" && !mappedBy) {
      joinTable = joinTable || toDefaultJoinTableName(sourceEntity.entityKey, relationName, targetEntityKey);
      joinColumn = joinColumn || toDefaultJoinColumnName(sourceEntity.entityKey || "source");
      inverseJoinColumn = inverseJoinColumn || toDefaultJoinColumnName(targetEntityKey || "target");
    }

    if (joinColumn && !isValidTableName(joinColumn)) {
      pushIssue(
        errors,
        `${entryPath}.joinColumn`,
        `Invalid joinColumn '${joinColumn}'. Expected [a-z][a-z0-9_]{1,62}.`,
      );
      joinColumn = "";
    }
    if (joinTable && !isValidTableName(joinTable)) {
      pushIssue(
        errors,
        `${entryPath}.joinTable`,
        `Invalid joinTable '${joinTable}'. Expected [a-z][a-z0-9_]{1,62}.`,
      );
      joinTable = "";
    }
    if (inverseJoinColumn && !isValidTableName(inverseJoinColumn)) {
      pushIssue(
        errors,
        `${entryPath}.inverseJoinColumn`,
        `Invalid inverseJoinColumn '${inverseJoinColumn}'. Expected [a-z][a-z0-9_]{1,62}.`,
      );
      inverseJoinColumn = "";
    }

    if (relationType === "ONE_TO_MANY" && !mappedBy) {
      pushIssue(
        errors,
        `${entryPath}.mappedBy`,
        "ONE_TO_MANY relations require mappedBy to point to the owning field on target entity.",
      );
    }
    if (relationType === "MANY_TO_MANY" && mappedBy && (joinTable || joinColumn || inverseJoinColumn)) {
      pushIssue(
        errors,
        entryPath,
        "MANY_TO_MANY inverse side (mappedBy) cannot define joinTable/joinColumn/inverseJoinColumn.",
      );
    }

    seenNames.add(relationName);
    relations.push({
      name: relationName,
      type: relationType,
      targetEntityKey,
      mappedBy: mappedBy || "",
      joinColumn: joinColumn || "",
      joinTable: joinTable || "",
      inverseJoinColumn: inverseJoinColumn || "",
      required: normalizeBoolean(entry.required, false),
    });
  }

  return relations;
}

function normalizeSharedDataEntities(rawEntities, path, errors) {
  const source = Array.isArray(rawEntities) ? rawEntities : [];
  const preEntities = [];
  const seenKeys = new Set();

  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    const entryPath = `${path}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      pushIssue(errors, entryPath, "Shared entity definition must be an object.");
      continue;
    }

    const rawEntityKey = normalizeString(entry.entityKey || entry.key || entry.name);
    const entityKey = normalizeEntityKey(rawEntityKey);
    if (!entityKey) {
      pushIssue(errors, `${entryPath}.entityKey`, "sharedData entityKey is required.");
      continue;
    }
    if (!isValidEntityKey(entityKey)) {
      pushIssue(
        errors,
        `${entryPath}.entityKey`,
        `Invalid shared entityKey '${rawEntityKey}'. Expected [a-z0-9][a-z0-9._-]{1,63}.`,
      );
      continue;
    }
    if (seenKeys.has(entityKey)) {
      pushIssue(errors, `${entryPath}.entityKey`, `Duplicate shared entityKey '${entityKey}'.`);
      continue;
    }

    let tableName = normalizeString(entry.tableName);
    if (!tableName) {
      tableName = toDefaultSharedTableName(entityKey);
    }
    if (!isValidTableName(tableName)) {
      pushIssue(
        errors,
        `${entryPath}.tableName`,
        `Invalid tableName '${tableName}'. Expected lowercase SQL identifier [a-z][a-z0-9_]{1,62}.`,
      );
      tableName = toDefaultSharedTableName(entityKey);
    }

    const fields = normalizeSharedEntityFields(entry.fields, `${entryPath}.fields`, errors);
    if (fields.length === 0) {
      pushIssue(errors, `${entryPath}.fields`, "Shared entity must define at least one field.");
    }

    seenKeys.add(entityKey);
    preEntities.push({
      entityKey,
      displayName: normalizeString(entry.displayName || entry.title || entityKey) || entityKey,
      tableName,
      fields: fields.length > 0
        ? fields
        : [{
            name: "value",
            type: "JSON",
            required: false,
            indexed: false,
            unique: false,
          }],
      rawRelations: Array.isArray(entry.relations) ? entry.relations : [],
    });
  }

  const knownEntityKeys = new Set(preEntities.map((entry) => entry.entityKey));
  const entities = preEntities.map((entry, index) => ({
    entityKey: entry.entityKey,
    displayName: entry.displayName,
    tableName: entry.tableName,
    fields: entry.fields,
    relations: normalizeSharedEntityRelations(
      entry.rawRelations,
      `${path}[${index}].relations`,
      errors,
      entry,
      knownEntityKeys,
    ),
  }));

  return entities;
}

function validateSharedDataReferences({ activities, sharedEntitiesByKey, errors, warnings }) {
  const sharedEntityKeys = new Set(Array.from(sharedEntitiesByKey.keys()));
  for (const [activityId, activity] of Object.entries(activities)) {
    const inputSources = Array.isArray(activity?.input?.sources) ? activity.input.sources : [];
    for (let index = 0; index < inputSources.length; index += 1) {
      const source = inputSources[index];
      if (source.sourceType !== "SHARED_DATA") {
        continue;
      }

      const inferredEntityKey = inferSharedEntityKeyFromSource(source.sourceRef);
      if (!inferredEntityKey) {
        pushIssue(
          errors,
          `activities.${activityId}.input.sources[${index}].sourceRef`,
          "SHARED_DATA source requires a sourceRef that points to a shared entity.",
        );
        continue;
      }

      if (sharedEntityKeys.size > 0 && !sharedEntityKeys.has(inferredEntityKey)) {
        pushIssue(
          errors,
          `activities.${activityId}.input.sources[${index}].sourceRef`,
          `Shared entity '${inferredEntityKey}' was not modeled in sharedData.entities.`,
        );
      }
    }

    const outputStorage = normalizeString(activity?.output?.storage).toUpperCase();
    const outputMappings = Array.isArray(activity?.output?.mappings) ? activity.output.mappings : [];
    if ((outputStorage === "SHARED" || outputStorage === "BOTH") && outputMappings.length === 0) {
      pushIssue(
        warnings,
        `activities.${activityId}.output.mappings`,
        "Output storage targets shared data but no output mappings were configured.",
      );
    }

    if (outputStorage !== "SHARED" && outputStorage !== "BOTH") {
      continue;
    }

    for (let index = 0; index < outputMappings.length; index += 1) {
      const mapping = outputMappings[index];
      const target = resolveSharedTargetPath(mapping?.to);
      if (!target) {
        pushIssue(
          errors,
          `activities.${activityId}.output.mappings[${index}].to`,
          "Shared output mappings must target paths prefixed with shared., shared_data., or shareddata.",
        );
        continue;
      }
      if (sharedEntityKeys.size > 0 && !sharedEntityKeys.has(target.entityKey)) {
        pushIssue(
          errors,
          `activities.${activityId}.output.mappings[${index}].to`,
          `Shared entity '${target.entityKey}' was not modeled in sharedData.entities.`,
        );
      }
    }
  }
}

function normalizeActivitySpec(rawActivitySpec, defaults, context) {
  const {
    activityId,
    path,
    errors,
    warnings,
    automaticTaskTypesByKey,
  } = context;
  const source = rawActivitySpec && typeof rawActivitySpec === "object" && !Array.isArray(rawActivitySpec)
    ? rawActivitySpec
    : {};

  const activityType = normalizeEnum(
    source.activityType,
    ACTIVITY_TYPE_VALUES,
    defaults.activityType,
    `${path}.activityType`,
    errors,
  );

  const candidateRoles = normalizeRoleList(
    source.candidateRoles,
    `${path}.candidateRoles`,
    errors,
    defaults.candidateRoles,
  );

  if (activityType === "MANUAL" && candidateRoles.length === 0) {
    pushIssue(
      errors,
      `${path}.candidateRoles`,
      "Manual activity must define at least one candidate role.",
    );
  }

  const assignmentSource = source.assignment && typeof source.assignment === "object" && !Array.isArray(source.assignment)
    ? source.assignment
    : {};
  const assignment = {
    mode: normalizeEnum(
      assignmentSource.mode,
      ASSIGNMENT_MODE_VALUES,
      defaults.assignment.mode,
      `${path}.assignment.mode`,
      errors,
    ),
    strategy: normalizeEnum(
      assignmentSource.strategy,
      ASSIGNMENT_STRATEGY_VALUES,
      defaults.assignment.strategy,
      `${path}.assignment.strategy`,
      errors,
    ),
    allowPreviouslyAssignedAssignee: normalizeBoolean(
      assignmentSource.allowPreviouslyAssignedAssignee,
      defaults.assignment.allowPreviouslyAssignedAssignee,
    ),
    manualAssignerRoles: normalizeRoleList(
      assignmentSource.manualAssignerRoles,
      `${path}.assignment.manualAssignerRoles`,
      errors,
      defaults.assignment.manualAssignerRoles,
    ),
    maxAssignees: toPositiveInteger(
      assignmentSource.maxAssignees,
      defaults.assignment.maxAssignees,
      `${path}.assignment.maxAssignees`,
      errors,
    ),
  };

  if (assignment.mode === "MANUAL" && assignment.manualAssignerRoles.length === 0) {
    pushIssue(
      errors,
      `${path}.assignment.manualAssignerRoles`,
      "Manual assignment mode requires at least one manualAssignerRole.",
    );
  }

  const automaticExecutionSource =
    source.automaticExecution && typeof source.automaticExecution === "object" && !Array.isArray(source.automaticExecution)
      ? source.automaticExecution
      : {};
  const defaultAutomaticExecution = defaults.automaticExecution || {
    handlerRef: toHandlerRef(activityId),
    taskTypeKey: DEFAULT_AUTOMATIC_TASK_TYPE_KEY,
    triggerMode: "MANUAL_TRIGGER",
    deferredDelayMinutes: null,
    configuration: {},
  };
  const automaticExecution =
    activityType === "AUTOMATIC"
      ? {
          handlerRef: normalizeString(automaticExecutionSource.handlerRef || defaultAutomaticExecution.handlerRef),
          taskTypeKey: normalizeString(automaticExecutionSource.taskTypeKey || defaultAutomaticExecution.taskTypeKey || DEFAULT_AUTOMATIC_TASK_TYPE_KEY).toLowerCase(),
          triggerMode: normalizeEnum(
            automaticExecutionSource.triggerMode,
            AUTOMATIC_TRIGGER_MODE_VALUES,
            defaultAutomaticExecution.triggerMode,
            `${path}.automaticExecution.triggerMode`,
            errors,
          ),
          deferredDelayMinutes:
            automaticExecutionSource.deferredDelayMinutes === undefined || automaticExecutionSource.deferredDelayMinutes === null
              ? defaultAutomaticExecution.deferredDelayMinutes
              : toPositiveInteger(
                  automaticExecutionSource.deferredDelayMinutes,
                  defaultAutomaticExecution.deferredDelayMinutes || 1,
                  `${path}.automaticExecution.deferredDelayMinutes`,
                  errors,
                ),
          configuration: normalizeJsonObject(
            automaticExecutionSource.configuration,
            defaultAutomaticExecution.configuration || {},
          ),
        }
      : null;

  if (activityType === "AUTOMATIC") {
    if (!automaticExecution.handlerRef) {
      pushIssue(
        errors,
        `${path}.automaticExecution.handlerRef`,
        "Automatic activity requires a non-empty handlerRef.",
      );
    }

    if (automaticExecution.triggerMode === "DEFERRED" && !automaticExecution.deferredDelayMinutes) {
      pushIssue(
        errors,
        `${path}.automaticExecution.deferredDelayMinutes`,
        "Deferred automatic trigger mode requires deferredDelayMinutes.",
      );
    }

    if (!automaticExecution.taskTypeKey) {
      pushIssue(
        errors,
        `${path}.automaticExecution.taskTypeKey`,
        "Automatic activity requires a taskTypeKey.",
      );
    }

    if (automaticTaskTypesByKey && automaticExecution.taskTypeKey) {
      const taskType = automaticTaskTypesByKey.get(automaticExecution.taskTypeKey) || null;
      if (!taskType) {
        pushIssue(
          errors,
          `${path}.automaticExecution.taskTypeKey`,
          `Unknown automatic task type '${automaticExecution.taskTypeKey}'.`,
        );
      } else if (taskType.enabled === false) {
        pushIssue(
          errors,
          `${path}.automaticExecution.taskTypeKey`,
          `Automatic task type '${automaticExecution.taskTypeKey}' is disabled in catalog.`,
        );
      } else {
        validateConfigurationAgainstSchema(
          automaticExecution.configuration,
          taskType.configurationSchema,
          `${path}.automaticExecution`,
          errors,
        );

        const minSources = Number.parseInt(String(taskType?.inputContract?.minSources ?? 0), 10);
        if (Number.isFinite(minSources) && minSources > 0) {
          const actualSources = Array.isArray(source?.input?.sources) ? source.input.sources.length : 0;
          if (actualSources < minSources) {
            pushIssue(
              errors,
              `${path}.input.sources`,
              `Automatic task type '${automaticExecution.taskTypeKey}' requires at least ${minSources} input source(s).`,
            );
          }
        }

        const allowedSourceTypes = Array.isArray(taskType?.inputContract?.allowedSourceTypes)
          ? taskType.inputContract.allowedSourceTypes.map((entry) => normalizeString(entry).toUpperCase()).filter(Boolean)
          : [];
        if (allowedSourceTypes.length > 0) {
          const rawInputSources = Array.isArray(source?.input?.sources) ? source.input.sources : [];
          for (let index = 0; index < rawInputSources.length; index += 1) {
            const rawSource = rawInputSources[index];
            const sourceType = normalizeString(rawSource?.sourceType || "PROCESS_CONTEXT").toUpperCase();
            if (!allowedSourceTypes.includes(sourceType)) {
              pushIssue(
                errors,
                `${path}.input.sources[${index}].sourceType`,
                `Source type '${sourceType}' is not allowed for automatic task type '${automaticExecution.taskTypeKey}'. Allowed: ${allowedSourceTypes.join(", ")}.`,
              );
            }
          }
        }
      }
    } else if (warnings && automaticExecution.taskTypeKey) {
      pushIssue(
        warnings,
        `${path}.automaticExecution.taskTypeKey`,
        "Automatic task catalog was not provided during validation. taskTypeKey cross-check skipped.",
      );
    }
  }

  const inputSource = source.input && typeof source.input === "object" && !Array.isArray(source.input)
    ? source.input
    : {};
  const input = {
    sources: normalizeInputSources(
      inputSource.sources,
      `${path}.input.sources`,
      errors,
    ),
  };

  const outputSource = source.output && typeof source.output === "object" && !Array.isArray(source.output)
    ? source.output
    : {};
  const output = {
    storage: normalizeEnum(
      outputSource.storage,
      OUTPUT_STORAGE_VALUES,
      defaults.output.storage,
      `${path}.output.storage`,
      errors,
    ),
    mappings: normalizeMappingList(
      outputSource.mappings,
      `${path}.output.mappings`,
      errors,
    ),
  };

  const visibilitySource = source.visibility && typeof source.visibility === "object" && !Array.isArray(source.visibility)
    ? source.visibility
    : {};
  const visibility = {
    activityViewerRoles: normalizeRoleList(
      visibilitySource.activityViewerRoles,
      `${path}.visibility.activityViewerRoles`,
      errors,
      defaults.visibility.activityViewerRoles,
    ),
    dataViewerRoles: normalizeRoleList(
      visibilitySource.dataViewerRoles,
      `${path}.visibility.dataViewerRoles`,
      errors,
      defaults.visibility.dataViewerRoles,
    ),
  };

  if (visibility.activityViewerRoles.length === 0) {
    pushIssue(
      errors,
      `${path}.visibility.activityViewerRoles`,
      "At least one activityViewerRole is required.",
    );
  }
  if (visibility.dataViewerRoles.length === 0) {
    pushIssue(
      errors,
      `${path}.visibility.dataViewerRoles`,
      "At least one dataViewerRole is required.",
    );
  }

  return {
    activityType,
    candidateRoles,
    assignment,
    automaticExecution,
    input,
    output,
    visibility,
  };
}

function generateDefaultProcessSpecificationV1({ bpmnXml } = {}) {
  const activities = {};
  const bpmnActivities = extractBpmnActivities(bpmnXml);
  const sortedActivityIds = Array.from(bpmnActivities.keys()).sort((left, right) => left.localeCompare(right));

  for (const activityId of sortedActivityIds) {
    const metadata = bpmnActivities.get(activityId);
    activities[activityId] = buildDefaultActivitySpec(activityId, metadata?.tagName || "task");
  }

  return {
    schemaVersion: SPECIFICATION_SCHEMA_VERSION,
    start: {
      startableByRoles: ["PROCESS_USER"],
      startActivities: [],
      allowAutoStartWhenNoManualEntry: true,
    },
    monitors: {
      monitorRoles: ["PROCESS_MONITOR"],
    },
    sharedData: {
      entities: [],
    },
    activities,
  };
}

function validateProcessSpecificationV1(rawSpecification, options = {}) {
  const strict = options.strict !== false;
  const bpmnXml = String(options.bpmnXml || "");
  const errors = [];
  const warnings = [];
  const automaticTaskTypesByKey = options?.automaticTaskTypesByKey instanceof Map
    ? options.automaticTaskTypesByKey
    : null;

  const bpmnActivities = extractBpmnActivities(bpmnXml);
  if (bpmnActivities.size === 0) {
    pushIssue(
      warnings,
      "bpmnXml",
      "No BPMN activities were detected in the provided BPMN XML.",
    );
  }

  const defaultSpec = generateDefaultProcessSpecificationV1({ bpmnXml });
  const source =
    rawSpecification && typeof rawSpecification === "object" && !Array.isArray(rawSpecification)
      ? rawSpecification
      : {};

  const schemaVersion = Number.parseInt(
    String(source.schemaVersion || SPECIFICATION_SCHEMA_VERSION),
    10,
  );
  if (schemaVersion !== SPECIFICATION_SCHEMA_VERSION) {
    pushIssue(
      errors,
      "schemaVersion",
      `Unsupported specification schemaVersion '${source.schemaVersion}'. Expected '${SPECIFICATION_SCHEMA_VERSION}'.`,
    );
  }

  const startSource = source.start && typeof source.start === "object" && !Array.isArray(source.start)
    ? source.start
    : {};
  const start = {
    startableByRoles: normalizeRoleList(
      startSource.startableByRoles,
      "start.startableByRoles",
      errors,
      defaultSpec.start.startableByRoles,
    ),
    startActivities: Array.isArray(startSource.startActivities)
      ? startSource.startActivities.map((entry) => normalizeString(entry)).filter(Boolean)
      : defaultSpec.start.startActivities.slice(),
    allowAutoStartWhenNoManualEntry: normalizeBoolean(
      startSource.allowAutoStartWhenNoManualEntry,
      defaultSpec.start.allowAutoStartWhenNoManualEntry,
    ),
  };

  const monitorsSource = source.monitors && typeof source.monitors === "object" && !Array.isArray(source.monitors)
    ? source.monitors
    : {};
  const monitors = {
    monitorRoles: normalizeRoleList(
      monitorsSource.monitorRoles,
      "monitors.monitorRoles",
      errors,
      defaultSpec.monitors.monitorRoles,
    ),
  };

  const sharedDataSource = source.sharedData && typeof source.sharedData === "object" && !Array.isArray(source.sharedData)
    ? source.sharedData
    : {};
  const sharedData = {
    entities: normalizeSharedDataEntities(
      sharedDataSource.entities,
      "sharedData.entities",
      errors,
    ),
  };
  const sharedEntitiesByKey = new Map(sharedData.entities.map((entry) => [entry.entityKey, entry]));

  const rawActivities = source.activities && typeof source.activities === "object" && !Array.isArray(source.activities)
    ? source.activities
    : {};
  const normalizedActivities = {};

  for (const [activityId, metadata] of bpmnActivities.entries()) {
    const rawActivitySpec = rawActivities[activityId];
    if (!rawActivitySpec) {
      pushIssue(
        warnings,
        `activities.${activityId}`,
        `Activity '${activityId}' missing in specification. Default policy was applied.`,
      );
    }

    normalizedActivities[activityId] = normalizeActivitySpec(
      rawActivitySpec,
      buildDefaultActivitySpec(activityId, metadata.tagName),
      {
        activityId,
        path: `activities.${activityId}`,
        errors,
        warnings,
        automaticTaskTypesByKey,
      },
    );
  }

  for (const extraActivityId of Object.keys(rawActivities)) {
    if (!bpmnActivities.has(extraActivityId)) {
      pushIssue(
        errors,
        `activities.${extraActivityId}`,
        `Activity '${extraActivityId}' is not present in the BPMN model.`,
      );
    }
  }

  for (let index = 0; index < start.startActivities.length; index += 1) {
    const startActivityId = start.startActivities[index];
    if (!bpmnActivities.has(startActivityId)) {
      pushIssue(
        errors,
        `start.startActivities[${index}]`,
        `startActivity '${startActivityId}' is not a BPMN activity id.`,
      );
    }
  }

  if (strict && Object.keys(normalizedActivities).length === 0) {
    pushIssue(
      warnings,
      "activities",
      "No activities available in specification because BPMN contains no detectable activity nodes.",
    );
  }

  validateSharedDataReferences({
    activities: normalizedActivities,
    sharedEntitiesByKey,
    errors,
    warnings,
  });

  const normalizedSpecification = {
    schemaVersion: SPECIFICATION_SCHEMA_VERSION,
    start,
    monitors,
    sharedData,
    activities: normalizedActivities,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedSpecification,
  };
}

function normalizeProcessSpecificationV1(rawSpecification, options = {}) {
  const validation = validateProcessSpecificationV1(rawSpecification, options);
  if (!validation.valid) {
    const error = new Error(
      `Invalid process specification v1: ${validation.errors.map((entry) => `${entry.path} - ${entry.message}`).join(" | ")}`,
    );
    error.validation = validation;
    throw error;
  }

  return validation;
}

function summarizeProcessSpecificationV1(specification) {
  const activities = specification && typeof specification === "object" && !Array.isArray(specification)
    ? specification.activities
    : {};
  const activityEntries = activities && typeof activities === "object" ? Object.values(activities) : [];
  let manualActivityCount = 0;
  let automaticActivityCount = 0;

  for (const entry of activityEntries) {
    if (String(entry?.activityType || "").toUpperCase() === "AUTOMATIC") {
      automaticActivityCount += 1;
    } else {
      manualActivityCount += 1;
    }
  }

  return {
    schemaVersion: specification?.schemaVersion || SPECIFICATION_SCHEMA_VERSION,
    activityCount: activityEntries.length,
    manualActivityCount,
    automaticActivityCount,
    sharedDataEntityCount: Array.isArray(specification?.sharedData?.entities)
      ? specification.sharedData.entities.length
      : 0,
  };
}

module.exports = {
  SPECIFICATION_SCHEMA_VERSION,
  ACTIVITY_TYPE_VALUES,
  ASSIGNMENT_MODE_VALUES,
  ASSIGNMENT_STRATEGY_VALUES,
  AUTOMATIC_TRIGGER_MODE_VALUES,
  INPUT_SOURCE_TYPE_VALUES,
  OUTPUT_STORAGE_VALUES,
  SHARED_ENTITY_FIELD_TYPE_VALUES,
  DEFAULT_AUTOMATIC_TASK_TYPE_KEY,
  BPMN_ACTIVITY_TAGS,
  generateDefaultProcessSpecificationV1,
  validateProcessSpecificationV1,
  normalizeProcessSpecificationV1,
  summarizeProcessSpecificationV1,
};
