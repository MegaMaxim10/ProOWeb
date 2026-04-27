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
          triggerMode: "MANUAL_TRIGGER",
          deferredDelayMinutes: null,
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

function normalizeActivitySpec(rawActivitySpec, defaults, context) {
  const { activityId, path, errors } = context;
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
    triggerMode: "MANUAL_TRIGGER",
    deferredDelayMinutes: null,
  };
  const automaticExecution =
    activityType === "AUTOMATIC"
      ? {
          handlerRef: normalizeString(automaticExecutionSource.handlerRef || defaultAutomaticExecution.handlerRef),
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
    activities,
  };
}

function validateProcessSpecificationV1(rawSpecification, options = {}) {
  const strict = options.strict !== false;
  const bpmnXml = String(options.bpmnXml || "");
  const errors = [];
  const warnings = [];

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

  const normalizedSpecification = {
    schemaVersion: SPECIFICATION_SCHEMA_VERSION,
    start,
    monitors,
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
  BPMN_ACTIVITY_TAGS,
  generateDefaultProcessSpecificationV1,
  validateProcessSpecificationV1,
  normalizeProcessSpecificationV1,
  summarizeProcessSpecificationV1,
};
