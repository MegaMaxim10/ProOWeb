const SHARED_DATA_PREFIXES = Object.freeze([
  "shared.",
  "shared_data.",
  "shareddata.",
]);

const SHARED_ENTITY_FIELD_TYPES = Object.freeze([
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
const SHARED_ENTITY_RELATION_TYPES = Object.freeze([
  "MANY_TO_ONE",
  "ONE_TO_MANY",
  "ONE_TO_ONE",
  "MANY_TO_MANY",
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEntityKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function uniqueSorted(values) {
  const normalized = [];
  const seen = new Set();

  for (const entry of Array.isArray(values) ? values : []) {
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

function firstSegment(pathValue) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return "";
  }

  const clean = normalized
    .replace(/^[./]+/, "")
    .replace(/\[(\d+)\]/g, "")
    .replace(/\s+/g, "");
  const separatorIndex = clean.search(/[.:/]/);
  if (separatorIndex < 0) {
    return clean;
  }

  return clean.slice(0, separatorIndex);
}

function stripSharedPrefix(pathValue) {
  const normalized = normalizeString(pathValue).toLowerCase();
  for (const prefix of SHARED_DATA_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

function inferSharedEntityKey(pathValue) {
  const cleaned = stripSharedPrefix(pathValue);
  const entity = firstSegment(cleaned);
  return normalizeEntityKey(entity);
}

function toStorageTargets(storage) {
  const normalized = normalizeString(storage).toUpperCase();
  if (normalized === "SHARED") {
    return ["SHARED_DATA"];
  }
  if (normalized === "BOTH") {
    return ["PROCESS_INSTANCE", "SHARED_DATA"];
  }
  return ["PROCESS_INSTANCE"];
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeMappings(rawMappings) {
  const source = Array.isArray(rawMappings) ? rawMappings : [];
  const mappings = [];

  for (const entry of source) {
    const item = toObject(entry);
    const from = normalizeString(item.from);
    const to = normalizeString(item.to);
    if (!from || !to) {
      continue;
    }
    mappings.push({ from, to });
  }

  return mappings;
}

function normalizeInputSources(rawSources) {
  const source = Array.isArray(rawSources) ? rawSources : [];
  const items = [];

  for (const entry of source) {
    const item = toObject(entry);
    items.push({
      sourceType: normalizeString(item.sourceType || "PROCESS_CONTEXT").toUpperCase(),
      sourceRef: normalizeString(item.sourceRef),
      mappings: normalizeMappings(item.mappings),
    });
  }

  return items;
}

function normalizeSharedEntityDefinitions(specification) {
  const source = toObject(specification);
  const sharedData = toObject(source.sharedData);
  const rawEntities = Array.isArray(sharedData.entities) ? sharedData.entities : [];
  const index = new Map();

  for (const entry of rawEntities) {
    const entity = toObject(entry);
    const entityKey = normalizeEntityKey(entity.entityKey || entity.key || entity.name);
    if (!entityKey || index.has(entityKey)) {
      continue;
    }

    const rawFields = Array.isArray(entity.fields) ? entity.fields : [];
    const fields = [];
    const seenFieldNames = new Set();
    for (const rawField of rawFields) {
      const field = toObject(rawField);
      const name = normalizeString(field.name).replace(/[^a-zA-Z0-9_]+/g, "_");
      if (!name || seenFieldNames.has(name)) {
        continue;
      }
      seenFieldNames.add(name);
      const normalizedType = normalizeString(field.type || "STRING").toUpperCase();
      fields.push({
        name,
        type: SHARED_ENTITY_FIELD_TYPES.includes(normalizedType) ? normalizedType : "STRING",
        required: Boolean(field.required),
        indexed: Boolean(field.indexed),
        unique: Boolean(field.unique),
      });
    }

    const rawRelations = Array.isArray(entity.relations) ? entity.relations : [];
    const relations = [];
    const seenRelationNames = new Set();
    for (const rawRelation of rawRelations) {
      const relation = toObject(rawRelation);
      const name = normalizeString(relation.name || relation.relationName).replace(/[^a-zA-Z0-9_]+/g, "_");
      const targetEntityKey = normalizeEntityKey(
        relation.targetEntityKey || relation.targetEntity || relation.target,
      );
      if (!name || !targetEntityKey || seenRelationNames.has(name)) {
        continue;
      }
      seenRelationNames.add(name);
      const normalizedType = normalizeString(relation.type || "MANY_TO_ONE").toUpperCase();
      relations.push({
        name,
        type: SHARED_ENTITY_RELATION_TYPES.includes(normalizedType) ? normalizedType : "MANY_TO_ONE",
        targetEntityKey,
        mappedBy: normalizeString(relation.mappedBy || "").replace(/[^a-zA-Z0-9_]+/g, "_"),
        joinColumn: normalizeString(relation.joinColumn || "").toLowerCase(),
        joinTable: normalizeString(relation.joinTable || "").toLowerCase(),
        inverseJoinColumn: normalizeString(relation.inverseJoinColumn || relation.targetJoinColumn || "").toLowerCase(),
        required: Boolean(relation.required),
      });
    }

    index.set(entityKey, {
      entityKey,
      displayName: normalizeString(entity.displayName || entity.title || entityKey) || entityKey,
      tableName: normalizeString(entity.tableName || ""),
      fields,
      relations,
    });
  }

  return index;
}

function upsertSharedEntity(entityIndex, entityKey, definition = null) {
  const normalizedKey = normalizeEntityKey(entityKey);
  if (!normalizedKey) {
    return null;
  }

  if (!entityIndex.has(normalizedKey)) {
    entityIndex.set(normalizedKey, {
      entityKey: normalizedKey,
      displayName: normalizeString(definition?.displayName || normalizedKey) || normalizedKey,
      tableName: normalizeString(definition?.tableName || ""),
      fields: Array.isArray(definition?.fields)
        ? definition.fields.map((entry) => ({ ...entry }))
        : [],
      relations: Array.isArray(definition?.relations)
        ? definition.relations.map((entry) => ({ ...entry }))
        : [],
      modeled: Boolean(definition),
      producedByActivities: new Set(),
      consumedByActivities: new Set(),
      fieldPaths: new Set(),
    });
  }

  const current = entityIndex.get(normalizedKey);
  if (definition) {
    current.displayName = normalizeString(definition.displayName || current.displayName || normalizedKey) || normalizedKey;
    current.tableName = normalizeString(definition.tableName || current.tableName || "");
    if (Array.isArray(definition.fields) && definition.fields.length > 0 && (!Array.isArray(current.fields) || current.fields.length === 0)) {
      current.fields = definition.fields.map((entry) => ({ ...entry }));
    }
    if (Array.isArray(definition.relations) && definition.relations.length > 0 && (!Array.isArray(current.relations) || current.relations.length === 0)) {
      current.relations = definition.relations.map((entry) => ({ ...entry }));
    }
    current.modeled = true;
  }

  return current;
}

function buildSharedEntityList(entityIndex) {
  const entities = Array.from(entityIndex.values())
    .map((entry) => ({
      entityKey: entry.entityKey,
      displayName: entry.displayName || entry.entityKey,
      tableName: entry.tableName || null,
      fields: Array.isArray(entry.fields) ? entry.fields.map((field) => ({ ...field })) : [],
      relations: Array.isArray(entry.relations) ? entry.relations.map((relation) => ({ ...relation })) : [],
      modeled: entry.modeled === true,
      producedByActivities: Array.from(entry.producedByActivities).sort((left, right) => left.localeCompare(right)),
      consumedByActivities: Array.from(entry.consumedByActivities).sort((left, right) => left.localeCompare(right)),
      fieldPaths: Array.from(entry.fieldPaths).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.entityKey.localeCompare(right.entityKey));

  return entities;
}

function buildDataSummary({
  activities,
  inputSourceCount,
  inputMappingCount,
  outputMappingCount,
  lineageEdges,
  sharedEntities,
  warnings,
}) {
  const relationCount = (Array.isArray(sharedEntities) ? sharedEntities : []).reduce(
    (count, entry) => count + (Array.isArray(entry?.relations) ? entry.relations.length : 0),
    0,
  );
  return {
    activityCount: activities.length,
    inputSourceCount,
    inputMappingCount,
    outputMappingCount,
    lineageEdgeCount: lineageEdges.length,
    sharedDataEntityCount: sharedEntities.length,
    sharedDataRelationCount: relationCount,
    modeledSharedDataEntityCount: sharedEntities.filter((entry) => entry.modeled === true).length,
    inferredSharedDataEntityCount: sharedEntities.filter((entry) => entry.modeled !== true).length,
    warningCount: warnings.length,
  };
}

function buildDataContract({ model, version, runtimeContract }) {
  const contract = runtimeContract && typeof runtimeContract === "object" && !Array.isArray(runtimeContract)
    ? runtimeContract
    : { activities: [] };
  const activityList = Array.isArray(contract.activities) ? contract.activities : [];
  const activities = [];
  const lineageEdges = [];
  const warnings = [];
  const sharedEntityIndex = new Map();
  const sharedDefinitionIndex = normalizeSharedEntityDefinitions(version?.specification);
  let inputSourceCount = 0;
  let inputMappingCount = 0;
  let outputMappingCount = 0;

  for (const definition of sharedDefinitionIndex.values()) {
    upsertSharedEntity(sharedEntityIndex, definition.entityKey, definition);
  }

  for (const activity of activityList) {
    const activityId = normalizeString(activity?.activityId);
    if (!activityId) {
      continue;
    }

    const normalizedInputSources = normalizeInputSources(activity?.input?.sources);
    const normalizedOutputMappings = normalizeMappings(activity?.output?.mappings);
    const outputStorage = normalizeString(activity?.output?.storage || "INSTANCE").toUpperCase();
    const outputTargets = toStorageTargets(outputStorage);

    const consumedEntitySet = new Set();
    const producedEntitySet = new Set();
    inputSourceCount += normalizedInputSources.length;

    normalizedInputSources.forEach((source, sourceIndex) => {
      if (source.sourceType === "PREVIOUS_ACTIVITY") {
        const sourceActivityId = normalizeString(source.sourceRef);
        if (sourceActivityId && !activityList.some((entry) => normalizeString(entry?.activityId) === sourceActivityId)) {
          warnings.push({
            code: "UNKNOWN_PREVIOUS_ACTIVITY",
            message: `Activity '${activityId}' references unknown previous activity '${sourceActivityId}'.`,
            path: `activities.${activityId}.input.sources[${sourceIndex}].sourceRef`,
          });
        }
      }

      if (source.sourceType === "SHARED_DATA") {
        const inferredFromRef = inferSharedEntityKey(source.sourceRef);
        const definition = sharedDefinitionIndex.get(inferredFromRef) || null;
        const entityFromRef = upsertSharedEntity(sharedEntityIndex, inferredFromRef, definition);
        if (entityFromRef) {
          entityFromRef.consumedByActivities.add(activityId);
          if (source.sourceRef) {
            entityFromRef.fieldPaths.add(source.sourceRef);
          }
          consumedEntitySet.add(entityFromRef.entityKey);
          if (sharedDefinitionIndex.size > 0 && !definition) {
            warnings.push({
              code: "UNMODELED_SHARED_ENTITY_CONSUMED",
              message: `Activity '${activityId}' consumes shared entity '${entityFromRef.entityKey}' not present in sharedData.entities.`,
              path: `activities.${activityId}.input.sources[${sourceIndex}].sourceRef`,
            });
          }
        }
      }

      source.mappings.forEach((mapping, mappingIndex) => {
        inputMappingCount += 1;
        lineageEdges.push({
          edgeType: "INPUT",
          activityId,
          sourceType: source.sourceType,
          sourceRef: source.sourceRef,
          sourcePath: mapping.from,
          targetPath: mapping.to,
          edgeId: `${activityId}:IN:${sourceIndex}:${mappingIndex}`,
        });

        if (source.sourceType === "SHARED_DATA") {
          const inferredEntity = inferSharedEntityKey(source.sourceRef || mapping.from);
          const definition = sharedDefinitionIndex.get(inferredEntity) || null;
          const entity = upsertSharedEntity(sharedEntityIndex, inferredEntity, definition);
          if (entity) {
            entity.consumedByActivities.add(activityId);
            entity.fieldPaths.add(mapping.from);
            consumedEntitySet.add(entity.entityKey);
          }
        }
      });
    });

    normalizedOutputMappings.forEach((mapping, mappingIndex) => {
      outputMappingCount += 1;
      for (const targetType of outputTargets) {
        lineageEdges.push({
          edgeType: "OUTPUT",
          activityId,
          storageTarget: targetType,
          sourcePath: mapping.from,
          targetPath: mapping.to,
          edgeId: `${activityId}:OUT:${targetType}:${mappingIndex}`,
        });
      }

      if (outputTargets.includes("SHARED_DATA")) {
        const inferredEntity = inferSharedEntityKey(mapping.to);
        const definition = sharedDefinitionIndex.get(inferredEntity) || null;
        const entity = upsertSharedEntity(sharedEntityIndex, inferredEntity, definition);
        if (entity) {
          entity.producedByActivities.add(activityId);
          entity.fieldPaths.add(mapping.to);
          producedEntitySet.add(entity.entityKey);
          if (sharedDefinitionIndex.size > 0 && !definition) {
            warnings.push({
              code: "UNMODELED_SHARED_ENTITY_PRODUCED",
              message: `Activity '${activityId}' writes shared entity '${entity.entityKey}' not present in sharedData.entities.`,
              path: `activities.${activityId}.output.mappings[${mappingIndex}].to`,
            });
          }
        }
      }
    });

    activities.push({
      activityId,
      activityType: normalizeString(activity?.activityType || "MANUAL").toUpperCase(),
      input: {
        sources: normalizedInputSources,
      },
      output: {
        storage: outputStorage,
        mappings: normalizedOutputMappings,
      },
      dataFootprint: {
        inputSourceCount: normalizedInputSources.length,
        inputMappingCount: normalizedInputSources.reduce((sum, source) => sum + source.mappings.length, 0),
        outputMappingCount: normalizedOutputMappings.length,
        sharedDataConsumedEntities: Array.from(consumedEntitySet).sort((left, right) => left.localeCompare(right)),
        sharedDataProducedEntities: Array.from(producedEntitySet).sort((left, right) => left.localeCompare(right)),
      },
    });
  }

  activities.sort((left, right) => left.activityId.localeCompare(right.activityId));
  const sharedEntities = buildSharedEntityList(sharedEntityIndex);
  const summary = buildDataSummary({
    activities,
    inputSourceCount,
    inputMappingCount,
    outputMappingCount,
    lineageEdges,
    sharedEntities,
    warnings,
  });

  return {
    schemaVersion: 1,
    modelKey: normalizeString(model?.modelKey),
    title: normalizeString(model?.title),
    versionNumber: Number.parseInt(String(version?.versionNumber || 0), 10) || 0,
    status: normalizeString(version?.status),
    deployedAt: version?.deployedAt || null,
    persistence: {
      instanceStore: "PROCESS_INSTANCE_CONTEXT",
      sharedDataStore: "SHARED_DATA_STORE",
      strategies: ["INSTANCE", "SHARED", "BOTH"],
    },
    activities,
    lineage: {
      edges: lineageEdges,
    },
    sharedData: {
      entities: sharedEntities,
      modeledEntityKeys: sharedEntities.filter((entry) => entry.modeled === true).map((entry) => entry.entityKey),
      inferredEntityKeys: sharedEntities.filter((entry) => entry.modeled !== true).map((entry) => entry.entityKey),
    },
    warnings,
    summary,
  };
}

function buildDataCatalogEntry({ model, version, dataContract }) {
  return {
    modelKey: normalizeString(model?.modelKey),
    title: normalizeString(model?.title),
    description: normalizeString(model?.description),
    versionNumber: Number.parseInt(String(version?.versionNumber || 0), 10) || 0,
    status: normalizeString(version?.status),
    deployedAt: version?.deployedAt || null,
    dataContractResourcePath: `processes/${normalizeString(model?.modelKey)}/v${Number.parseInt(String(version?.versionNumber || 0), 10) || 0}.data.json`,
    sharedDataEntities: uniqueSorted((dataContract?.sharedData?.entities || []).map((entry) => entry.entityKey)),
    summary: dataContract?.summary || null,
  };
}

module.exports = {
  buildDataContract,
  buildDataCatalogEntry,
};
