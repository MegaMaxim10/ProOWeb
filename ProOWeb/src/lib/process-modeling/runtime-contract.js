function normalizeString(value) {
  return String(value || "").trim();
}

function extractTagAttribute(tagSource, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`, "i");
  const match = String(tagSource || "").match(pattern);
  if (!match) {
    return "";
  }

  return match[1] || match[2] || "";
}

function toUniqueSortedStrings(values, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  const normalized = [];
  const seen = new Set();

  for (const entry of source) {
    const value = normalizeString(entry);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  normalized.sort((left, right) => left.localeCompare(right));
  return normalized;
}

function toPositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeMappings(rawMappings) {
  const source = Array.isArray(rawMappings) ? rawMappings : [];
  const normalized = [];

  for (const entry of source) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const from = normalizeString(entry.from);
    const to = normalizeString(entry.to);
    if (!from || !to) {
      continue;
    }

    normalized.push({ from, to });
  }

  return normalized;
}

function normalizeInputSources(rawSources) {
  const source = Array.isArray(rawSources) ? rawSources : [];
  const normalized = [];

  for (const entry of source) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    normalized.push({
      sourceType: normalizeString(entry.sourceType || "PROCESS_CONTEXT").toUpperCase(),
      sourceRef: normalizeString(entry.sourceRef),
      mappings: normalizeMappings(entry.mappings),
    });
  }

  return normalized;
}

function extractSequenceFlows(bpmnXml) {
  const xml = String(bpmnXml || "");
  const flows = [];
  const pattern = /<(?:[A-Za-z0-9_-]+:)?sequenceFlow\b[^>]*>/g;
  let match = pattern.exec(xml);
  while (match) {
    const sourceTag = match[0];
    const sourceRef = extractTagAttribute(sourceTag, "sourceRef");
    const targetRef = extractTagAttribute(sourceTag, "targetRef");
    if (sourceRef && targetRef) {
      flows.push({ sourceRef, targetRef });
    }
    match = pattern.exec(xml);
  }

  return flows;
}

function buildRuntimeFlow({ bpmnXml, activityIds, configuredStartActivities }) {
  const activitySet = new Set(activityIds);
  const sequenceFlows = extractSequenceFlows(bpmnXml);
  const transitions = [];
  const seenTransitions = new Set();
  const outgoingByActivity = {};
  const incomingByActivity = {};

  for (const activityId of activityIds) {
    outgoingByActivity[activityId] = [];
    incomingByActivity[activityId] = 0;
  }

  for (const flow of sequenceFlows) {
    if (!activitySet.has(flow.sourceRef) || !activitySet.has(flow.targetRef)) {
      continue;
    }

    const edgeKey = `${flow.sourceRef}=>${flow.targetRef}`;
    if (seenTransitions.has(edgeKey)) {
      continue;
    }
    seenTransitions.add(edgeKey);

    transitions.push({
      sourceActivityId: flow.sourceRef,
      targetActivityId: flow.targetRef,
    });
    outgoingByActivity[flow.sourceRef].push(flow.targetRef);
    incomingByActivity[flow.targetRef] += 1;
  }

  transitions.sort((left, right) => {
    const sourceCompare = left.sourceActivityId.localeCompare(right.sourceActivityId);
    if (sourceCompare !== 0) {
      return sourceCompare;
    }
    return left.targetActivityId.localeCompare(right.targetActivityId);
  });

  for (const activityId of activityIds) {
    outgoingByActivity[activityId] = toUniqueSortedStrings(outgoingByActivity[activityId]);
  }

  const explicitStartActivities = toUniqueSortedStrings(configuredStartActivities)
    .filter((activityId) => activitySet.has(activityId));
  const inferredStartActivities = activityIds
    .filter((activityId) => incomingByActivity[activityId] === 0)
    .sort((left, right) => left.localeCompare(right));
  const effectiveStartActivities = explicitStartActivities.length > 0
    ? explicitStartActivities
    : inferredStartActivities;

  return {
    transitions,
    outgoingByActivity,
    incomingByActivity,
    configuredStartActivities: explicitStartActivities,
    inferredStartActivities,
    effectiveStartActivities,
  };
}

function normalizeActivityContract(activityId, rawActivity = {}) {
  const source = rawActivity && typeof rawActivity === "object" && !Array.isArray(rawActivity)
    ? rawActivity
    : {};
  const activityType = normalizeString(source.activityType || "MANUAL").toUpperCase();

  const assignmentSource = source.assignment && typeof source.assignment === "object" && !Array.isArray(source.assignment)
    ? source.assignment
    : {};
  const automaticSource =
    source.automaticExecution && typeof source.automaticExecution === "object" && !Array.isArray(source.automaticExecution)
      ? source.automaticExecution
      : null;
  const inputSource = source.input && typeof source.input === "object" && !Array.isArray(source.input)
    ? source.input
    : {};
  const outputSource = source.output && typeof source.output === "object" && !Array.isArray(source.output)
    ? source.output
    : {};
  const visibilitySource = source.visibility && typeof source.visibility === "object" && !Array.isArray(source.visibility)
    ? source.visibility
    : {};

  return {
    activityId,
    activityType,
    candidateRoles: toUniqueSortedStrings(source.candidateRoles),
    assignment: {
      mode: normalizeString(assignmentSource.mode || "AUTOMATIC").toUpperCase(),
      strategy: normalizeString(assignmentSource.strategy || "ROLE_QUEUE").toUpperCase(),
      allowPreviouslyAssignedAssignee: Boolean(assignmentSource.allowPreviouslyAssignedAssignee),
      manualAssignerRoles: toUniqueSortedStrings(assignmentSource.manualAssignerRoles),
      maxAssignees: toPositiveInteger(assignmentSource.maxAssignees, 1),
    },
    automaticExecution: activityType === "AUTOMATIC"
      ? {
          handlerRef: normalizeString(automaticSource?.handlerRef),
          triggerMode: normalizeString(automaticSource?.triggerMode || "MANUAL_TRIGGER").toUpperCase(),
          deferredDelayMinutes:
            automaticSource?.deferredDelayMinutes == null
              ? null
              : toPositiveInteger(automaticSource.deferredDelayMinutes, 1),
        }
      : null,
    input: {
      sources: normalizeInputSources(inputSource.sources),
    },
    output: {
      storage: normalizeString(outputSource.storage || "INSTANCE").toUpperCase(),
      mappings: normalizeMappings(outputSource.mappings),
    },
    visibility: {
      activityViewerRoles: toUniqueSortedStrings(visibilitySource.activityViewerRoles),
      dataViewerRoles: toUniqueSortedStrings(visibilitySource.dataViewerRoles),
    },
  };
}

function buildRuntimeSummary(contract) {
  const activities = Array.isArray(contract.activities) ? contract.activities : [];
  const manualActivities = activities.filter((entry) => entry.activityType === "MANUAL");
  const automaticActivities = activities.filter((entry) => entry.activityType === "AUTOMATIC");
  const transitions = Array.isArray(contract.flow?.transitions) ? contract.flow.transitions : [];
  const startActivities = Array.isArray(contract.start?.startActivities) ? contract.start.startActivities : [];

  return {
    activityCount: activities.length,
    manualActivityCount: manualActivities.length,
    automaticActivityCount: automaticActivities.length,
    transitionCount: transitions.length,
    startActivityCount: startActivities.length,
    manualActivityIds: manualActivities.map((entry) => entry.activityId),
    automaticActivityIds: automaticActivities.map((entry) => entry.activityId),
    startableRoleCount: Array.isArray(contract.start?.startableByRoles)
      ? contract.start.startableByRoles.length
      : 0,
    monitorRoleCount: Array.isArray(contract.monitors?.monitorRoles)
      ? contract.monitors.monitorRoles.length
      : 0,
  };
}

function buildRuntimeContract({ model, version }) {
  const specification = version?.specification && typeof version.specification === "object" && !Array.isArray(version.specification)
    ? version.specification
    : {};
  const startSource = specification.start && typeof specification.start === "object" && !Array.isArray(specification.start)
    ? specification.start
    : {};
  const monitorSource = specification.monitors && typeof specification.monitors === "object" && !Array.isArray(specification.monitors)
    ? specification.monitors
    : {};
  const rawActivities = specification.activities && typeof specification.activities === "object" && !Array.isArray(specification.activities)
    ? specification.activities
    : {};

  const activityIds = Object.keys(rawActivities).sort((left, right) => left.localeCompare(right));
  const activities = activityIds.map((activityId) =>
    normalizeActivityContract(activityId, rawActivities[activityId]));
  const flow = buildRuntimeFlow({
    bpmnXml: version?.bpmnXml || "",
    activityIds,
    configuredStartActivities: startSource.startActivities,
  });

  const contract = {
    schemaVersion: 1,
    modelKey: model.modelKey,
    title: model.title,
    description: model.description || "",
    versionNumber: version.versionNumber,
    status: version.status,
    deployedAt: version.deployedAt || null,
    start: {
      startableByRoles: toUniqueSortedStrings(startSource.startableByRoles),
      startActivities: flow.effectiveStartActivities,
      configuredStartActivities: flow.configuredStartActivities,
      inferredStartActivities: flow.inferredStartActivities,
      allowAutoStartWhenNoManualEntry: Boolean(startSource.allowAutoStartWhenNoManualEntry),
    },
    monitors: {
      monitorRoles: toUniqueSortedStrings(monitorSource.monitorRoles),
    },
    activities,
    flow: {
      transitions: flow.transitions,
      outgoingByActivity: flow.outgoingByActivity,
      incomingByActivity: flow.incomingByActivity,
    },
  };

  contract.summary = buildRuntimeSummary(contract);
  return contract;
}

function buildRuntimeCatalogEntry({ model, version, contract }) {
  return {
    modelKey: model.modelKey,
    title: model.title,
    description: model.description || "",
    versionNumber: version.versionNumber,
    status: version.status,
    deployedAt: version.deployedAt || null,
    bpmnResourcePath: `processes/${model.modelKey}/v${version.versionNumber}.bpmn`,
    metadataResourcePath: `processes/${model.modelKey}/v${version.versionNumber}.json`,
    runtimeContractResourcePath: `processes/${model.modelKey}/v${version.versionNumber}.runtime.json`,
    startableByRoles: contract.start.startableByRoles,
    monitorRoles: contract.monitors.monitorRoles,
    summary: contract.summary,
  };
}

module.exports = {
  buildRuntimeContract,
  buildRuntimeCatalogEntry,
  buildRuntimeSummary,
};
