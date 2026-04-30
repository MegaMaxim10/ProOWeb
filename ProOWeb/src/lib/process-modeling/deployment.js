const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  loadTemplateOverrideRuntime,
  applyTemplateOverridesToFile,
} = require("../template-governance");

const {
  createCatalogError,
  normalizeModelKey,
  normalizeVersionNumber,
  loadProcessModel,
  saveProcessModel,
  toPublicModel,
  toPublicVersion,
  listDeployedModels,
} = require("./catalog");
const {
  buildRuntimeContract,
  buildRuntimeCatalogEntry,
} = require("./runtime-contract");
const {
  buildDataContract,
  buildDataCatalogEntry,
} = require("./data-contract");
const {
  readAutomaticTaskCatalog,
} = require("./automatic-task-catalog");

const DEFAULT_BASE_PACKAGE = "com.prooweb.generated";

function normalizeString(value) {
  return String(value || "").trim();
}

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content), "utf8").digest("hex");
}

function readFileHash(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function resolveSafeAbsolutePath(rootDir, relativePath) {
  const normalizedRelativePath = toPosixPath(relativePath);
  const absolutePath = path.resolve(rootDir, normalizedRelativePath);
  const resolvedRoot = path.resolve(rootDir);

  if (absolutePath === resolvedRoot) {
    return absolutePath;
  }

  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Unsafe target path outside project root: ${relativePath}`);
  }

  return absolutePath;
}

function normalizeBasePackage(value) {
  const normalized = normalizeString(value || DEFAULT_BASE_PACKAGE).toLowerCase();
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(normalized)) {
    return DEFAULT_BASE_PACKAGE;
  }

  return normalized;
}

function escapeJavaString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function toPascalCase(value) {
  const chunks = String(value || "")
    .split(/[^a-zA-Z0-9]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return "Process";
  }

  const joined = chunks
    .map((entry) => entry[0].toUpperCase() + entry.slice(1).toLowerCase())
    .join("");

  if (/^[0-9]/.test(joined)) {
    return `P${joined}`;
  }

  return joined;
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toFileSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "process";
}

function toJavaIdentifier(value, fallback = "value") {
  const normalized = String(value || "")
    .replace(/[^a-zA-Z0-9_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((entry, index) => {
      const lower = entry.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  const candidate = normalized || fallback;
  const safe = /^[a-zA-Z_]/.test(candidate) ? candidate : `v${candidate}`;
  return safe.replace(/[^a-zA-Z0-9_]/g, "") || fallback;
}

function toSqlIdentifier(value, fallback = "value") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (normalized || fallback).slice(0, 63).replace(/_+$/g, "") || fallback;
}

function toSharedEntityClassName(entityKey) {
  return `Shared${toPascalCase(entityKey)}Entity`;
}

function toSharedEntityRepositoryName(entityKey) {
  return `Shared${toPascalCase(entityKey)}JpaRepository`;
}

function toSharedEntityTableName(entityKey, tableName) {
  const candidate = normalizeString(tableName);
  if (candidate) {
    return toSqlIdentifier(candidate, `shared_${toSqlIdentifier(entityKey, "entity")}`);
  }
  return toSqlIdentifier(`shared_${toSqlIdentifier(entityKey, "entity")}`, "shared_entity");
}

function toDefaultJoinColumnName(value) {
  return toSqlIdentifier(`${toSqlIdentifier(value, "related")}_id`, "related_id");
}

function toDefaultJoinTableName(sourceEntityKey, relationName, targetEntityKey) {
  return toSqlIdentifier(
    `shared_rel_${toSqlIdentifier(sourceEntityKey, "source")}_${toSqlIdentifier(relationName, "rel")}_${toSqlIdentifier(targetEntityKey, "target")}`,
    "shared_rel_source_target",
  );
}

function mapSharedFieldTypeToJava(type) {
  switch (String(type || "").toUpperCase()) {
    case "TEXT":
    case "STRING":
    case "JSON":
    case "UUID":
      return "String";
    case "INTEGER":
      return "Integer";
    case "LONG":
      return "Long";
    case "DECIMAL":
      return "java.math.BigDecimal";
    case "BOOLEAN":
      return "Boolean";
    case "DATE":
      return "java.time.LocalDate";
    case "DATETIME":
      return "java.time.Instant";
    default:
      return "String";
  }
}

function mapSharedFieldTypeToLiquibase(type) {
  switch (String(type || "").toUpperCase()) {
    case "TEXT":
      return "text";
    case "INTEGER":
      return "int";
    case "LONG":
      return "bigint";
    case "DECIMAL":
      return "decimal(19,4)";
    case "BOOLEAN":
      return "boolean";
    case "DATE":
      return "date";
    case "DATETIME":
      return "timestamp";
    case "JSON":
      return "text";
    case "UUID":
      return "varchar(36)";
    case "STRING":
    default:
      return "varchar(255)";
  }
}

function normalizeSharedEntitiesForCompilation(runtimeEntries) {
  const byKey = new Map();

  for (const runtimeEntry of Array.isArray(runtimeEntries) ? runtimeEntries : []) {
    const entities = runtimeEntry?.dataContract?.sharedData?.entities;
    if (!Array.isArray(entities)) {
      continue;
    }
    for (const rawEntity of entities) {
      if (!rawEntity || rawEntity.modeled !== true) {
        continue;
      }
      const entityKey = normalizeString(rawEntity.entityKey).toLowerCase();
      if (!entityKey) {
        continue;
      }
      if (!byKey.has(entityKey)) {
        byKey.set(entityKey, {
          entityKey,
          displayName: normalizeString(rawEntity.displayName || entityKey) || entityKey,
          tableName: toSharedEntityTableName(entityKey, rawEntity.tableName),
          fields: [],
          relations: [],
        });
      }
      const entity = byKey.get(entityKey);
      const fieldByName = new Map(entity.fields.map((entry) => [entry.name, entry]));
      for (const rawField of Array.isArray(rawEntity.fields) ? rawEntity.fields : []) {
        const sourceName = String(rawField?.name || "")
          .trim()
          .replace(/[^a-zA-Z0-9_]+/g, "_");
        const fieldName = toJavaIdentifier(sourceName, "");
        if (!sourceName || !fieldName || fieldByName.has(sourceName)) {
          continue;
        }
        const javaName = fieldName === "id" ? "businessId" : fieldName;
        const columnName = toSqlIdentifier(rawField?.name || sourceName, sourceName.toLowerCase());
        const field = {
          name: sourceName,
          javaName,
          columnName,
          type: String(rawField?.type || "STRING").toUpperCase(),
          required: Boolean(rawField?.required),
          indexed: Boolean(rawField?.indexed),
          unique: Boolean(rawField?.unique),
        };
        entity.fields.push(field);
        fieldByName.set(field.name, field);
      }

      const relationByName = new Map(entity.relations.map((entry) => [entry.name, entry]));
      for (const rawRelation of Array.isArray(rawEntity.relations) ? rawEntity.relations : []) {
        const relationName = toJavaIdentifier(rawRelation?.name, "");
        if (!relationName || relationByName.has(relationName)) {
          continue;
        }
        const targetEntityKey = normalizeString(rawRelation?.targetEntityKey).toLowerCase();
        if (!targetEntityKey) {
          continue;
        }
        const type = String(rawRelation?.type || "MANY_TO_ONE").toUpperCase();
        const mappedBy = toJavaIdentifier(rawRelation?.mappedBy, "");
        const joinColumn = toSqlIdentifier(
          rawRelation?.joinColumn || (type === "MANY_TO_ONE" || (type === "ONE_TO_ONE" && !mappedBy)
            ? toDefaultJoinColumnName(relationName)
            : ""),
          "",
        );
        const joinTable = toSqlIdentifier(
          rawRelation?.joinTable || (type === "MANY_TO_MANY" && !mappedBy
            ? toDefaultJoinTableName(entityKey, relationName, targetEntityKey)
            : ""),
          "",
        );
        const inverseJoinColumn = toSqlIdentifier(
          rawRelation?.inverseJoinColumn || (type === "MANY_TO_MANY" && !mappedBy
            ? toDefaultJoinColumnName(targetEntityKey)
            : ""),
          "",
        );

        const relation = {
          name: relationName,
          type,
          targetEntityKey,
          mappedBy,
          joinColumn,
          joinTable,
          inverseJoinColumn,
          required: Boolean(rawRelation?.required),
        };
        entity.relations.push(relation);
        relationByName.set(relation.name, relation);
      }
    }
  }

  const entities = Array.from(byKey.values())
    .map((entity) => ({
      ...entity,
      className: toSharedEntityClassName(entity.entityKey),
      repositoryName: toSharedEntityRepositoryName(entity.entityKey),
      fields: entity.fields.length > 0
        ? entity.fields
        : [{
            name: "value",
            javaName: "value",
            columnName: "value",
            type: "JSON",
            required: false,
            indexed: false,
            unique: false,
          }],
    }))
    .sort((left, right) => left.entityKey.localeCompare(right.entityKey));

  return entities;
}

function toJavaTypeSimpleName(javaType) {
  if (!javaType.includes(".")) {
    return javaType;
  }
  const parts = javaType.split(".");
  return parts[parts.length - 1];
}

function buildSharedDataEntityJpaJava({ basePackage, entity, entityClassByKey }) {
  const scalarFieldRows = entity.fields.map((field) => {
    const javaType = toJavaTypeSimpleName(mapSharedFieldTypeToJava(field.type));
    return `  @Column(name = "${escapeJavaString(field.columnName)}", nullable = ${field.required ? "false" : "true"}, unique = ${field.unique ? "true" : "false"})
  private ${javaType} ${field.javaName};`;
  });

  const relationFieldRows = entity.relations.map((relation) => {
    const targetClassName = entityClassByKey.get(relation.targetEntityKey) || toSharedEntityClassName(relation.targetEntityKey);
    if (relation.type === "MANY_TO_ONE") {
      return `  @ManyToOne(fetch = FetchType.LAZY, optional = ${relation.required ? "false" : "true"})
  @JoinColumn(name = "${escapeJavaString(relation.joinColumn || toDefaultJoinColumnName(relation.name))}", nullable = ${relation.required ? "false" : "true"})
  private ${targetClassName} ${relation.name};`;
    }
    if (relation.type === "ONE_TO_ONE") {
      if (relation.mappedBy) {
        return `  @OneToOne(mappedBy = "${escapeJavaString(relation.mappedBy)}", fetch = FetchType.LAZY)
  private ${targetClassName} ${relation.name};`;
      }
      return `  @OneToOne(fetch = FetchType.LAZY, optional = ${relation.required ? "false" : "true"})
  @JoinColumn(name = "${escapeJavaString(relation.joinColumn || toDefaultJoinColumnName(relation.name))}", nullable = ${relation.required ? "false" : "true"})
  private ${targetClassName} ${relation.name};`;
    }
    if (relation.type === "ONE_TO_MANY") {
      if (relation.mappedBy) {
        return `  @OneToMany(mappedBy = "${escapeJavaString(relation.mappedBy)}", fetch = FetchType.LAZY)
  private Set<${targetClassName}> ${relation.name} = new LinkedHashSet<>();`;
      }
      return `  @OneToMany(fetch = FetchType.LAZY)
  @JoinColumn(name = "${escapeJavaString(relation.joinColumn || toDefaultJoinColumnName(entity.entityKey))}")
  private Set<${targetClassName}> ${relation.name} = new LinkedHashSet<>();`;
    }
    if (relation.mappedBy) {
      return `  @ManyToMany(mappedBy = "${escapeJavaString(relation.mappedBy)}", fetch = FetchType.LAZY)
  private Set<${targetClassName}> ${relation.name} = new LinkedHashSet<>();`;
    }
    return `  @ManyToMany(fetch = FetchType.LAZY)
  @JoinTable(
      name = "${escapeJavaString(relation.joinTable || toDefaultJoinTableName(entity.entityKey, relation.name, relation.targetEntityKey))}",
      joinColumns = @JoinColumn(name = "${escapeJavaString(relation.joinColumn || toDefaultJoinColumnName(entity.entityKey))}"),
      inverseJoinColumns = @JoinColumn(name = "${escapeJavaString(relation.inverseJoinColumn || toDefaultJoinColumnName(relation.targetEntityKey))}")
  )
  private Set<${targetClassName}> ${relation.name} = new LinkedHashSet<>();`;
  });

  const accessors = [];
  const members = [
    { type: "Long", name: "id" },
    ...entity.fields.map((field) => ({
      type: toJavaTypeSimpleName(mapSharedFieldTypeToJava(field.type)),
      name: field.javaName,
    })),
    ...entity.relations.map((relation) => ({
      type:
        relation.type === "ONE_TO_MANY" || relation.type === "MANY_TO_MANY"
          ? `Set<${entityClassByKey.get(relation.targetEntityKey) || toSharedEntityClassName(relation.targetEntityKey)}>`
          : (entityClassByKey.get(relation.targetEntityKey) || toSharedEntityClassName(relation.targetEntityKey)),
      name: relation.name,
    })),
  ];

  for (const member of members) {
    const methodSuffix = member.name.charAt(0).toUpperCase() + member.name.slice(1);
    accessors.push(`  public ${member.type} get${methodSuffix}() {
    return ${member.name};
  }`);
    accessors.push(`  public void set${methodSuffix}(${member.type} ${member.name}) {
    this.${member.name} = ${member.name};
  }`);
  }

  return `package ${basePackage}.system.infrastructure.process.runtime.shareddata.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "${escapeJavaString(entity.tableName)}")
public class ${entity.className} {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
${scalarFieldRows.length > 0 ? `\n${scalarFieldRows.join("\n\n")}` : ""}
${relationFieldRows.length > 0 ? `\n${relationFieldRows.join("\n\n")}` : ""}

${accessors.join("\n\n")}
}
`;
}

function buildSharedDataRepositoryJava({ basePackage, entity }) {
  return `package ${basePackage}.system.infrastructure.process.runtime.shareddata.repository;

import ${basePackage}.system.infrastructure.process.runtime.shareddata.model.${entity.className};
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ${entity.repositoryName} extends JpaRepository<${entity.className}, Long> {
  Optional<${entity.className}> findTopByOrderByIdDesc();
}
`;
}

function buildJpaBackedProcessRuntimeStoreAdapterJava({ basePackage, sharedEntities }) {
  const hasSharedEntities = Array.isArray(sharedEntities) && sharedEntities.length > 0;
  const imports = sharedEntities
    .map((entity) => `import ${basePackage}.system.infrastructure.process.runtime.shareddata.model.${entity.className};`)
    .join("\n");
  const repositoryImports = sharedEntities
    .map((entity) => `import ${basePackage}.system.infrastructure.process.runtime.shareddata.repository.${entity.repositoryName};`)
    .join("\n");
  const repositoryFields = sharedEntities
    .map((entity) => `  private final ${entity.repositoryName} ${toJavaIdentifier(entity.repositoryName)};`)
    .join("\n");
  const constructorParameters = sharedEntities
    .map((entity) => `${entity.repositoryName} ${toJavaIdentifier(entity.repositoryName)}`)
    .join(",\n      ");
  const constructorAssignments = sharedEntities
    .map((entity) => `    this.${toJavaIdentifier(entity.repositoryName)} = ${toJavaIdentifier(entity.repositoryName)};`)
    .join("\n");

  const readCases = sharedEntities
    .map((entity) => {
      const repositoryVar = toJavaIdentifier(entity.repositoryName);
      const mapRows = [
        "Map<String, Object> values = new HashMap<>();",
        "values.put(\"id\", entity.getId());",
        ...entity.fields.map((field) => `values.put("${field.name}", entity.get${field.javaName.charAt(0).toUpperCase() + field.javaName.slice(1)}());`),
        ...entity.relations
          .filter((relation) => relation.type === "MANY_TO_ONE" || (relation.type === "ONE_TO_ONE" && !relation.mappedBy))
          .map((relation) => `values.put("${relation.name}Id", entity.get${relation.name.charAt(0).toUpperCase() + relation.name.slice(1)}() == null ? null : entity.get${relation.name.charAt(0).toUpperCase() + relation.name.slice(1)}().getId());`),
      ];
      return `      case "${entity.entityKey}" -> ${repositoryVar}.findTopByOrderByIdDesc()
        .map((entity) -> {
          ${mapRows.join("\n          ")}
          return Map.copyOf(values);
        })
        .orElse(Map.of());`;
    })
    .join("\n");

  const writeCases = sharedEntities
    .map((entity) => {
      const repositoryVar = toJavaIdentifier(entity.repositoryName);
      const className = entity.className;
      const fieldAssignments = entity.fields.map((field) => {
        const setter = `entity.set${field.javaName.charAt(0).toUpperCase() + field.javaName.slice(1)}`;
        const javaType = toJavaTypeSimpleName(mapSharedFieldTypeToJava(field.type));
        if (field.type === "JSON") {
          return `${setter}(toJsonText(payload.get("${field.name}")));`;
        }
        return `${setter}(coerce(payload.get("${field.name}"), ${javaType}.class));`;
      });

      const relationAssignments = entity.relations
        .filter((relation) => relation.type === "MANY_TO_ONE" || (relation.type === "ONE_TO_ONE" && !relation.mappedBy))
        .map((relation) => {
          const targetEntity = sharedEntities.find((entry) => entry.entityKey === relation.targetEntityKey);
          if (!targetEntity) {
            return "";
          }
          const targetRepoVar = toJavaIdentifier(targetEntity.repositoryName);
          const setter = `entity.set${relation.name.charAt(0).toUpperCase() + relation.name.slice(1)}`;
          return `{
        Long relationId = coerce(payload.get("${relation.name}Id"), Long.class);
        ${setter}(relationId == null ? null : ${targetRepoVar}.findById(relationId).orElse(null));
      }`;
        })
        .filter(Boolean);

      return `      case "${entity.entityKey}" -> {
        Long id = coerce(payload.get("id"), Long.class);
        ${className} entity = id == null
          ? new ${className}()
          : ${repositoryVar}.findById(id).orElseGet(${className}::new);
        ${fieldAssignments.join("\n        ")}
        ${relationAssignments.join("\n        ")}
        ${repositoryVar}.save(entity);
      }`;
    })
    .join("\n");

  const listKeyRows = sharedEntities
    .map((entity) => `    if (${toJavaIdentifier(entity.repositoryName)}.count() > 0) {
      keys.add("${entity.entityKey}");
    }`)
    .join("\n");

  const deleteCases = sharedEntities
    .map((entity) => `      case "${entity.entityKey}" -> ${toJavaIdentifier(entity.repositoryName)}.deleteAll();`)
    .join("\n");
  const readSwitchRows = readCases
    ? `${readCases}\n      default -> Map.of();`
    : "      default -> Map.of();";
  const writeSwitchRows = writeCases
    ? `${writeCases}\n      default -> {\n      }`
    : "      default -> {\n      }";
  const deleteSwitchRows = deleteCases
    ? `${deleteCases}\n      default -> {\n      }`
    : "      default -> {\n      }";
  const constructorTail = hasSharedEntities
    ? `,\n      ${constructorParameters}`
    : "";
  const constructorAssignmentsBlock = constructorAssignments ? `${constructorAssignments}\n` : "";

  return `package ${basePackage}.system.infrastructure.process.runtime;

import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
${imports}
${repositoryImports}
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Primary
@Component
public class JpaBackedProcessRuntimeStoreAdapter implements ProcessRuntimeStorePort {
  private final Map<String, ProcessRuntimeInstance> byInstanceId = new ConcurrentHashMap<>();
  private final List<ProcessRuntimeStorePort.RuntimeMonitorEvent> monitorEvents = new CopyOnWriteArrayList<>();
  private final Map<String, ProcessRuntimeStorePort.RuntimeUserPreferences> userPreferencesByUserId = new ConcurrentHashMap<>();
  private final ObjectMapper objectMapper;
${repositoryFields}
  private final List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = List.of(
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.user", List.of("PROCESS_USER"), "unit.operations", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.supervisor", List.of("PROCESS_MONITOR", "PROCESS_USER"), "unit.operations", "runtime.admin"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.approverA", List.of("PROCESS_USER"), "unit.finance", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.approverB", List.of("PROCESS_USER"), "unit.finance", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.admin", List.of("ADMINISTRATOR", "PROCESS_MONITOR"), "unit.executive", null)
  );
  private final ProcessRuntimeStorePort.RuntimeOrganizationSnapshot organizationSnapshot = new ProcessRuntimeStorePort.RuntimeOrganizationSnapshot(
    List.of(
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.executive", null, "runtime.admin", List.of("runtime.admin")),
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.operations", "unit.executive", "runtime.supervisor", List.of("runtime.user", "runtime.supervisor")),
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.finance", "unit.executive", "runtime.supervisor", List.of("runtime.approverA", "runtime.approverB"))
    )
  );

  public JpaBackedProcessRuntimeStoreAdapter(
      ObjectMapper objectMapper${constructorTail}) {
    this.objectMapper = objectMapper;
${constructorAssignmentsBlock}
    registerDefaultPreference("runtime.user", "Runtime User", "en", "SYSTEM", "IN_APP_EMAIL", true, "MANUAL_TRIGGER", 0, true);
    registerDefaultPreference("runtime.supervisor", "Runtime Supervisor", "en", "SYSTEM", "IN_APP_EMAIL", true, "AUTO_IMMEDIATE", 0, true);
    registerDefaultPreference("runtime.approverA", "Runtime Approver A", "en", "SYSTEM", "IN_APP_EMAIL", true, "AUTO_AFTER_DELAY", 30, true);
    registerDefaultPreference("runtime.approverB", "Runtime Approver B", "en", "SYSTEM", "IN_APP_EMAIL", true, "MANUAL_TRIGGER", 0, true);
    registerDefaultPreference("runtime.admin", "Runtime Administrator", "en", "SYSTEM", "IN_APP_EMAIL", true, "AUTO_IMMEDIATE", 0, true);
  }

  private void registerDefaultPreference(
      String userId,
      String displayName,
      String language,
      String theme,
      String channel,
      boolean notificationsEnabled,
      String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly) {
    userPreferencesByUserId.put(
      userId,
      new ProcessRuntimeStorePort.RuntimeUserPreferences(
        userId,
        displayName,
        "",
        language,
        theme,
        channel,
        notificationsEnabled,
        automaticTaskPolicy,
        automaticTaskDelaySeconds,
        automaticTaskNotifyOnly
      )
    );
  }

  @Override
  public List<ProcessRuntimeInstance> listInstances() {
    return new ArrayList<>(byInstanceId.values());
  }

  @Override
  public Optional<ProcessRuntimeInstance> findById(String instanceId) {
    return Optional.ofNullable(byInstanceId.get(instanceId));
  }

  @Override
  public void save(ProcessRuntimeInstance instance) {
    byInstanceId.put(instance.instanceId(), instance);
  }

  @Override
  public Map<String, Object> readSharedData(String entityKey) {
    String normalized = normalizeEntityKey(entityKey);
    if (normalized == null) {
      return Map.of();
    }
    return switch (normalized) {
${readSwitchRows}
    };
  }

  @Override
  public void writeSharedData(String entityKey, Map<String, Object> values) {
    String normalized = normalizeEntityKey(entityKey);
    if (normalized == null) {
      return;
    }
    Map<String, Object> payload = values == null ? Map.of() : values;
    switch (normalized) {
${writeSwitchRows}
    }
  }

  @Override
  public List<String> listSharedDataEntityKeys() {
    List<String> keys = new ArrayList<>();
${listKeyRows}
    keys.sort(String::compareTo);
    return keys;
  }

  @Override
  public void deleteSharedData(String entityKey) {
    String normalized = normalizeEntityKey(entityKey);
    if (normalized == null) {
      return;
    }
    switch (normalized) {
${deleteSwitchRows}
    }
  }

  @Override
  public List<ProcessRuntimeStorePort.RuntimeUserDescriptor> listUsers() {
    return users;
  }

  @Override
  public ProcessRuntimeStorePort.RuntimeOrganizationSnapshot readOrganizationSnapshot() {
    return organizationSnapshot;
  }

  @Override
  public void appendMonitorEvent(ProcessRuntimeStorePort.RuntimeMonitorEvent event) {
    if (event == null) {
      return;
    }
    monitorEvents.add(
      new ProcessRuntimeStorePort.RuntimeMonitorEvent(
        event.eventId(),
        event.occurredAt() == null ? Instant.now() : event.occurredAt(),
        event.actionType(),
        event.actor(),
        event.actorRoleCodes() == null ? List.of() : List.copyOf(event.actorRoleCodes()),
        event.targetType(),
        event.targetId(),
        event.details(),
        event.forced()
      )
    );
  }

  @Override
  public List<ProcessRuntimeStorePort.RuntimeMonitorEvent> listMonitorEvents() {
    return List.copyOf(monitorEvents);
  }

  @Override
  public ProcessRuntimeStorePort.RuntimeUserPreferences readUserPreferences(String userId) {
    if (userId == null || userId.isBlank()) {
      return null;
    }
    return userPreferencesByUserId.get(userId);
  }

  @Override
  public void saveUserPreferences(ProcessRuntimeStorePort.RuntimeUserPreferences preferences) {
    if (preferences == null || preferences.userId() == null || preferences.userId().isBlank()) {
      return;
    }
    userPreferencesByUserId.put(
      preferences.userId(),
      new ProcessRuntimeStorePort.RuntimeUserPreferences(
        preferences.userId(),
        preferences.profileDisplayName(),
        preferences.profilePhotoUrl(),
        preferences.preferredLanguage(),
        preferences.preferredTheme(),
        preferences.notificationChannel(),
        preferences.notificationsEnabled(),
        preferences.automaticTaskPolicy(),
        preferences.automaticTaskDelaySeconds(),
        preferences.automaticTaskNotifyOnly()
      )
    );
  }

  private String normalizeEntityKey(String value) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim().toLowerCase().replaceAll("[^a-z0-9._-]+", "-").replaceAll("^-+|-+$", "");
    return normalized.isBlank() ? null : normalized;
  }

  private <T> T coerce(Object raw, Class<T> targetType) {
    if (raw == null) {
      return null;
    }
    try {
      return objectMapper.convertValue(raw, targetType);
    } catch (IllegalArgumentException error) {
      return null;
    }
  }

  private String toJsonText(Object raw) {
    if (raw == null) {
      return null;
    }
    if (raw instanceof String text) {
      return text;
    }
    try {
      return objectMapper.writeValueAsString(raw);
    } catch (JsonProcessingException error) {
      return String.valueOf(raw);
    }
  }
}
`;
}

function buildProcessSharedDataLiquibaseChangelogYaml({ sharedEntities }) {
  const entities = Array.isArray(sharedEntities) ? sharedEntities : [];
  const rows = ["databaseChangeLog:", "  - changeSet:", "      id: 900-process-shared-data-schema", "      author: prooweb", "      changes:"];
  const createdIndexes = new Set();
  const createdForeignKeys = new Set();
  const createdJoinTables = new Set();

  if (entities.length === 0) {
    rows.push("        - sql:");
    rows.push("            splitStatements: false");
    rows.push("            sql: \"-- No modeled shared entities deployed yet.\"");
    return `${rows.join("\n")}\n`;
  }

  for (const entity of entities) {
    rows.push("        - createTable:");
    rows.push(`            tableName: ${entity.tableName}`);
    rows.push("            columns:");
    rows.push("              - column:");
    rows.push("                  name: id");
    rows.push("                  type: bigint");
    rows.push("                  autoIncrement: true");
    rows.push("                  constraints:");
    rows.push("                    primaryKey: true");
    rows.push(`                    primaryKeyName: pk_${entity.tableName}`);

    for (const field of entity.fields) {
      rows.push("              - column:");
      rows.push(`                  name: ${field.columnName}`);
      rows.push(`                  type: ${mapSharedFieldTypeToLiquibase(field.type)}`);
      rows.push("                  constraints:");
      rows.push(`                    nullable: ${field.required ? "false" : "true"}`);
      if (field.unique) {
        rows.push("                    unique: true");
      }
    }

    for (const relation of entity.relations) {
      if (relation.type === "MANY_TO_ONE" || (relation.type === "ONE_TO_ONE" && !relation.mappedBy)) {
        const columnName = relation.joinColumn || toDefaultJoinColumnName(relation.name);
        rows.push("              - column:");
        rows.push(`                  name: ${columnName}`);
        rows.push("                  type: bigint");
        rows.push("                  constraints:");
        rows.push(`                    nullable: ${relation.required ? "false" : "true"}`);
      }
    }
  }

  for (const entity of entities) {
    for (const field of entity.fields.filter((entry) => entry.indexed || entry.unique)) {
      const indexName = `idx_${entity.tableName}_${field.columnName}`;
      if (createdIndexes.has(indexName)) {
        continue;
      }
      createdIndexes.add(indexName);
      rows.push("        - createIndex:");
      rows.push(`            indexName: ${indexName}`);
      rows.push(`            tableName: ${entity.tableName}`);
      if (field.unique) {
        rows.push("            unique: true");
      }
      rows.push("            columns:");
      rows.push("              - column:");
      rows.push(`                  name: ${field.columnName}`);
    }

    for (const relation of entity.relations) {
      const target = entities.find((entry) => entry.entityKey === relation.targetEntityKey);
      if (!target) {
        continue;
      }
      if (relation.type === "MANY_TO_ONE" || (relation.type === "ONE_TO_ONE" && !relation.mappedBy)) {
        const columnName = relation.joinColumn || toDefaultJoinColumnName(relation.name);
        const foreignKeyName = `fk_${entity.tableName}_${columnName}`;
        if (createdForeignKeys.has(foreignKeyName)) {
          continue;
        }
        createdForeignKeys.add(foreignKeyName);
        rows.push("        - addForeignKeyConstraint:");
        rows.push(`            baseTableName: ${entity.tableName}`);
        rows.push(`            baseColumnNames: ${columnName}`);
        rows.push(`            referencedTableName: ${target.tableName}`);
        rows.push("            referencedColumnNames: id");
        rows.push(`            constraintName: ${foreignKeyName}`);
      }
      if (relation.type === "MANY_TO_MANY" && !relation.mappedBy) {
        const joinTable = relation.joinTable || toDefaultJoinTableName(entity.entityKey, relation.name, relation.targetEntityKey);
        const joinColumn = relation.joinColumn || toDefaultJoinColumnName(entity.entityKey);
        const inverseJoinColumn = relation.inverseJoinColumn || toDefaultJoinColumnName(relation.targetEntityKey);
        if (createdJoinTables.has(joinTable)) {
          continue;
        }
        createdJoinTables.add(joinTable);
        const sourceForeignKeyName = `fk_${joinTable}_${joinColumn}`;
        const targetForeignKeyName = `fk_${joinTable}_${inverseJoinColumn}`;
        createdForeignKeys.add(sourceForeignKeyName);
        createdForeignKeys.add(targetForeignKeyName);
        rows.push("        - createTable:");
        rows.push(`            tableName: ${joinTable}`);
        rows.push("            columns:");
        rows.push("              - column:");
        rows.push(`                  name: ${joinColumn}`);
        rows.push("                  type: bigint");
        rows.push("                  constraints:");
        rows.push("                    nullable: false");
        rows.push("              - column:");
        rows.push(`                  name: ${inverseJoinColumn}`);
        rows.push("                  type: bigint");
        rows.push("                  constraints:");
        rows.push("                    nullable: false");
        rows.push("        - addPrimaryKey:");
        rows.push(`            tableName: ${joinTable}`);
        rows.push(`            columnNames: ${joinColumn}, ${inverseJoinColumn}`);
        rows.push(`            constraintName: pk_${joinTable}`);
        rows.push("        - addForeignKeyConstraint:");
        rows.push(`            baseTableName: ${joinTable}`);
        rows.push(`            baseColumnNames: ${joinColumn}`);
        rows.push(`            referencedTableName: ${entity.tableName}`);
        rows.push("            referencedColumnNames: id");
        rows.push(`            constraintName: ${sourceForeignKeyName}`);
        rows.push("        - addForeignKeyConstraint:");
        rows.push(`            baseTableName: ${joinTable}`);
        rows.push(`            baseColumnNames: ${inverseJoinColumn}`);
        rows.push(`            referencedTableName: ${target.tableName}`);
        rows.push("            referencedColumnNames: id");
        rows.push(`            constraintName: ${targetForeignKeyName}`);
      }
    }
  }

  return `${rows.join("\n")}\n`;
}

function normalizeLiquibaseResourcePath(rawPath) {
  const normalized = String(rawPath || "").trim();
  if (!normalized) {
    return "db/changelog/db.changelog-master.yaml";
  }
  const withoutClasspathPrefix = normalized.toLowerCase().startsWith("classpath:")
    ? normalized.slice("classpath:".length)
    : normalized;
  return withoutClasspathPrefix.replace(/^\/+/, "") || "db/changelog/db.changelog-master.yaml";
}

function resolveLiquibaseResourceLayout(workspaceConfig) {
  const configuredPath = workspaceConfig?.backendOptions?.databaseMigration?.changelogPath;
  const masterResourcePath = normalizeLiquibaseResourcePath(configuredPath);
  const masterDirectory = path.posix.dirname(masterResourcePath);
  const changesetsDirectory = masterDirectory === "." ? "changesets" : `${masterDirectory}/changesets`;
  return {
    masterResourcePath,
    baselineResourcePath: `${changesetsDirectory}/001-baseline-schema.yaml`,
    referenceDataResourcePath: `${changesetsDirectory}/010-reference-data.yaml`,
    generatedProcessSharedDataResourcePath: `${changesetsDirectory}/900-process-shared-data.generated.yaml`,
  };
}

function buildLiquibaseMasterWithProcessSharedDataYaml(liquibaseLayout) {
  const layout = liquibaseLayout || resolveLiquibaseResourceLayout({});
  const masterDirectory = path.posix.dirname(layout.masterResourcePath);
  const relativeBaseline = path.posix.relative(masterDirectory, layout.baselineResourcePath) || "changesets/001-baseline-schema.yaml";
  const relativeReference = path.posix.relative(masterDirectory, layout.referenceDataResourcePath) || "changesets/010-reference-data.yaml";
  const relativeGenerated = path.posix.relative(masterDirectory, layout.generatedProcessSharedDataResourcePath) || "changesets/900-process-shared-data.generated.yaml";
  return `databaseChangeLog:
  - include:
      file: ${relativeBaseline}
      relativeToChangelogFile: true
  - include:
      file: ${relativeReference}
      relativeToChangelogFile: true
  - include:
      file: ${relativeGenerated}
      relativeToChangelogFile: true
`;
}

function escapeJavaSingle(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function toJavaString(value) {
  return `"${escapeJavaString(value)}"`;
}

function toJavaList(values) {
  const source = Array.isArray(values) ? values : [];
  if (source.length === 0) {
    return "List.of()";
  }

  return `List.of(${source.map((entry) => toJavaString(entry)).join(", ")})`;
}

function toJavaValue(value) {
  if (value === null || value === undefined) {
    return toJavaString("");
  }

  if (typeof value === "string") {
    return toJavaString(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "List.of()";
    }
    return `List.of(${value.map((entry) => toJavaValue(entry)).join(", ")})`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "Map.of()";
    }
    return `Map.ofEntries(${entries
      .map(([key, entryValue]) => `Map.entry(${toJavaString(key)}, ${toJavaValue(entryValue)})`)
      .join(", ")})`;
  }

  return toJavaString(String(value));
}

function toDeploymentId() {
  return `process-deploy-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function getManagedFilePath(rootDir) {
  return path.join(rootDir, ".prooweb", "process-models", "managed-files.json");
}

function readManagedFileIndex(rootDir) {
  const managedFilePath = getManagedFilePath(rootDir);
  if (!fs.existsSync(managedFilePath)) {
    return {
      schemaVersion: 1,
      files: {},
    };
  }

  try {
    const raw = fs.readFileSync(managedFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      files: parsed && typeof parsed.files === "object" && !Array.isArray(parsed.files)
        ? parsed.files
        : {},
    };
  } catch (_) {
    return {
      schemaVersion: 1,
      files: {},
    };
  }
}

function writeManagedFileIndex(rootDir, index) {
  const managedFilePath = getManagedFilePath(rootDir);
  fs.mkdirSync(path.dirname(managedFilePath), { recursive: true });
  fs.writeFileSync(managedFilePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

function backupProjectFile(rootDir, deploymentId, relativePath) {
  const sourcePath = resolveSafeAbsolutePath(rootDir, relativePath);
  const backupRelativePath = path.join(".prooweb", "backups", deploymentId, toPosixPath(relativePath));
  const backupAbsolutePath = resolveSafeAbsolutePath(rootDir, backupRelativePath);

  fs.mkdirSync(path.dirname(backupAbsolutePath), { recursive: true });
  fs.copyFileSync(sourcePath, backupAbsolutePath);

  return toPosixPath(path.relative(rootDir, backupAbsolutePath));
}

function buildBackendDefinitionClass({
  basePackage,
  modelKey,
  versionNumber,
  processName,
}) {
  const className = `${processName}ProcessV${versionNumber}Spec`;
  const bpmnResourcePath = `classpath:processes/${modelKey}/v${versionNumber}.bpmn`;

  return `package ${basePackage}.system.domain.process;

public record ${className}(String modelKey, int versionNumber, String bpmnResourcePath) {
  public static ${className} definition() {
    return new ${className}("${escapeJavaString(modelKey)}", ${versionNumber}, "${escapeJavaString(bpmnResourcePath)}");
  }
}
`;
}

function buildBackendRegistryClass({ basePackage, runtimeEntries }) {
  const rows = runtimeEntries.map(({ entry, dataEntry }) => {
    const bpmnPath = `classpath:${entry.bpmnResourcePath}`;
    const runtimePath = `classpath:${entry.runtimeContractResourcePath}`;
    const dataPath = `classpath:${dataEntry?.dataContractResourcePath || ""}`;
    const startableRolesCsv = Array.isArray(entry.startableByRoles) ? entry.startableByRoles.join(",") : "";
    const monitorRolesCsv = Array.isArray(entry.monitorRoles) ? entry.monitorRoles.join(",") : "";
    return `      new ProcessDeploymentDescriptor("${escapeJavaString(entry.modelKey)}", ${entry.versionNumber}, "${escapeJavaString(
      bpmnPath,
    )}", "${escapeJavaString(runtimePath)}", "${escapeJavaString(dataPath)}", ${entry.summary?.manualActivityCount || 0}, ${entry.summary?.automaticActivityCount || 0}, ${dataEntry?.summary?.sharedDataEntityCount || 0}, ${dataEntry?.summary?.outputMappingCount || 0}, "${escapeJavaString(
      startableRolesCsv,
    )}", "${escapeJavaString(monitorRolesCsv)}")`;
  });

  const entries = rows.length > 0 ? rows.join(",\n") : "";

  return `package ${basePackage}.system.domain.process;

import java.util.List;

public final class GeneratedProcessRegistry {
  private GeneratedProcessRegistry() {
  }

  public record ProcessDeploymentDescriptor(
      String modelKey,
      int versionNumber,
      String bpmnResourcePath,
      String runtimeContractResourcePath,
      String dataContractResourcePath,
      int manualActivityCount,
      int automaticActivityCount,
      int sharedDataEntityCount,
      int dataMappingCount,
      String startableByRolesCsv,
      String monitorRolesCsv) {
  }

  public static List<ProcessDeploymentDescriptor> deployedProcesses() {
    return List.of(
${entries}
    );
  }
}
`;
}

function buildFrontendDescriptorModule({
  model,
  version,
  processName,
  runtimeContract,
  runtimeCatalogEntry,
  dataContract,
  dataCatalogEntry,
}) {
  const exportName = `${processName}ProcessV${version.versionNumber}Descriptor`;

  return `export const ${exportName} = Object.freeze({
  modelKey: ${JSON.stringify(model.modelKey)},
  title: ${JSON.stringify(model.title)},
  description: ${JSON.stringify(model.description || "")},
  versionNumber: ${version.versionNumber},
  status: ${JSON.stringify(version.status)},
  deployedAt: ${JSON.stringify(version.deployedAt || null)},
  startableByRoles: ${JSON.stringify(runtimeContract.start.startableByRoles)},
  monitorRoles: ${JSON.stringify(runtimeContract.monitors.monitorRoles)},
  runtimeSummary: ${JSON.stringify(runtimeContract.summary)},
  runtimeContractPath: ${JSON.stringify(runtimeCatalogEntry.runtimeContractResourcePath)},
  dataSummary: ${JSON.stringify(dataContract.summary)},
  dataContractPath: ${JSON.stringify(dataCatalogEntry.dataContractResourcePath)},
  sharedDataEntities: ${JSON.stringify(dataCatalogEntry.sharedDataEntities)},
});

export default ${exportName};
`;
}

function buildFrontendRegistryModule(runtimeEntries) {
  const entries = runtimeEntries.map(({ entry, dataEntry }) => ({
    modelKey: entry.modelKey,
    title: entry.title,
    description: entry.description,
    versionNumber: entry.versionNumber,
    status: entry.status,
    deployedAt: entry.deployedAt,
    bpmnResourcePath: entry.bpmnResourcePath,
    metadataResourcePath: entry.metadataResourcePath,
    runtimeContractResourcePath: entry.runtimeContractResourcePath,
    startableByRoles: entry.startableByRoles,
    monitorRoles: entry.monitorRoles,
    runtimeSummary: entry.summary,
    dataContractResourcePath: dataEntry?.dataContractResourcePath || null,
    dataSummary: dataEntry?.summary || null,
    sharedDataEntities: dataEntry?.sharedDataEntities || [],
  }));

  return `export const generatedProcessRegistry = Object.freeze(${JSON.stringify(entries, null, 2)});

export function findGeneratedProcessDescriptor(modelKey) {
  return generatedProcessRegistry.find((entry) => entry.modelKey === String(modelKey || "")) || null;
}

export function findStartableProcessesByRole(roleCode) {
  const normalizedRole = String(roleCode || "").trim();
  return generatedProcessRegistry.filter((entry) => entry.startableByRoles.includes(normalizedRole));
}
`;
}

function buildFrontendRuntimeContractModule({ runtimeContract, processName, versionNumber }) {
  const exportName = `${processName}ProcessV${versionNumber}RuntimeContract`;
  return `export const ${exportName} = Object.freeze(${JSON.stringify(runtimeContract, null, 2)});

export default ${exportName};
`;
}

function buildFrontendDataContractModule({ dataContract, processName, versionNumber }) {
  const exportName = `${processName}ProcessV${versionNumber}DataContract`;
  return `export const ${exportName} = Object.freeze(${JSON.stringify(dataContract, null, 2)});

export default ${exportName};
`;
}

function buildFrontendDataLineageCatalogModule(runtimeEntries) {
  const rows = [];

  for (const { entry, dataContract } of runtimeEntries) {
    for (const edge of dataContract?.lineage?.edges || []) {
      rows.push({
        modelKey: entry.modelKey,
        versionNumber: entry.versionNumber,
        edgeType: edge.edgeType,
        activityId: edge.activityId,
        sourceType: edge.sourceType || null,
        sourceRef: edge.sourceRef || null,
        storageTarget: edge.storageTarget || null,
        sourcePath: edge.sourcePath || null,
        targetPath: edge.targetPath || null,
      });
    }
  }

  return `export const generatedProcessDataLineageCatalog = Object.freeze(${JSON.stringify(rows, null, 2)});

export function listDataLineageForProcess(modelKey, versionNumber) {
  const key = String(modelKey || "").trim();
  const version = Number.parseInt(String(versionNumber || ""), 10);
  return generatedProcessDataLineageCatalog.filter(
    (entry) => entry.modelKey === key && entry.versionNumber === version,
  );
}
`;
}

function buildFrontendTaskInboxCatalogModule(runtimeEntries) {
  const manualTaskRows = [];
  for (const { entry, runtimeContract } of runtimeEntries) {
    for (const activity of runtimeContract.activities || []) {
      if (activity.activityType !== "MANUAL") {
        continue;
      }

      manualTaskRows.push({
        modelKey: entry.modelKey,
        versionNumber: entry.versionNumber,
        activityId: activity.activityId,
        candidateRoles: activity.candidateRoles || [],
        assignmentMode: activity.assignment?.mode || "AUTOMATIC",
        assignmentStrategy: activity.assignment?.strategy || "ROLE_QUEUE",
        activityViewerRoles: activity.visibility?.activityViewerRoles || [],
        dataViewerRoles: activity.visibility?.dataViewerRoles || [],
      });
    }
  }

  return `export const generatedManualTaskCatalog = Object.freeze(${JSON.stringify(manualTaskRows, null, 2)});

export function listManualTasksByRole(roleCode) {
  const normalizedRole = String(roleCode || "").trim();
  return generatedManualTaskCatalog.filter((entry) => entry.candidateRoles.includes(normalizedRole));
}
`;
}

function buildFrontendProcessFormCatalogModule(runtimeEntries) {
  const rows = [];

  for (const { entry, runtimeContract } of runtimeEntries) {
    for (const activity of runtimeContract.activities || []) {
      if (activity.activityType !== "MANUAL") {
        continue;
      }

      const inputFields = [];
      for (const source of activity.input?.sources || []) {
        for (const mapping of source.mappings || []) {
          const targetPath = String(mapping.to || "").trim();
          if (!targetPath) {
            continue;
          }

          inputFields.push({
            sourceType: source.sourceType || "PROCESS_CONTEXT",
            sourceRef: source.sourceRef || "",
            sourcePath: mapping.from || "",
            targetPath,
            label: targetPath,
          });
        }
      }

      const outputFields = (activity.output?.mappings || []).map((mapping) => ({
        sourcePath: mapping.from || "",
        targetPath: mapping.to || "",
      }));

      rows.push({
        modelKey: entry.modelKey,
        versionNumber: entry.versionNumber,
        activityId: activity.activityId,
        activityType: activity.activityType,
        candidateRoles: activity.candidateRoles || [],
        activityViewerRoles: activity.visibility?.activityViewerRoles || [],
        dataViewerRoles: activity.visibility?.dataViewerRoles || [],
        outputStorage: activity.output?.storage || "INSTANCE",
        inputFields,
        outputFields,
      });
    }
  }

  return `export const generatedProcessFormCatalog = Object.freeze(${JSON.stringify(rows, null, 2)});

export function listProcessFormDefinitions(modelKey, versionNumber) {
  const normalizedModelKey = String(modelKey || "").trim();
  const normalizedVersion = Number.parseInt(String(versionNumber || ""), 10);
  return generatedProcessFormCatalog.filter(
    (entry) => entry.modelKey === normalizedModelKey && entry.versionNumber === normalizedVersion,
  );
}

export function findProcessActivityFormDefinition(modelKey, versionNumber, activityId) {
  const normalizedActivityId = String(activityId || "").trim();
  return listProcessFormDefinitions(modelKey, versionNumber).find(
    (entry) => entry.activityId === normalizedActivityId,
  ) || null;
}
`;
}

function buildBackendRuntimeCatalogJson(runtimeEntries) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      entries: runtimeEntries.map(({ entry }) => entry),
    },
    null,
    2,
  ) + "\n";
}

function buildBackendDataCatalogJson(runtimeEntries) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      entries: runtimeEntries.map(({ dataEntry }) => dataEntry),
    },
    null,
    2,
  ) + "\n";
}

function collectUsedAutomaticTaskTypeKeys(runtimeEntries) {
  const keys = new Set();
  for (const runtimeEntry of runtimeEntries || []) {
    for (const activity of runtimeEntry?.runtimeContract?.activities || []) {
      if (String(activity?.activityType || "").toUpperCase() !== "AUTOMATIC") {
        continue;
      }
      const taskTypeKey = String(activity?.automaticExecution?.taskTypeKey || "").trim().toLowerCase() || "core.echo";
      keys.add(taskTypeKey);
    }
  }
  return Array.from(keys).sort((left, right) => left.localeCompare(right));
}

function resolveUsedAutomaticTaskTypes(automaticTaskCatalog, runtimeEntries) {
  const usedKeys = collectUsedAutomaticTaskTypeKeys(runtimeEntries);
  const catalogRows = Array.isArray(automaticTaskCatalog?.taskTypes)
    ? automaticTaskCatalog.taskTypes
    : [];
  const usedTaskTypes = [];
  const missingTaskTypes = [];

  for (const key of usedKeys) {
    const row = catalogRows.find((entry) => entry.taskTypeKey === key) || null;
    if (!row) {
      missingTaskTypes.push(key);
      continue;
    }
    usedTaskTypes.push(row);
  }

  return {
    usedKeys,
    usedTaskTypes,
    missingTaskTypes,
  };
}

function buildBackendAutomaticTaskCatalogJson({
  usedTaskTypes,
  libraryCatalog,
  missingTaskTypes,
}) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      usedTaskTypes: Array.isArray(usedTaskTypes) ? usedTaskTypes : [],
      missingTaskTypes: Array.isArray(missingTaskTypes) ? missingTaskTypes : [],
      libraries: {
        maven: Array.isArray(libraryCatalog?.maven) ? libraryCatalog.maven : [],
        npm: Array.isArray(libraryCatalog?.npm) ? libraryCatalog.npm : [],
      },
    },
    null,
    2,
  ) + "\n";
}

function buildGeneratedProcessRuntimeCatalogJava({ basePackage, runtimeEntries }) {
  const processRows = runtimeEntries.map(({ entry, runtimeContract, dataContract }) => {
    const activityRows = (runtimeContract.activities || []).map((activity) => {
      const automaticHandlerRef = activity.automaticExecution?.handlerRef || "";
      const automaticTaskTypeKey = activity.automaticExecution?.taskTypeKey || "core.echo";
      const automaticConfiguration = activity.automaticExecution?.configuration || {};
      const inputSourceRows = (activity.input?.sources || []).map((source) => {
        const sourceMappingRows = (source.mappings || []).map((mapping) =>
          `            new FieldMappingDescriptor(${toJavaString(mapping.from || "")}, ${toJavaString(mapping.to || "")})`);
        const sourceMappingsLiteral = sourceMappingRows.length > 0
          ? `List.of(\n${sourceMappingRows.join(",\n")}\n          )`
          : "List.of()";

        return `          new InputSourceDescriptor(${toJavaString(source.sourceType || "PROCESS_CONTEXT")}, ${toJavaString(
          source.sourceRef || "",
        )}, ${sourceMappingsLiteral})`;
      });
      const inputSourcesLiteral = inputSourceRows.length > 0
        ? `List.of(\n${inputSourceRows.join(",\n")}\n        )`
        : "List.of()";
      const outputMappingRows = (activity.output?.mappings || []).map((mapping) =>
        `          new FieldMappingDescriptor(${toJavaString(mapping.from || "")}, ${toJavaString(mapping.to || "")})`);
      const outputMappingsLiteral = outputMappingRows.length > 0
        ? `List.of(\n${outputMappingRows.join(",\n")}\n        )`
        : "List.of()";

      return `        new ActivityDescriptor(${toJavaString(activity.activityId)}, ${toJavaString(activity.activityType)}, ${toJavaList(
        activity.candidateRoles || [],
      )}, ${toJavaString(activity.assignment?.mode || "AUTOMATIC")}, ${toJavaString(
        activity.assignment?.strategy || "ROLE_QUEUE",
      )}, ${Boolean(activity.assignment?.allowPreviouslyAssignedAssignee)}, ${toJavaList(
        activity.assignment?.manualAssignerRoles || [],
      )}, ${Number.isFinite(Number(activity.assignment?.maxAssignees))
        ? Number(activity.assignment.maxAssignees)
        : 1}, ${toJavaString(automaticHandlerRef)}, ${toJavaString(automaticTaskTypeKey)}, ${toJavaValue(
        automaticConfiguration,
      )}, ${toJavaList(activity.visibility?.activityViewerRoles || [])}, ${toJavaList(
        activity.visibility?.dataViewerRoles || [],
      )}, ${inputSourcesLiteral}, ${toJavaString(activity.output?.storage || "INSTANCE")}, ${outputMappingsLiteral})`;
    });
    const transitionRows = (runtimeContract.flow?.transitions || []).map((transition) =>
      `        new TransitionDescriptor(${toJavaString(transition.sourceActivityId)}, ${toJavaString(transition.targetActivityId)})`);
    const sharedEntityRows = (dataContract?.sharedData?.entities || []).map((sharedEntity) => {
      const fieldRows = (sharedEntity.fields || []).map((field) =>
        `            new SharedFieldDescriptor(${toJavaString(field.name || "")}, ${toJavaString(
          field.type || "STRING",
        )}, ${Boolean(field.required)}, ${Boolean(field.indexed)}, ${Boolean(field.unique)})`);
      const fieldsLiteral = fieldRows.length > 0
        ? `List.of(\n${fieldRows.join(",\n")}\n          )`
        : "List.of()";
      const relationRows = (sharedEntity.relations || []).map((relation) =>
        `            new SharedRelationDescriptor(${toJavaString(relation.name || "")}, ${toJavaString(
          relation.type || "MANY_TO_ONE",
        )}, ${toJavaString(relation.targetEntityKey || "")}, ${toJavaString(relation.mappedBy || "")}, ${toJavaString(
          relation.joinColumn || "",
        )}, ${toJavaString(relation.joinTable || "")}, ${toJavaString(relation.inverseJoinColumn || "")}, ${Boolean(
          relation.required,
        )})`);
      const relationsLiteral = relationRows.length > 0
        ? `List.of(\n${relationRows.join(",\n")}\n          )`
        : "List.of()";
      return `        new SharedEntityDescriptor(${toJavaString(sharedEntity.entityKey || "")}, ${toJavaString(
        sharedEntity.displayName || sharedEntity.entityKey || "",
      )}, ${toJavaString(sharedEntity.tableName || "")}, ${Boolean(sharedEntity.modeled === true)}, ${fieldsLiteral}, ${relationsLiteral})`;
    });

    const activitiesLiteral = activityRows.length > 0 ? `List.of(\n${activityRows.join(",\n")}\n      )` : "List.of()";
    const transitionsLiteral = transitionRows.length > 0 ? `List.of(\n${transitionRows.join(",\n")}\n      )` : "List.of()";
    const sharedEntitiesLiteral = sharedEntityRows.length > 0 ? `List.of(\n${sharedEntityRows.join(",\n")}\n      )` : "List.of()";
    return `      new ProcessDescriptor(
        ${toJavaString(entry.modelKey)},
        ${entry.versionNumber},
        ${toJavaList(runtimeContract.start?.startableByRoles || [])},
        ${toJavaList(runtimeContract.start?.startActivities || [])},
        ${activitiesLiteral},
        ${transitionsLiteral},
        ${sharedEntitiesLiteral}
      )`;
  });

  const processListLiteral = processRows.length > 0 ? processRows.join(",\n") : "";

  return `package ${basePackage}.system.domain.process.runtime;

import java.util.List;
import java.util.Optional;
import java.util.Map;

public final class GeneratedProcessRuntimeCatalog {
  private GeneratedProcessRuntimeCatalog() {
  }

  public record FieldMappingDescriptor(
      String from,
      String to) {
  }

  public record InputSourceDescriptor(
      String sourceType,
      String sourceRef,
      List<FieldMappingDescriptor> mappings) {
  }

  public record ActivityDescriptor(
      String activityId,
      String activityType,
      List<String> candidateRoles,
      String assignmentMode,
      String assignmentStrategy,
      boolean allowPreviouslyAssignedAssignee,
      List<String> manualAssignerRoles,
      int maxAssignees,
      String automaticHandlerRef,
      String automaticTaskTypeKey,
      Map<String, Object> automaticConfiguration,
      List<String> activityViewerRoles,
      List<String> dataViewerRoles,
      List<InputSourceDescriptor> inputSources,
      String outputStorage,
      List<FieldMappingDescriptor> outputMappings) {
  }

  public record TransitionDescriptor(
      String sourceActivityId,
      String targetActivityId) {
  }

  public record SharedFieldDescriptor(
      String name,
      String type,
      boolean required,
      boolean indexed,
      boolean unique) {
  }

  public record SharedRelationDescriptor(
      String name,
      String type,
      String targetEntityKey,
      String mappedBy,
      String joinColumn,
      String joinTable,
      String inverseJoinColumn,
      boolean required) {
  }

  public record SharedEntityDescriptor(
      String entityKey,
      String displayName,
      String tableName,
      boolean modeled,
      List<SharedFieldDescriptor> fields,
      List<SharedRelationDescriptor> relations) {
  }

  public record ProcessDescriptor(
      String modelKey,
      int versionNumber,
      List<String> startableByRoles,
      List<String> startActivities,
      List<ActivityDescriptor> activities,
      List<TransitionDescriptor> transitions,
      List<SharedEntityDescriptor> sharedEntities) {
  }

  public static List<ProcessDescriptor> deployedProcesses() {
    return List.of(
${processListLiteral}
    );
  }

  public static Optional<ProcessDescriptor> find(String modelKey, int versionNumber) {
    return deployedProcesses().stream()
      .filter((entry) -> entry.modelKey().equals(modelKey) && entry.versionNumber() == versionNumber)
      .findFirst();
  }
}
`;
}

function buildProcessRuntimeStateJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

public enum ProcessRuntimeState {
  RUNNING,
  STOPPED,
  ARCHIVED,
  COMPLETED
}
`;
}

function buildProcessRuntimeTaskStateJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

public enum ProcessRuntimeTaskState {
  PENDING,
  COMPLETED,
  CANCELLED
}
`;
}

function buildProcessRuntimeTaskJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public class ProcessRuntimeTask {
  private final String taskId;
  private final String activityId;
  private final String activityType;
  private String assignee;
  private String assignedBy;
  private Instant assignedAt;
  private ProcessRuntimeTaskState state;
  private final Map<String, Object> inputData;
  private final Map<String, Object> outputData;
  private final String automaticTaskPolicy;
  private final Instant autoExecuteAt;
  private final Instant createdAt;
  private Instant completedAt;

  public ProcessRuntimeTask(String taskId, String activityId, String assignee, Map<String, Object> inputData) {
    this(taskId, activityId, "MANUAL", assignee, inputData, "NONE", null);
  }

  public ProcessRuntimeTask(
      String taskId,
      String activityId,
      String activityType,
      String assignee,
      Map<String, Object> inputData,
      String automaticTaskPolicy,
      Instant autoExecuteAt) {
    this.taskId = taskId;
    this.activityId = activityId;
    this.activityType = activityType == null || activityType.isBlank() ? "MANUAL" : activityType;
    this.assignee = assignee;
    this.assignedBy = assignee == null || assignee.isBlank() ? null : "SYSTEM";
    this.assignedAt = assignee == null || assignee.isBlank() ? null : Instant.now();
    this.state = ProcessRuntimeTaskState.PENDING;
    this.inputData = new HashMap<>(inputData == null ? Map.of() : inputData);
    this.outputData = new HashMap<>();
    this.automaticTaskPolicy = automaticTaskPolicy == null || automaticTaskPolicy.isBlank()
      ? "NONE"
      : automaticTaskPolicy;
    this.autoExecuteAt = autoExecuteAt;
    this.createdAt = Instant.now();
  }

  public String taskId() {
    return taskId;
  }

  public String activityId() {
    return activityId;
  }

  public String activityType() {
    return activityType;
  }

  public String assignee() {
    return assignee;
  }

  public String assignedBy() {
    return assignedBy;
  }

  public Instant assignedAt() {
    return assignedAt;
  }

  public ProcessRuntimeTaskState state() {
    return state;
  }

  public Map<String, Object> inputData() {
    return Map.copyOf(inputData);
  }

  public Map<String, Object> outputData() {
    return Map.copyOf(outputData);
  }

  public String automaticTaskPolicy() {
    return automaticTaskPolicy;
  }

  public Instant autoExecuteAt() {
    return autoExecuteAt;
  }

  public Instant createdAt() {
    return createdAt;
  }

  public Instant completedAt() {
    return completedAt;
  }

  public boolean isAssigned() {
    return assignee != null && !assignee.isBlank();
  }

  public void assign(String assignee, String actor) {
    this.assignee = assignee == null || assignee.isBlank() ? null : assignee;
    this.assignedBy = actor == null || actor.isBlank() ? "SYSTEM" : actor;
    this.assignedAt = this.assignee == null ? null : Instant.now();
  }

  public void unassign(String actor) {
    this.assignee = null;
    this.assignedBy = actor == null || actor.isBlank() ? "SYSTEM" : actor;
    this.assignedAt = null;
  }

  public void complete(Map<String, Object> outputPayload) {
    this.state = ProcessRuntimeTaskState.COMPLETED;
    this.outputData.clear();
    if (outputPayload != null) {
      this.outputData.putAll(outputPayload);
    }
    this.completedAt = Instant.now();
  }
}
`;
}

function buildProcessRuntimeInstanceJava({ basePackage }) {
  return `package ${basePackage}.system.domain.process.runtime;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class ProcessRuntimeInstance {
  private final String instanceId;
  private final String modelKey;
  private final int versionNumber;
  private final String startedBy;
  private ProcessRuntimeState state;
  private final Instant startedAt;
  private Instant updatedAt;
  private String archivedBy;
  private String stoppedBy;
  private String stopReason;
  private final List<ProcessRuntimeTask> tasks;
  private final List<String> timeline;
  private final Map<String, Object> contextData;
  private final Map<String, Map<String, Object>> activityOutputs;

  public ProcessRuntimeInstance(String instanceId, String modelKey, int versionNumber, String startedBy, Map<String, Object> initialPayload) {
    this.instanceId = instanceId;
    this.modelKey = modelKey;
    this.versionNumber = versionNumber;
    this.startedBy = startedBy;
    this.state = ProcessRuntimeState.RUNNING;
    this.startedAt = Instant.now();
    this.updatedAt = this.startedAt;
    this.tasks = new ArrayList<>();
    this.timeline = new ArrayList<>();
    this.contextData = new HashMap<>(initialPayload == null ? Map.of() : initialPayload);
    this.activityOutputs = new HashMap<>();
  }

  public String instanceId() {
    return instanceId;
  }

  public String modelKey() {
    return modelKey;
  }

  public int versionNumber() {
    return versionNumber;
  }

  public String startedBy() {
    return startedBy;
  }

  public ProcessRuntimeState state() {
    return state;
  }

  public Instant startedAt() {
    return startedAt;
  }

  public Instant updatedAt() {
    return updatedAt;
  }

  public String archivedBy() {
    return archivedBy;
  }

  public String stoppedBy() {
    return stoppedBy;
  }

  public String stopReason() {
    return stopReason;
  }

  public List<ProcessRuntimeTask> tasks() {
    return List.copyOf(tasks);
  }

  public List<String> timeline() {
    return List.copyOf(timeline);
  }

  public Map<String, Object> contextData() {
    return Map.copyOf(contextData);
  }

  public void addTimelineEntry(String event) {
    timeline.add(event);
    this.updatedAt = Instant.now();
  }

  public void putContextData(Map<String, Object> values) {
    if (values != null) {
      contextData.putAll(values);
      this.updatedAt = Instant.now();
    }
  }

  public void addTask(ProcessRuntimeTask task) {
    tasks.add(task);
    this.updatedAt = Instant.now();
  }

  public Optional<ProcessRuntimeTask> findTask(String taskId) {
    return tasks.stream().filter((task) -> task.taskId().equals(taskId)).findFirst();
  }

  public void recordActivityOutput(String activityId, Map<String, Object> output) {
    activityOutputs.put(activityId, new HashMap<>(output == null ? Map.of() : output));
    this.updatedAt = Instant.now();
  }

  public Map<String, Object> readActivityOutput(String activityId) {
    return Map.copyOf(activityOutputs.getOrDefault(activityId, Map.of()));
  }

  public void markCompleted() {
    this.state = ProcessRuntimeState.COMPLETED;
    this.updatedAt = Instant.now();
  }

  public void stop(String actor, String reason) {
    this.state = ProcessRuntimeState.STOPPED;
    this.stoppedBy = actor;
    this.stopReason = reason;
    this.updatedAt = Instant.now();
  }

  public void archive(String actor) {
    this.state = ProcessRuntimeState.ARCHIVED;
    this.archivedBy = actor;
    this.updatedAt = Instant.now();
  }
}
`;
}

function buildProcessRuntimeStorePortJava({ basePackage }) {
  return `package ${basePackage}.system.application.process.runtime.port.out;

import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ProcessRuntimeStorePort {
  List<ProcessRuntimeInstance> listInstances();

  Optional<ProcessRuntimeInstance> findById(String instanceId);

  void save(ProcessRuntimeInstance instance);

  Map<String, Object> readSharedData(String entityKey);

  void writeSharedData(String entityKey, Map<String, Object> values);

  List<String> listSharedDataEntityKeys();

  void deleteSharedData(String entityKey);

  List<RuntimeUserDescriptor> listUsers();

  RuntimeOrganizationSnapshot readOrganizationSnapshot();

  void appendMonitorEvent(RuntimeMonitorEvent event);

  List<RuntimeMonitorEvent> listMonitorEvents();

  RuntimeUserPreferences readUserPreferences(String userId);

  void saveUserPreferences(RuntimeUserPreferences preferences);

  record RuntimeUserDescriptor(
      String userId,
      List<String> roleCodes,
      String unitId,
      String supervisorId) {
  }

  record RuntimeOrganizationUnitDescriptor(
      String unitId,
      String parentUnitId,
      String managerUserId,
      List<String> memberUserIds) {
  }

  record RuntimeOrganizationSnapshot(
      List<RuntimeOrganizationUnitDescriptor> units) {
  }

  record RuntimeMonitorEvent(
      String eventId,
      Instant occurredAt,
      String actionType,
      String actor,
      List<String> actorRoleCodes,
      String targetType,
      String targetId,
      String details,
      boolean forced) {
  }

  record RuntimeUserPreferences(
      String userId,
      String profileDisplayName,
      String profilePhotoUrl,
      String preferredLanguage,
      String preferredTheme,
      String notificationChannel,
      boolean notificationsEnabled,
      String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly) {
  }
}
`;
}

function buildProcessRuntimeEngineUseCaseJava({ basePackage }) {
  return `package ${basePackage}.system.application.process.runtime.port.in;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public interface ProcessRuntimeEngineUseCase {
  List<StartOption> listStartOptions(StartOptionsQuery query);

  RuntimeInstanceView startInstance(StartCommand command);

  List<RuntimeInstanceView> listInstances(InstanceQuery query);

  List<RuntimeTaskView> listTasks(TaskQuery query);

  RuntimeTaskView assignTask(AssignTaskCommand command);

  RuntimeTaskView completeTask(CompleteTaskCommand command);

  RuntimeInstanceView readInstance(ReadInstanceQuery query);

  RuntimeInstanceView stopInstance(StopCommand command);

  RuntimeInstanceView archiveInstance(ArchiveCommand command);

  List<MonitorEventView> listMonitorEvents(MonitorEventsQuery query);

  RuntimeUserPreferencesView readUserPreferences(UserPreferencesQuery query);

  RuntimeUserPreferencesView updateUserPreferences(UpdateUserPreferencesCommand command);

  List<String> readTimeline(String instanceId);

  List<SharedDataEntityView> listSharedDataEntities(SharedDataQuery query);

  SharedDataEntityView readSharedDataEntity(ReadSharedDataQuery query);

  SharedDataEntityView upsertSharedDataEntity(UpsertSharedDataCommand command);

  boolean deleteSharedDataEntity(DeleteSharedDataCommand command);

  record StartOptionsQuery(String actor, List<String> roleCodes) {
  }

  record StartCommand(
      String modelKey,
      int versionNumber,
      String startActivityId,
      String actor,
      List<String> roleCodes,
      Map<String, Object> initialPayload) {
  }

  record TaskQuery(String actor, List<String> roleCodes) {
  }

  record InstanceQuery(String actor, List<String> roleCodes) {
  }

  record ReadInstanceQuery(String instanceId, String actor, List<String> roleCodes) {
  }

  record MonitorEventsQuery(
      String actor,
      List<String> roleCodes,
      String instanceId,
      String actionType,
      int limit) {
  }

  record UserPreferencesQuery(
      String actor,
      List<String> roleCodes,
      String targetUserId) {
  }

  record SharedDataQuery(String actor, List<String> roleCodes) {
  }

  record ReadSharedDataQuery(String actor, List<String> roleCodes, String entityKey) {
  }

  record UpsertSharedDataCommand(
      String actor,
      List<String> roleCodes,
      String entityKey,
      Map<String, Object> values) {
  }

  record DeleteSharedDataCommand(
      String actor,
      List<String> roleCodes,
      String entityKey) {
  }

  record CompleteTaskCommand(String instanceId, String taskId, String actor, List<String> roleCodes, Map<String, Object> payload) {
  }

  record AssignTaskCommand(
      String instanceId,
      String taskId,
      String actor,
      List<String> roleCodes,
      String assignee,
      boolean force) {
  }

  record StopCommand(String instanceId, String actor, List<String> roleCodes, String reason) {
  }

  record ArchiveCommand(String instanceId, String actor, List<String> roleCodes) {
  }

  record UpdateUserPreferencesCommand(
      String actor,
      List<String> roleCodes,
      String targetUserId,
      String profileDisplayName,
      String profilePhotoUrl,
      String preferredLanguage,
      String preferredTheme,
      String notificationChannel,
      boolean notificationsEnabled,
      String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly) {
  }

  record StartOption(
      String modelKey,
      int versionNumber,
      List<String> allowedStartActivities,
      List<String> startableByRoles) {
  }

  record RuntimeTaskView(
      String instanceId,
      String taskId,
      String activityId,
      String activityType,
      String assignee,
      String assignmentStatus,
      String assignmentMode,
      String assignmentStrategy,
      List<String> candidateRoles,
      List<String> manualAssignerRoles,
      String automaticTaskPolicy,
      Instant autoExecuteAt,
      String status,
      Instant createdAt,
      Instant assignedAt,
      Instant completedAt,
      Map<String, Object> inputData,
      Map<String, Object> outputData) {
  }

  record RuntimeInstanceView(
      String instanceId,
      String modelKey,
      int versionNumber,
      String status,
      String startedBy,
      Instant startedAt,
      Instant updatedAt,
      String stoppedBy,
      String stopReason,
      String archivedBy,
      List<RuntimeTaskView> tasks) {
  }

  record MonitorEventView(
      String eventId,
      Instant occurredAt,
      String actionType,
      String actor,
      List<String> actorRoleCodes,
      String targetType,
      String targetId,
      String details,
      boolean forced) {
  }

  record RuntimeUserPreferencesView(
      String userId,
      String profileDisplayName,
      String profilePhotoUrl,
      String preferredLanguage,
      String preferredTheme,
      String notificationChannel,
      boolean notificationsEnabled,
      String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly) {
  }

  record SharedDataFieldView(
      String name,
      String type,
      boolean required,
      boolean indexed,
      boolean unique) {
  }

  record SharedDataEntityView(
      String entityKey,
      String displayName,
      String tableName,
      boolean modeled,
      List<SharedDataFieldView> fields,
      Map<String, Object> values) {
  }
}
`;
}

function buildProcessRuntimeEngineServiceJava({
  basePackage,
  customTaskDispatchCases = "      default:\n        return null;",
}) {
  return `package ${basePackage}.system.application.process.runtime.service;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.domain.process.runtime.GeneratedProcessRuntimeCatalog;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeState;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeTask;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeTaskState;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ProcessRuntimeEngineService implements ProcessRuntimeEngineUseCase {
  private static final Logger PROCESS_EVENT_LOGGER = LoggerFactory.getLogger("PROCESS_RUNTIME_AUDIT");
  private final ProcessRuntimeStorePort processRuntimeStorePort;

  public ProcessRuntimeEngineService(ProcessRuntimeStorePort processRuntimeStorePort) {
    this.processRuntimeStorePort = processRuntimeStorePort;
  }

  @Override
  public List<StartOption> listStartOptions(StartOptionsQuery query) {
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    return GeneratedProcessRuntimeCatalog.deployedProcesses().stream()
      .filter((descriptor) -> descriptor.startableByRoles().isEmpty() || descriptor.startableByRoles().stream().anyMatch(roles::contains))
      .map((descriptor) -> {
        List<String> startActivities = descriptor.startActivities();
        if (startActivities == null || startActivities.isEmpty()) {
          startActivities = detectEntryActivities(descriptor, roles);
        } else {
          startActivities = startActivities.stream()
            .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
            .toList();
          if (startActivities.isEmpty()) {
            startActivities = detectEntryActivities(descriptor, roles);
          }
        }

        return new StartOption(
          descriptor.modelKey(),
          descriptor.versionNumber(),
          startActivities,
          descriptor.startableByRoles()
        );
      })
      .toList();
  }

  @Override
  public RuntimeInstanceView startInstance(StartCommand command) {
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(command.modelKey(), command.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Unknown deployed process model/version"));
    List<String> actorRoles = command.roleCodes() == null ? List.of() : command.roleCodes();
    if (!descriptor.startableByRoles().isEmpty() && descriptor.startableByRoles().stream().noneMatch(actorRoles::contains)) {
      throw new IllegalStateException("Actor roles are not allowed to start this process.");
    }

    String startActivityId = resolveStartActivityId(descriptor, command.startActivityId(), actorRoles);
    ProcessRuntimeInstance instance = new ProcessRuntimeInstance(
      "prc-" + UUID.randomUUID(),
      descriptor.modelKey(),
      descriptor.versionNumber(),
      command.actor(),
      command.initialPayload()
    );
    instance.addTimelineEntry("INSTANCE_STARTED:" + command.actor());
    createOrAdvanceTasks(instance, descriptor, startActivityId, command.actor(), command.initialPayload(), true);
    logProcessEvent("INSTANCE_STARTED", instance, startActivityId, command.actor(), null, "startActivityId=" + startActivityId);

    processRuntimeStorePort.save(instance);
    return toInstanceView(instance, descriptor, actorRoles);
  }

  @Override
  public List<RuntimeInstanceView> listInstances(InstanceQuery query) {
    String actor = query.actor();
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(roles);
    List<ProcessRuntimeInstance> runtimeInstances = new ArrayList<>(processRuntimeStorePort.listInstances());
    flushAutomaticTasksForInstances(runtimeInstances);

    return runtimeInstances.stream()
      .filter((instance) -> {
        if (monitorPrivileges) {
          return true;
        }
        if (actor == null || actor.isBlank()) {
          return false;
        }
        GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
          .find(instance.modelKey(), instance.versionNumber())
          .orElse(null);
        return canActorSeeInstance(instance, descriptor, actor, roles);
      })
      .map((instance) -> {
        GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
          .find(instance.modelKey(), instance.versionNumber())
          .orElse(null);
        return toInstanceView(instance, descriptor, roles);
      })
      .toList();
  }

  @Override
  public List<RuntimeTaskView> listTasks(TaskQuery query) {
    String actor = query.actor();
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(roles);
    List<ProcessRuntimeInstance> runtimeInstances = new ArrayList<>(processRuntimeStorePort.listInstances());
    flushAutomaticTasksForInstances(runtimeInstances);
    return runtimeInstances.stream()
      .flatMap((instance) -> {
        GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
          .find(instance.modelKey(), instance.versionNumber())
          .orElse(null);
        return instance.tasks().stream()
          .filter((task) -> task.state() == ProcessRuntimeTaskState.PENDING)
          .filter((task) -> {
            GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = descriptor == null
              ? null
              : findActivity(descriptor, task.activityId()).orElse(null);

            if (monitorPrivileges) {
              if (actor == null || actor.isBlank()) {
                return true;
              }
              return Objects.equals(task.assignee(), actor) || canActorAssignTask(activityDescriptor, roles);
            }

            if (actor == null || actor.isBlank()) {
              return false;
            }

            if (Objects.equals(task.assignee(), actor)) {
              return true;
            }

            if (!task.isAssigned() && canActorAssignTask(activityDescriptor, roles)) {
              return true;
            }

            return false;
          })
          .map((task) -> {
            GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = descriptor == null
              ? null
              : findActivity(descriptor, task.activityId()).orElse(null);
            return toTaskView(instance.instanceId(), task, activityDescriptor, roles);
          });
      })
      .toList();
  }

  @Override
  public RuntimeTaskView assignTask(AssignTaskCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      throw new IllegalStateException("Instance is not running");
    }

    ProcessRuntimeTask task = instance.findTask(command.taskId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown task"));
    if (task.state() != ProcessRuntimeTaskState.PENDING) {
      throw new IllegalStateException("Task is not assignable because it is no longer pending.");
    }

    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Missing deployed descriptor for instance"));
    GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = findActivity(descriptor, task.activityId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown activity in deployed descriptor"));

    String assignee = normalizeActor(command.assignee());
    if (assignee == null) {
      throw new IllegalArgumentException("assignee is required.");
    }

    String actor = normalizeActor(command.actor());
    List<String> actorRoles = command.roleCodes() == null ? List.of() : command.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(actorRoles);
    if (!monitorPrivileges && actor == null) {
      throw new IllegalStateException("actor is required to assign task.");
    }
    if (!monitorPrivileges && !canActorAssignTask(activityDescriptor, actorRoles)) {
      throw new IllegalStateException("Actor is not allowed to assign this task.");
    }
    if (!monitorPrivileges && command.force()) {
      throw new IllegalStateException("Force assignment requires PROCESS_MONITOR or ADMINISTRATOR role.");
    }

    boolean forceMode = monitorPrivileges && command.force();

    AssignmentResolution resolution = resolveManualAssignment(
      instance,
      activityDescriptor,
      command.actor(),
      actorRoles,
      assignee,
      forceMode
    );
    if (resolution.assignee() == null) {
      throw new IllegalStateException("Unable to assign task: " + resolution.reason());
    }

    task.assign(resolution.assignee(), command.actor());
    instance.addTimelineEntry("TASK_ASSIGNED:" + task.activityId() + ":" + resolution.assignee() + ":" + resolution.reason());
    logProcessEvent(
      "TASK_ASSIGNED",
      instance,
      task.activityId(),
      command.actor(),
      resolution.assignee(),
      "reason=" + resolution.reason()
    );
    processRuntimeStorePort.save(instance);
    if (monitorPrivileges || forceMode) {
      appendMonitorEvent(
        "TASK_ASSIGN",
        command.actor(),
        actorRoles,
        "TASK",
        task.taskId(),
        "instanceId=" + instance.instanceId() + ",assignee=" + resolution.assignee() + ",reason=" + resolution.reason(),
        forceMode
      );
    }
    return toTaskView(instance.instanceId(), task, activityDescriptor, actorRoles);
  }

  @Override
  public RuntimeTaskView completeTask(CompleteTaskCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      throw new IllegalStateException("Instance is not running");
    }

    ProcessRuntimeTask task = instance.findTask(command.taskId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown task"));
    if (task.state() != ProcessRuntimeTaskState.PENDING) {
      throw new IllegalStateException("Task already completed or cancelled");
    }

    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElseThrow(() -> new IllegalArgumentException("Missing deployed descriptor for instance"));
    GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = findActivity(descriptor, task.activityId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown activity in deployed descriptor"));
    String actor = normalizeActor(command.actor());
    List<String> actorRoles = command.roleCodes() == null ? List.of() : command.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(actorRoles);
    if (!task.isAssigned()) {
      if (!monitorPrivileges && !canActorAssignTask(activityDescriptor, actorRoles)) {
        throw new IllegalStateException("Task is unassigned and actor cannot resolve assignment.");
      }

      AssignmentResolution autoResolution = resolveAssignment(instance, activityDescriptor, actor, actorRoles, false);
      if (autoResolution.assignee() == null) {
        throw new IllegalStateException("Task requires assignment before completion.");
      }
      task.assign(autoResolution.assignee(), actor);
      instance.addTimelineEntry("TASK_AUTO_ASSIGNED_FOR_COMPLETION:" + task.activityId() + ":" + autoResolution.assignee());
    }

    if (!monitorPrivileges && actor != null && !Objects.equals(task.assignee(), actor)) {
      throw new IllegalStateException("Actor cannot complete a task assigned to another user.");
    }

    Map<String, Object> payload = command.payload() == null ? Map.of() : command.payload();
    Map<String, Object> mappedOutput;
    if ("AUTOMATIC".equals(normalizeUpper(task.activityType(), "MANUAL"))) {
      Map<String, Object> automaticOutput = executeAutomaticActivity(activityDescriptor, task.inputData(), instance);
      mappedOutput = applyOutputMappings(automaticOutput, activityDescriptor.outputMappings());
      instance.addTimelineEntry(
        "AUTOMATIC_TASK_TRIGGERED:"
          + task.activityId()
          + ":"
          + (actor == null ? "SYSTEM" : actor)
      );
    } else {
      mappedOutput = applyOutputMappings(payload, activityDescriptor.outputMappings());
    }

    task.complete(mappedOutput);
    instance.recordActivityOutput(task.activityId(), mappedOutput);
    applyOutputStorage(instance, activityDescriptor, mappedOutput);
    instance.addTimelineEntry("TASK_COMPLETED:" + task.activityId() + ":" + command.actor());
    logProcessEvent(
      "TASK_COMPLETED",
      instance,
      task.activityId(),
      command.actor(),
      task.assignee(),
      "activityType=" + normalizeUpper(task.activityType(), "MANUAL")
    );

    createOrAdvanceTasks(instance, descriptor, task.activityId(), command.actor(), command.payload(), false);

    processRuntimeStorePort.save(instance);
    return toTaskView(instance.instanceId(), task, activityDescriptor, command.roleCodes());
  }

  @Override
  public RuntimeInstanceView readInstance(ReadInstanceQuery query) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(query.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    if (descriptor != null) {
      flushDueAutomaticTasks(instance, descriptor);
    }
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    boolean monitorPrivileges = hasMonitorPrivileges(roles);
    if (!monitorPrivileges) {
      String actor = query.actor();
      if (actor == null || actor.isBlank()) {
        throw new IllegalStateException("actor is required to read this runtime instance.");
      }

      boolean actorCanAccess = Objects.equals(instance.startedBy(), actor)
        || instance.tasks().stream().anyMatch((task) -> Objects.equals(task.assignee(), actor))
        || canRoleConsultInstance(descriptor, roles);
      if (!actorCanAccess) {
        throw new IllegalStateException("Actor is not allowed to access this runtime instance.");
      }
    }

    return toInstanceView(instance, descriptor, roles);
  }

  @Override
  public RuntimeInstanceView stopInstance(StopCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    ensureMonitorPrivilege(command.actor(), roles, "stop runtime instances");
    instance.stop(command.actor(), command.reason());
    instance.addTimelineEntry("INSTANCE_STOPPED:" + command.actor() + ":" + command.reason());
    logProcessEvent(
      "INSTANCE_STOPPED",
      instance,
      null,
      command.actor(),
      null,
      "reason=" + normalizeBlank(command.reason())
    );
    processRuntimeStorePort.save(instance);
    appendMonitorEvent(
      "INSTANCE_STOP",
      command.actor(),
      roles,
      "INSTANCE",
      instance.instanceId(),
      "reason=" + normalizeBlank(command.reason()),
      true
    );
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    return toInstanceView(instance, descriptor, roles);
  }

  @Override
  public RuntimeInstanceView archiveInstance(ArchiveCommand command) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(command.instanceId())
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    ensureMonitorPrivilege(command.actor(), roles, "archive runtime instances");
    instance.archive(command.actor());
    instance.addTimelineEntry("INSTANCE_ARCHIVED:" + command.actor());
    logProcessEvent("INSTANCE_ARCHIVED", instance, null, command.actor(), null, "archiveRequested=true");
    processRuntimeStorePort.save(instance);
    appendMonitorEvent(
      "INSTANCE_ARCHIVE",
      command.actor(),
      roles,
      "INSTANCE",
      instance.instanceId(),
      "archiveRequestedBy=" + normalizeBlank(command.actor()),
      true
    );
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    return toInstanceView(instance, descriptor, roles);
  }

  @Override
  public List<MonitorEventView> listMonitorEvents(MonitorEventsQuery query) {
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    ensureMonitorPrivilege(query.actor(), roles, "read runtime monitor events");
    int maxRows = query.limit() <= 0 ? 100 : Math.min(query.limit(), 500);
    String requestedInstanceId = normalizeBlank(query.instanceId());
    String requestedActionType = normalizeUpper(query.actionType(), "");
    return processRuntimeStorePort.listMonitorEvents().stream()
      .filter((event) -> requestedInstanceId.isBlank() || Objects.equals(event.targetId(), requestedInstanceId))
      .filter((event) -> requestedActionType.isBlank() || requestedActionType.equals(normalizeUpper(event.actionType(), "")))
      .sorted(Comparator.comparing(ProcessRuntimeStorePort.RuntimeMonitorEvent::occurredAt).reversed())
      .limit(maxRows)
      .map((event) -> new MonitorEventView(
        event.eventId(),
        event.occurredAt(),
        event.actionType(),
        event.actor(),
        event.actorRoleCodes(),
        event.targetType(),
        event.targetId(),
        event.details(),
        event.forced()
      ))
      .toList();
  }

  @Override
  public RuntimeUserPreferencesView readUserPreferences(UserPreferencesQuery query) {
    String actor = normalizeActor(query.actor());
    if (actor == null) {
      throw new IllegalStateException("actor is required to read user preferences.");
    }
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    String targetUserId = normalizeActor(query.targetUserId());
    String resolvedUserId = targetUserId == null ? actor : targetUserId;
    if (!Objects.equals(actor, resolvedUserId) && !hasMonitorPrivileges(roles)) {
      throw new IllegalStateException("Only PROCESS_MONITOR or ADMINISTRATOR can read another user's preferences.");
    }

    ProcessRuntimeStorePort.RuntimeUserPreferences preferences = loadUserPreferences(resolvedUserId);
    return toUserPreferencesView(preferences);
  }

  @Override
  public RuntimeUserPreferencesView updateUserPreferences(UpdateUserPreferencesCommand command) {
    String actor = normalizeActor(command.actor());
    if (actor == null) {
      throw new IllegalStateException("actor is required to update user preferences.");
    }
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    String targetUserId = normalizeActor(command.targetUserId());
    String resolvedUserId = targetUserId == null ? actor : targetUserId;
    boolean updatingAnotherUser = !Objects.equals(actor, resolvedUserId);
    if (updatingAnotherUser && !hasMonitorPrivileges(roles)) {
      throw new IllegalStateException("Only PROCESS_MONITOR or ADMINISTRATOR can update another user's preferences.");
    }

    ProcessRuntimeStorePort.RuntimeUserPreferences previous = loadUserPreferences(resolvedUserId);
    ProcessRuntimeStorePort.RuntimeUserPreferences updated = normalizeUserPreferences(
      resolvedUserId,
      command.profileDisplayName(),
      command.profilePhotoUrl(),
      command.preferredLanguage(),
      command.preferredTheme(),
      command.notificationChannel(),
      command.notificationsEnabled(),
      command.automaticTaskPolicy(),
      command.automaticTaskDelaySeconds(),
      command.automaticTaskNotifyOnly(),
      previous
    );
    processRuntimeStorePort.saveUserPreferences(updated);

    if (updatingAnotherUser) {
      appendMonitorEvent(
        "USER_PREFERENCES_UPDATE",
        actor,
        roles,
        "USER",
        resolvedUserId,
        "updatedByMonitor=true,automaticTaskPolicy="
          + normalizeUpper(updated.automaticTaskPolicy(), "MANUAL_TRIGGER"),
        false
      );
    }

    return toUserPreferencesView(updated);
  }

  @Override
  public List<SharedDataEntityView> listSharedDataEntities(SharedDataQuery query) {
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    ensureMonitorPrivilege(query.actor(), roles, "read shared process entities");
    Map<String, GeneratedProcessRuntimeCatalog.SharedEntityDescriptor> catalog = listSharedEntityCatalogByKey();
    Set<String> keys = new HashSet<>(catalog.keySet());
    keys.addAll(processRuntimeStorePort.listSharedDataEntityKeys());

    return keys.stream()
      .sorted()
      .map((entityKey) -> toSharedDataEntityView(entityKey, catalog.get(entityKey)))
      .toList();
  }

  @Override
  public SharedDataEntityView readSharedDataEntity(ReadSharedDataQuery query) {
    List<String> roles = query.roleCodes() == null ? List.of() : query.roleCodes();
    ensureMonitorPrivilege(query.actor(), roles, "read shared process entity data");
    String entityKey = normalizeSharedEntityKey(query.entityKey());
    if (entityKey == null) {
      throw new IllegalArgumentException("entityKey is required.");
    }
    Map<String, GeneratedProcessRuntimeCatalog.SharedEntityDescriptor> catalog = listSharedEntityCatalogByKey();
    return toSharedDataEntityView(entityKey, catalog.get(entityKey));
  }

  @Override
  public SharedDataEntityView upsertSharedDataEntity(UpsertSharedDataCommand command) {
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    ensureMonitorPrivilege(command.actor(), roles, "update shared process entity data");
    String entityKey = normalizeSharedEntityKey(command.entityKey());
    if (entityKey == null) {
      throw new IllegalArgumentException("entityKey is required.");
    }
    processRuntimeStorePort.writeSharedData(entityKey, command.values() == null ? Map.of() : command.values());
    Map<String, GeneratedProcessRuntimeCatalog.SharedEntityDescriptor> catalog = listSharedEntityCatalogByKey();
    appendMonitorEvent(
      "SHARED_DATA_UPSERT",
      command.actor(),
      roles,
      "SHARED_ENTITY",
      entityKey,
      "fields=" + (command.values() == null ? 0 : command.values().size()),
      false
    );
    return toSharedDataEntityView(entityKey, catalog.get(entityKey));
  }

  @Override
  public boolean deleteSharedDataEntity(DeleteSharedDataCommand command) {
    List<String> roles = command.roleCodes() == null ? List.of() : command.roleCodes();
    ensureMonitorPrivilege(command.actor(), roles, "delete shared process entity data");
    String entityKey = normalizeSharedEntityKey(command.entityKey());
    if (entityKey == null) {
      throw new IllegalArgumentException("entityKey is required.");
    }
    processRuntimeStorePort.deleteSharedData(entityKey);
    appendMonitorEvent(
      "SHARED_DATA_DELETE",
      command.actor(),
      roles,
      "SHARED_ENTITY",
      entityKey,
      "deleted=true",
      false
    );
    return true;
  }

  @Override
  public List<String> readTimeline(String instanceId) {
    ProcessRuntimeInstance instance = processRuntimeStorePort.findById(instanceId)
      .orElseThrow(() -> new IllegalArgumentException("Unknown process instance"));
    GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
      .find(instance.modelKey(), instance.versionNumber())
      .orElse(null);
    if (descriptor != null) {
      flushDueAutomaticTasks(instance, descriptor);
    }
    return instance.timeline();
  }

  private String resolveStartActivityId(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String requestedStartActivityId,
      List<String> actorRoles) {
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    if (requestedStartActivityId != null && !requestedStartActivityId.isBlank()) {
      if (!hasActivity(descriptor, requestedStartActivityId)) {
        throw new IllegalArgumentException("Unknown requested start activity: " + requestedStartActivityId);
      }
      if (!isActivityStartableByRoles(descriptor, requestedStartActivityId, roles)) {
        throw new IllegalStateException("Requested start activity is not startable for actor roles.");
      }
      return requestedStartActivityId;
    }

    List<String> startActivities = descriptor.startActivities();
    if (startActivities != null && !startActivities.isEmpty()) {
      Optional<String> startActivity = startActivities.stream()
        .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
        .findFirst();
      if (startActivity.isPresent()) {
        return startActivity.get();
      }
    }

    return detectEntryActivities(descriptor, roles).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalArgumentException("No startable activity for actor roles"));
  }

  private void createOrAdvanceTasks(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId,
      String actor,
      Map<String, Object> payload,
      boolean createFromCurrent) {
    if (createFromCurrent) {
      processActivity(instance, descriptor, activityId, actor, payload, new HashSet<>());
      maybeCompleteInstance(instance);
      return;
    }

    List<String> nextActivityIds = nextActivityIds(descriptor, activityId);
    if (nextActivityIds.isEmpty()) {
      maybeCompleteInstance(instance);
      return;
    }

    for (String nextActivityId : nextActivityIds) {
      processActivity(instance, descriptor, nextActivityId, actor, payload, new HashSet<>());
    }

    maybeCompleteInstance(instance);
  }

  private void processActivity(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId,
      String actor,
      Map<String, Object> payload,
      Set<String> pathVisited) {
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      return;
    }

    if (pathVisited.contains(activityId)) {
      instance.addTimelineEntry("FLOW_CYCLE_DETECTED:" + activityId);
      return;
    }

    GeneratedProcessRuntimeCatalog.ActivityDescriptor descriptorActivity = findActivity(descriptor, activityId)
      .orElseThrow(() -> new IllegalArgumentException("Unknown activity in descriptor: " + activityId));
    Set<String> nextVisited = new HashSet<>(pathVisited);
    nextVisited.add(activityId);

    if ("AUTOMATIC".equals(descriptorActivity.activityType())) {
      if (hasActiveOrCompletedTaskForActivity(instance, activityId)) {
        instance.addTimelineEntry("AUTOMATIC_TASK_ALREADY_TRACKED:" + descriptorActivity.activityId());
        return;
      }
      String normalizedActor = normalizeActor(actor);
      List<String> actorRoles = resolveActorRoles(normalizedActor);
      AssignmentResolution assignmentResolution = resolveAssignment(
        instance,
        descriptorActivity,
        normalizedActor,
        actorRoles,
        false
      );
      String assignee = assignmentResolution.assignee();
      Map<String, Object> automaticInput = resolveActivityInput(descriptorActivity, instance);
      AutomaticExecutionPlan executionPlan = resolveAutomaticExecutionPlan(assignee);
      if (executionPlan.executeImmediately()) {
        Map<String, Object> automaticOutput = executeAutomaticActivity(descriptorActivity, automaticInput, instance);
        Map<String, Object> mappedAutomaticOutput = applyOutputMappings(
          automaticOutput,
          descriptorActivity.outputMappings()
        );
        instance.recordActivityOutput(descriptorActivity.activityId(), mappedAutomaticOutput);
        applyOutputStorage(instance, descriptorActivity, mappedAutomaticOutput);
        instance.addTimelineEntry(
          "AUTOMATIC_ACTIVITY_EXECUTED:"
            + descriptorActivity.activityId()
            + ":"
            + executionPlan.policy()
            + ":"
            + (assignee == null ? "SYSTEM" : assignee)
        );
        logProcessEvent(
          "AUTOMATIC_ACTIVITY_EXECUTED",
          instance,
          descriptorActivity.activityId(),
          actor,
          assignee,
          "policy=" + executionPlan.policy()
        );
      } else {
        ProcessRuntimeTask automaticTask = new ProcessRuntimeTask(
          "tsk-" + UUID.randomUUID(),
          descriptorActivity.activityId(),
          "AUTOMATIC",
          assignee,
          automaticInput,
          executionPlan.policy(),
          executionPlan.autoExecuteAt()
        );
        instance.addTask(automaticTask);
        instance.addTimelineEntry(
          "AUTOMATIC_TASK_CREATED:"
            + descriptorActivity.activityId()
            + ":"
            + (assignee == null ? "UNASSIGNED" : assignee)
            + ":"
            + executionPlan.policy()
            + ":"
            + (executionPlan.autoExecuteAt() == null ? "NO_DEADLINE" : executionPlan.autoExecuteAt())
        );
        logProcessEvent(
          "AUTOMATIC_TASK_CREATED",
          instance,
          descriptorActivity.activityId(),
          actor,
          assignee,
          "policy=" + executionPlan.policy()
        );
      }

      List<String> nextActivityIds = nextActivityIds(descriptor, activityId);
      if (!executionPlan.executeImmediately() || nextActivityIds.isEmpty()) {
        return;
      }
      for (String nextActivityId : nextActivityIds) {
        processActivity(instance, descriptor, nextActivityId, actor, payload, nextVisited);
      }
      return;
    }

    if (hasActiveOrCompletedTaskForActivity(instance, activityId)) {
      instance.addTimelineEntry("TASK_ALREADY_TRACKED:" + descriptorActivity.activityId());
      return;
    }

    String normalizedActor = normalizeActor(actor);
    List<String> actorRoles = resolveActorRoles(normalizedActor);
    AssignmentResolution assignmentResolution = resolveAssignment(
      instance,
      descriptorActivity,
      normalizedActor,
      actorRoles,
      false
    );
    String assignee = assignmentResolution.assignee();
    Map<String, Object> inputData = resolveActivityInput(descriptorActivity, instance);
    ProcessRuntimeTask task = new ProcessRuntimeTask(
      "tsk-" + UUID.randomUUID(),
      descriptorActivity.activityId(),
      "MANUAL",
      assignee,
      inputData,
      "NONE",
      null
    );
    instance.addTask(task);
    instance.addTimelineEntry(
      "TASK_CREATED:" + descriptorActivity.activityId()
      + ":" + (assignee == null ? "UNASSIGNED" : assignee)
      + ":" + assignmentResolution.reason()
    );
    logProcessEvent(
      "TASK_CREATED",
      instance,
      descriptorActivity.activityId(),
      actor,
      assignee,
      "assignmentReason=" + assignmentResolution.reason()
    );
  }

  private AssignmentResolution resolveAssignment(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      List<String> actorRoles,
      boolean forceManualAssignment) {
    if (activityDescriptor == null) {
      return new AssignmentResolution(null, List.of(), "MISSING_ACTIVITY_DESCRIPTOR");
    }

    String mode = normalizeUpper(activityDescriptor.assignmentMode(), "AUTOMATIC");
    String strategy = normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE");
    if ("MANUAL".equals(mode) && !forceManualAssignment) {
      return new AssignmentResolution(null, List.of(), "MANUAL_ASSIGNMENT_REQUIRED");
    }
    if ("MANUAL_ONLY".equals(strategy) && !forceManualAssignment) {
      return new AssignmentResolution(null, List.of(), "MANUAL_ONLY_STRATEGY");
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> eligibleCandidates = resolveEligibleCandidates(
      instance,
      activityDescriptor,
      actor,
      actorRoles
    );
    if (eligibleCandidates.isEmpty()) {
      return new AssignmentResolution(null, List.of(), "NO_MATCHING_CANDIDATE");
    }

    List<String> candidateIds = eligibleCandidates.stream()
      .map(ProcessRuntimeStorePort.RuntimeUserDescriptor::userId)
      .toList();

    if ("SINGLE_MATCH_ONLY".equals(strategy)) {
      if (eligibleCandidates.size() == 1) {
        return new AssignmentResolution(eligibleCandidates.get(0).userId(), candidateIds, "SINGLE_MATCH");
      }
      return new AssignmentResolution(null, candidateIds, "MULTI_MATCH_REQUIRES_MANUAL_ASSIGNMENT");
    }

    ProcessRuntimeStorePort.RuntimeUserDescriptor selected = selectCandidateByStrategy(
      instance,
      activityDescriptor,
      strategy,
      actor,
      eligibleCandidates
    );
    if (selected == null) {
      return new AssignmentResolution(null, candidateIds, "NO_CANDIDATE_SELECTED");
    }

    return new AssignmentResolution(selected.userId(), candidateIds, "AUTO_ASSIGNED_" + strategy);
  }

  private AssignmentResolution resolveManualAssignment(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      List<String> actorRoles,
      String requestedAssignee,
      boolean force) {
    String normalizedRequested = normalizeActor(requestedAssignee);
    if (normalizedRequested == null) {
      return new AssignmentResolution(null, List.of(), "ASSIGNEE_REQUIRED");
    }

    if (force) {
      return new AssignmentResolution(normalizedRequested, List.of(normalizedRequested), "FORCED_ASSIGNMENT");
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> eligibleCandidates = resolveEligibleCandidates(
      instance,
      activityDescriptor,
      actor,
      actorRoles
    );
    List<String> candidateIds = eligibleCandidates.stream()
      .map(ProcessRuntimeStorePort.RuntimeUserDescriptor::userId)
      .toList();
    if (candidateIds.contains(normalizedRequested)) {
      return new AssignmentResolution(normalizedRequested, candidateIds, "MANUAL_ASSIGNMENT_VALIDATED");
    }

    return new AssignmentResolution(null, candidateIds, "ASSIGNEE_NOT_ELIGIBLE");
  }

  private List<ProcessRuntimeStorePort.RuntimeUserDescriptor> resolveEligibleCandidates(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      List<String> actorRoles) {
    List<String> requiredRoles = activityDescriptor.candidateRoles() == null ? List.of() : activityDescriptor.candidateRoles();
    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = new ArrayList<>(processRuntimeStorePort.listUsers());
    String normalizedActor = normalizeActor(actor);
    if (normalizedActor != null && users.stream().noneMatch((entry) -> Objects.equals(entry.userId(), normalizedActor))) {
      users.add(
        new ProcessRuntimeStorePort.RuntimeUserDescriptor(
          normalizedActor,
          actorRoles == null ? List.of() : actorRoles,
          null,
          null
        )
      );
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> roleFiltered = users.stream()
      .filter((user) -> requiredRoles.isEmpty() || hasRoleIntersection(user.roleCodes(), requiredRoles))
      .sorted(Comparator.comparing((user) -> normalizeActor(user.userId()), Comparator.nullsLast(String::compareTo)))
      .toList();
    if (roleFiltered.isEmpty()) {
      return List.of();
    }

    Set<String> blockedAssignees = new HashSet<>();
    if (!activityDescriptor.allowPreviouslyAssignedAssignee()) {
      for (ProcessRuntimeTask task : instance.tasks()) {
        if (task.assignee() != null && !task.assignee().isBlank()) {
          blockedAssignees.add(task.assignee());
        }
      }
    }

    List<ProcessRuntimeStorePort.RuntimeUserDescriptor> previousRuleFiltered = roleFiltered.stream()
      .filter((entry) -> !blockedAssignees.contains(entry.userId()))
      .toList();
    if (previousRuleFiltered.isEmpty()) {
      return List.of();
    }

    String strategy = normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE");
    if ("SUPERVISOR_ONLY".equals(strategy) || "SUPERVISOR_THEN_ANCESTORS".equals(strategy)) {
      List<String> supervisorChain = resolveSupervisorChain(normalizedActor, previousRuleFiltered);
      if (supervisorChain.isEmpty()) {
        return previousRuleFiltered;
      }
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> supervisorCandidates = previousRuleFiltered.stream()
        .filter((entry) -> supervisorChain.contains(entry.userId()))
        .sorted(Comparator.comparingInt((entry) -> supervisorChain.indexOf(entry.userId())))
        .toList();
      if ("SUPERVISOR_ONLY".equals(strategy)) {
        if (supervisorCandidates.isEmpty()) {
          return List.of();
        }
        return List.of(supervisorCandidates.get(0));
      }
      if (!supervisorCandidates.isEmpty()) {
        return supervisorCandidates;
      }
    }

    if ("UNIT_MEMBERS".equals(strategy)) {
      String actorUnitId = resolveActorUnitId(normalizedActor, previousRuleFiltered);
      if (actorUnitId == null) {
        return previousRuleFiltered;
      }
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> unitMembers = previousRuleFiltered.stream()
        .filter((entry) -> Objects.equals(actorUnitId, normalizeActor(entry.unitId())))
        .toList();
      if (!unitMembers.isEmpty()) {
        return unitMembers;
      }
    }

    return previousRuleFiltered;
  }

  private ProcessRuntimeStorePort.RuntimeUserDescriptor selectCandidateByStrategy(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String strategy,
      String actor,
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> candidates) {
    if (candidates == null || candidates.isEmpty()) {
      return null;
    }

    if ("ROUND_ROBIN".equals(strategy)) {
      int currentIndex = readRoundRobinIndex(instance, activityDescriptor.activityId());
      int selectedIndex = Math.floorMod(currentIndex, candidates.size());
      writeRoundRobinIndex(instance, activityDescriptor.activityId(), currentIndex + 1);
      return candidates.get(selectedIndex);
    }

    if ("SUPERVISOR_ONLY".equals(strategy) || "SUPERVISOR_THEN_ANCESTORS".equals(strategy)) {
      return candidates.get(0);
    }

    if ("UNIT_MEMBERS".equals(strategy)) {
      String normalizedActor = normalizeActor(actor);
      ProcessRuntimeStorePort.RuntimeUserDescriptor actorCandidate = candidates.stream()
        .filter((entry) -> Objects.equals(normalizedActor, entry.userId()))
        .findFirst()
        .orElse(null);
      if (actorCandidate != null) {
        return actorCandidate;
      }
      return candidates.get(0);
    }

    if ("ROLE_QUEUE".equals(strategy)) {
      return candidates.get(0);
    }

    return candidates.get(0);
  }

  private List<String> resolveSupervisorChain(
      String actor,
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users) {
    if (actor == null || actor.isBlank() || users == null || users.isEmpty()) {
      return List.of();
    }

    Map<String, ProcessRuntimeStorePort.RuntimeUserDescriptor> byUserId = users.stream()
      .collect(Collectors.toMap(
        (entry) -> normalizeActor(entry.userId()),
        (entry) -> entry,
        (left, right) -> left
      ));
    ProcessRuntimeStorePort.RuntimeUserDescriptor actorDescriptor = byUserId.get(actor);
    if (actorDescriptor == null) {
      return List.of();
    }

    List<String> chain = new ArrayList<>();
    Set<String> visited = new HashSet<>();
    String supervisorId = normalizeActor(actorDescriptor.supervisorId());
    while (supervisorId != null && !visited.contains(supervisorId)) {
      visited.add(supervisorId);
      chain.add(supervisorId);
      ProcessRuntimeStorePort.RuntimeUserDescriptor supervisor = byUserId.get(supervisorId);
      if (supervisor == null) {
        break;
      }
      supervisorId = normalizeActor(supervisor.supervisorId());
    }

    if (!chain.isEmpty()) {
      return chain;
    }

    String actorUnitId = normalizeActor(actorDescriptor.unitId());
    if (actorUnitId == null) {
      return List.of();
    }
    ProcessRuntimeStorePort.RuntimeOrganizationSnapshot snapshot = processRuntimeStorePort.readOrganizationSnapshot();
    if (snapshot == null || snapshot.units() == null) {
      return List.of();
    }
    Map<String, ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor> byUnitId = snapshot.units().stream()
      .collect(Collectors.toMap(
        (entry) -> normalizeActor(entry.unitId()),
        (entry) -> entry,
        (left, right) -> left
      ));
    Set<String> visitedUnits = new HashSet<>();
    String cursorUnitId = actorUnitId;
    while (cursorUnitId != null && !visitedUnits.contains(cursorUnitId)) {
      visitedUnits.add(cursorUnitId);
      ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor unit = byUnitId.get(cursorUnitId);
      if (unit == null) {
        break;
      }
      String managerUserId = normalizeActor(unit.managerUserId());
      if (managerUserId != null) {
        chain.add(managerUserId);
      }
      cursorUnitId = normalizeActor(unit.parentUnitId());
    }

    return chain;
  }

  private String resolveActorUnitId(
      String actor,
      List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users) {
    if (actor == null || actor.isBlank() || users == null) {
      return null;
    }
    return users.stream()
      .filter((entry) -> Objects.equals(actor, normalizeActor(entry.userId())))
      .map((entry) -> normalizeActor(entry.unitId()))
      .filter(Objects::nonNull)
      .findFirst()
      .orElse(null);
  }

  private int readRoundRobinIndex(ProcessRuntimeInstance instance, String activityId) {
    Object value = instance.contextData().get("__assignment_rr__" + activityId);
    if (value instanceof Number) {
      return ((Number) value).intValue();
    }
    if (value != null) {
      try {
        return Integer.parseInt(String.valueOf(value));
      } catch (NumberFormatException ignored) {
        return 0;
      }
    }
    return 0;
  }

  private void writeRoundRobinIndex(ProcessRuntimeInstance instance, String activityId, int nextIndex) {
    Map<String, Object> update = new HashMap<>();
    update.put("__assignment_rr__" + activityId, Integer.valueOf(nextIndex));
    instance.putContextData(update);
  }

  private Map<String, GeneratedProcessRuntimeCatalog.SharedEntityDescriptor> listSharedEntityCatalogByKey() {
    Map<String, GeneratedProcessRuntimeCatalog.SharedEntityDescriptor> byKey = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor : GeneratedProcessRuntimeCatalog.deployedProcesses()) {
      if (descriptor == null || descriptor.sharedEntities() == null) {
        continue;
      }
      for (GeneratedProcessRuntimeCatalog.SharedEntityDescriptor sharedEntity : descriptor.sharedEntities()) {
        String entityKey = normalizeSharedEntityKey(sharedEntity == null ? null : sharedEntity.entityKey());
        if (entityKey == null || byKey.containsKey(entityKey)) {
          continue;
        }
        byKey.put(entityKey, sharedEntity);
      }
    }
    return byKey;
  }

  private String normalizeSharedEntityKey(String value) {
    String normalized = normalizeBlank(value).toLowerCase();
    if (normalized.isBlank()) {
      return null;
    }
    normalized = normalized
      .replaceAll("[^a-z0-9._-]+", "-")
      .replaceAll("^-+|-+$", "")
      .replaceAll("-{2,}", "-");
    return normalized.isBlank() ? null : normalized;
  }

  private SharedDataEntityView toSharedDataEntityView(
      String entityKey,
      GeneratedProcessRuntimeCatalog.SharedEntityDescriptor descriptor) {
    String normalizedKey = normalizeSharedEntityKey(entityKey);
    if (normalizedKey == null) {
      throw new IllegalArgumentException("entityKey is required.");
    }
    Map<String, Object> values = processRuntimeStorePort.readSharedData(normalizedKey);
    List<SharedDataFieldView> fields = descriptor == null || descriptor.fields() == null
      ? List.of()
      : descriptor.fields().stream()
        .map((field) -> new SharedDataFieldView(
          field.name(),
          normalizeUpper(field.type(), "STRING"),
          field.required(),
          field.indexed(),
          field.unique()
        ))
        .toList();
    String displayName = descriptor == null ? normalizedKey : normalizeBlank(descriptor.displayName());
    if (displayName.isBlank()) {
      displayName = normalizedKey;
    }
    String tableName = descriptor == null ? "" : normalizeBlank(descriptor.tableName());
    boolean modeled = descriptor != null && descriptor.modeled();
    return new SharedDataEntityView(
      normalizedKey,
      displayName,
      tableName,
      modeled,
      fields,
      values == null ? Map.of() : Map.copyOf(values)
    );
  }

  private String normalizeActor(String value) {
    String normalized = value == null ? "" : value.trim();
    return normalized.isBlank() ? null : normalized;
  }

  private String normalizeUpper(String value, String fallback) {
    String normalized = value == null ? "" : value.trim().toUpperCase();
    return normalized.isBlank() ? fallback : normalized;
  }

  private String normalizeBlank(String value) {
    String normalized = value == null ? "" : value.trim();
    return normalized;
  }

  private boolean hasMonitorPrivileges(List<String> actorRoles) {
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    return roles.stream().anyMatch((role) ->
      "PROCESS_MONITOR".equals(role) || "ADMINISTRATOR".equals(role)
    );
  }

  private void ensureMonitorPrivilege(String actor, List<String> actorRoles, String actionLabel) {
    if (!hasMonitorPrivileges(actorRoles)) {
      throw new IllegalStateException("Actor is not allowed to " + actionLabel + ".");
    }
    if (normalizeActor(actor) == null) {
      throw new IllegalStateException("actor is required to " + actionLabel + ".");
    }
  }

  private void appendMonitorEvent(
      String actionType,
      String actor,
      List<String> actorRoles,
      String targetType,
      String targetId,
      String details,
      boolean forced) {
    ProcessRuntimeStorePort.RuntimeMonitorEvent event =
      new ProcessRuntimeStorePort.RuntimeMonitorEvent(
        "evt-" + UUID.randomUUID(),
        Instant.now(),
        normalizeUpper(actionType, "UNKNOWN"),
        normalizeBlank(actor),
        actorRoles == null ? List.of() : List.copyOf(actorRoles),
        normalizeUpper(targetType, "UNKNOWN"),
        normalizeBlank(targetId),
        normalizeBlank(details),
        forced
      );
    processRuntimeStorePort.appendMonitorEvent(
      event
    );
    PROCESS_EVENT_LOGGER.info(
      "MONITOR_EVENT eventId={} actionType={} actorHash={} targetType={} targetIdHash={} forced={} details={}",
      event.eventId(),
      event.actionType(),
      anonymizeIdentity(event.actor()),
      event.targetType(),
      anonymizeIdentity(event.targetId()),
      Boolean.valueOf(event.forced()),
      sanitizeLogText(event.details())
    );
  }

  private void logProcessEvent(
      String eventType,
      ProcessRuntimeInstance instance,
      String activityId,
      String actor,
      String assignee,
      String details) {
    if (instance == null) {
      return;
    }
    PROCESS_EVENT_LOGGER.info(
      "PROCESS_EVENT eventType={} modelKey={} version={} instanceIdHash={} activityId={} actorHash={} assigneeHash={} state={} details={}",
      sanitizeLogText(eventType),
      sanitizeLogText(instance.modelKey()),
      Integer.valueOf(instance.versionNumber()),
      anonymizeIdentity(instance.instanceId()),
      sanitizeLogText(activityId),
      anonymizeIdentity(actor),
      anonymizeIdentity(assignee),
      sanitizeLogText(String.valueOf(instance.state())),
      sanitizeLogText(details)
    );
  }

  private String anonymizeIdentity(String value) {
    String normalized = normalizeBlank(value);
    if (normalized.isBlank()) {
      return "anonymous";
    }

    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder();
      int maxBytes = Math.min(hash.length, 8);
      for (int index = 0; index < maxBytes; index += 1) {
        builder.append(String.format("%02x", Integer.valueOf(hash[index] & 0xff)));
      }
      return builder.toString();
    } catch (NoSuchAlgorithmException exception) {
      return "hash_error";
    }
  }

  private String sanitizeLogText(String value) {
    String normalized = normalizeBlank(value)
      .replace("\\r", " ")
      .replace("\\n", " ");
    if (normalized.length() <= 240) {
      return normalized;
    }
    return normalized.substring(0, 240);
  }

  private ProcessRuntimeStorePort.RuntimeUserPreferences loadUserPreferences(String userId) {
    String normalizedUserId = normalizeActor(userId);
    if (normalizedUserId == null) {
      normalizedUserId = "anonymous";
    }
    ProcessRuntimeStorePort.RuntimeUserPreferences loaded = processRuntimeStorePort.readUserPreferences(normalizedUserId);
    if (loaded != null) {
      return normalizeUserPreferences(
        normalizedUserId,
        loaded.profileDisplayName(),
        loaded.profilePhotoUrl(),
        loaded.preferredLanguage(),
        loaded.preferredTheme(),
        loaded.notificationChannel(),
        loaded.notificationsEnabled(),
        loaded.automaticTaskPolicy(),
        loaded.automaticTaskDelaySeconds(),
        loaded.automaticTaskNotifyOnly(),
        null
      );
    }

    return normalizeUserPreferences(
      normalizedUserId,
      normalizedUserId,
      "",
      "en",
      "system",
      "IN_APP_EMAIL",
      true,
      "MANUAL_TRIGGER",
      0,
      true,
      null
    );
  }

  private ProcessRuntimeStorePort.RuntimeUserPreferences normalizeUserPreferences(
      String userId,
      String profileDisplayName,
      String profilePhotoUrl,
      String preferredLanguage,
      String preferredTheme,
      String notificationChannel,
      boolean notificationsEnabled,
      String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly,
      ProcessRuntimeStorePort.RuntimeUserPreferences fallback) {
    String normalizedUserId = normalizeActor(userId);
    if (normalizedUserId == null) {
      normalizedUserId = fallback == null ? "anonymous" : normalizeActor(fallback.userId());
    }
    String normalizedDisplayName = normalizeBlank(profileDisplayName);
    if (normalizedDisplayName.isBlank()) {
      normalizedDisplayName = fallback == null
        ? normalizedUserId
        : normalizeBlank(fallback.profileDisplayName());
    }
    if (normalizedDisplayName.isBlank()) {
      normalizedDisplayName = normalizedUserId;
    }

    String normalizedPhotoUrl = normalizeBlank(profilePhotoUrl);
    if (normalizedPhotoUrl.isBlank() && fallback != null) {
      normalizedPhotoUrl = normalizeBlank(fallback.profilePhotoUrl());
    }

    String normalizedLanguage = normalizeBlank(preferredLanguage).toLowerCase();
    if (normalizedLanguage.isBlank()) {
      normalizedLanguage = fallback == null ? "en" : normalizeBlank(fallback.preferredLanguage()).toLowerCase();
    }
    if (normalizedLanguage.isBlank()) {
      normalizedLanguage = "en";
    }

    String normalizedTheme = normalizeUpper(preferredTheme, "");
    if (normalizedTheme.isBlank()) {
      normalizedTheme = fallback == null ? "SYSTEM" : normalizeUpper(fallback.preferredTheme(), "SYSTEM");
    }
    if (!Set.of("SYSTEM", "LIGHT", "DARK").contains(normalizedTheme)) {
      normalizedTheme = "SYSTEM";
    }

    String normalizedChannel = normalizeUpper(notificationChannel, "");
    if (normalizedChannel.isBlank()) {
      normalizedChannel = fallback == null ? "IN_APP_EMAIL" : normalizeUpper(fallback.notificationChannel(), "IN_APP_EMAIL");
    }
    if (!Set.of("IN_APP", "EMAIL", "IN_APP_EMAIL", "DISABLED").contains(normalizedChannel)) {
      normalizedChannel = "IN_APP_EMAIL";
    }

    String normalizedPolicy = normalizeUpper(automaticTaskPolicy, "");
    if (normalizedPolicy.isBlank()) {
      normalizedPolicy = fallback == null ? "MANUAL_TRIGGER" : normalizeUpper(fallback.automaticTaskPolicy(), "MANUAL_TRIGGER");
    }
    if (!Set.of("MANUAL_TRIGGER", "AUTO_IMMEDIATE", "AUTO_AFTER_DELAY").contains(normalizedPolicy)) {
      normalizedPolicy = "MANUAL_TRIGGER";
    }

    int normalizedDelay = automaticTaskDelaySeconds;
    if (normalizedDelay < 0 && fallback != null) {
      normalizedDelay = fallback.automaticTaskDelaySeconds();
    }
    if (normalizedDelay < 0) {
      normalizedDelay = 0;
    }
    if (normalizedDelay > 86400) {
      normalizedDelay = 86400;
    }

    boolean normalizedNotificationsEnabled = notificationsEnabled;
    if ("DISABLED".equals(normalizedChannel)) {
      normalizedNotificationsEnabled = false;
    }

    return new ProcessRuntimeStorePort.RuntimeUserPreferences(
      normalizedUserId,
      normalizedDisplayName,
      normalizedPhotoUrl,
      normalizedLanguage,
      normalizedTheme,
      normalizedChannel,
      normalizedNotificationsEnabled,
      normalizedPolicy,
      normalizedDelay,
      automaticTaskNotifyOnly
    );
  }

  private RuntimeUserPreferencesView toUserPreferencesView(ProcessRuntimeStorePort.RuntimeUserPreferences preferences) {
    return new RuntimeUserPreferencesView(
      preferences.userId(),
      preferences.profileDisplayName(),
      preferences.profilePhotoUrl(),
      preferences.preferredLanguage(),
      preferences.preferredTheme(),
      preferences.notificationChannel(),
      preferences.notificationsEnabled(),
      preferences.automaticTaskPolicy(),
      preferences.automaticTaskDelaySeconds(),
      preferences.automaticTaskNotifyOnly()
    );
  }

  private AutomaticExecutionPlan resolveAutomaticExecutionPlan(String assignee) {
    if (assignee == null || assignee.isBlank()) {
      return new AutomaticExecutionPlan("AUTO_IMMEDIATE", null, true);
    }
    ProcessRuntimeStorePort.RuntimeUserPreferences preferences = loadUserPreferences(assignee);
    String policy = normalizeUpper(preferences.automaticTaskPolicy(), "MANUAL_TRIGGER");
    if ("AUTO_IMMEDIATE".equals(policy)) {
      return new AutomaticExecutionPlan(policy, null, true);
    }
    if ("AUTO_AFTER_DELAY".equals(policy)) {
      int delaySeconds = Math.max(0, preferences.automaticTaskDelaySeconds());
      if (delaySeconds <= 0) {
        return new AutomaticExecutionPlan("AUTO_IMMEDIATE", null, true);
      }
      return new AutomaticExecutionPlan(policy, Instant.now().plusSeconds(delaySeconds), false);
    }
    return new AutomaticExecutionPlan("MANUAL_TRIGGER", null, false);
  }

  private void flushAutomaticTasksForInstances(List<ProcessRuntimeInstance> instances) {
    if (instances == null || instances.isEmpty()) {
      return;
    }
    for (ProcessRuntimeInstance instance : instances) {
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor = GeneratedProcessRuntimeCatalog
        .find(instance.modelKey(), instance.versionNumber())
        .orElse(null);
      if (descriptor == null) {
        continue;
      }
      flushDueAutomaticTasks(instance, descriptor);
    }
  }

  private void flushDueAutomaticTasks(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor) {
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      return;
    }

    boolean changed = false;
    boolean progressed = true;
    while (progressed && instance.state() == ProcessRuntimeState.RUNNING) {
      progressed = false;
      for (ProcessRuntimeTask task : instance.tasks()) {
        if (task.state() != ProcessRuntimeTaskState.PENDING) {
          continue;
        }
        if (!"AUTOMATIC".equals(normalizeUpper(task.activityType(), "MANUAL"))) {
          continue;
        }
        if (!"AUTO_AFTER_DELAY".equals(normalizeUpper(task.automaticTaskPolicy(), "NONE"))) {
          continue;
        }
        Instant deadline = task.autoExecuteAt();
        if (deadline == null || deadline.isAfter(Instant.now())) {
          continue;
        }

        GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = findActivity(descriptor, task.activityId())
          .orElse(null);
        if (activityDescriptor == null) {
          continue;
        }

        completeAutomaticTask(
          instance,
          descriptor,
          task,
          activityDescriptor,
          "SYSTEM_DELAY",
          "AUTO_AFTER_DELAY"
        );
        changed = true;
        progressed = true;
        break;
      }
    }

    if (changed) {
      maybeCompleteInstance(instance);
      processRuntimeStorePort.save(instance);
    }
  }

  private void completeAutomaticTask(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      ProcessRuntimeTask task,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      String actor,
      String completionMode) {
    Map<String, Object> automaticOutput = executeAutomaticActivity(activityDescriptor, task.inputData(), instance);
    Map<String, Object> mappedOutput = applyOutputMappings(automaticOutput, activityDescriptor.outputMappings());
    task.complete(mappedOutput);
    instance.recordActivityOutput(task.activityId(), mappedOutput);
    applyOutputStorage(instance, activityDescriptor, mappedOutput);
    instance.addTimelineEntry(
      "AUTOMATIC_TASK_COMPLETED:"
        + task.activityId()
        + ":"
        + normalizeUpper(completionMode, "MANUAL_TRIGGER")
        + ":"
        + normalizeBlank(actor)
    );
    logProcessEvent(
      "AUTOMATIC_TASK_COMPLETED",
      instance,
      task.activityId(),
      actor,
      task.assignee(),
      "completionMode=" + normalizeUpper(completionMode, "MANUAL_TRIGGER")
    );
    createOrAdvanceTasks(instance, descriptor, task.activityId(), actor, mappedOutput, false);
  }

  private boolean hasRoleIntersection(List<String> sourceRoles, List<String> requiredRoles) {
    if (requiredRoles == null || requiredRoles.isEmpty()) {
      return true;
    }
    List<String> source = sourceRoles == null ? List.of() : sourceRoles;
    return requiredRoles.stream().anyMatch(source::contains);
  }

  private List<String> resolveActorRoles(String actor) {
    if (actor == null || actor.isBlank()) {
      return List.of();
    }
    return processRuntimeStorePort.listUsers().stream()
      .filter((entry) -> Objects.equals(actor, normalizeActor(entry.userId())))
      .map(ProcessRuntimeStorePort.RuntimeUserDescriptor::roleCodes)
      .filter(Objects::nonNull)
      .findFirst()
      .orElse(List.of());
  }

  private void maybeCompleteInstance(ProcessRuntimeInstance instance) {
    if (instance.state() != ProcessRuntimeState.RUNNING) {
      return;
    }
    boolean hasPendingTasks = instance.tasks().stream()
      .anyMatch((task) -> task.state() == ProcessRuntimeTaskState.PENDING);
    if (!hasPendingTasks) {
      instance.markCompleted();
      instance.addTimelineEntry("INSTANCE_COMPLETED");
      logProcessEvent("INSTANCE_COMPLETED", instance, null, "SYSTEM", null, "state=COMPLETED");
    }
  }

  private Optional<GeneratedProcessRuntimeCatalog.ActivityDescriptor> findActivity(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId) {
    return descriptor.activities().stream()
      .filter((activity) -> Objects.equals(activity.activityId(), activityId))
      .findFirst();
  }

  private boolean hasActivity(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId) {
    return findActivity(descriptor, activityId).isPresent();
  }

  private boolean isActivityStartableByRoles(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId,
      List<String> roles) {
    Optional<GeneratedProcessRuntimeCatalog.ActivityDescriptor> activity = findActivity(descriptor, activityId);
    if (activity.isEmpty()) {
      return false;
    }
    if (!"MANUAL".equals(activity.get().activityType())) {
      return true;
    }
    List<String> candidateRoles = activity.get().candidateRoles();
    return candidateRoles == null
      || candidateRoles.isEmpty()
      || candidateRoles.stream().anyMatch(roles::contains);
  }

  private List<String> detectEntryActivities(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      List<String> roles) {
    Map<String, Integer> incomingCountByActivity = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.ActivityDescriptor activity : descriptor.activities()) {
      incomingCountByActivity.put(activity.activityId(), 0);
    }
    for (GeneratedProcessRuntimeCatalog.TransitionDescriptor transition : descriptor.transitions()) {
      incomingCountByActivity.computeIfPresent(
        transition.targetActivityId(),
        (key, value) -> Integer.valueOf(value.intValue() + 1)
      );
    }

    List<String> entryActivities = descriptor.activities().stream()
      .map(GeneratedProcessRuntimeCatalog.ActivityDescriptor::activityId)
      .filter((activityId) -> incomingCountByActivity.getOrDefault(activityId, 0) == 0)
      .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
      .toList();
    if (!entryActivities.isEmpty()) {
      return entryActivities;
    }

    return descriptor.activities().stream()
      .map(GeneratedProcessRuntimeCatalog.ActivityDescriptor::activityId)
      .filter((activityId) -> isActivityStartableByRoles(descriptor, activityId, roles))
      .toList();
  }

  private List<String> nextActivityIds(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String activityId) {
    List<String> fromTransitions = descriptor.transitions().stream()
      .filter((transition) -> Objects.equals(transition.sourceActivityId(), activityId))
      .map(GeneratedProcessRuntimeCatalog.TransitionDescriptor::targetActivityId)
      .distinct()
      .toList();
    if (!fromTransitions.isEmpty()) {
      return fromTransitions;
    }

    List<GeneratedProcessRuntimeCatalog.ActivityDescriptor> activities = descriptor.activities();
    List<String> orderedActivityIds = activities.stream()
      .map(GeneratedProcessRuntimeCatalog.ActivityDescriptor::activityId)
      .toList();
    int currentIndex = orderedActivityIds.indexOf(activityId);
    if (currentIndex < 0) {
      return List.of();
    }
    int nextIndex = currentIndex + 1;
    if (nextIndex >= orderedActivityIds.size()) {
      return List.of();
    }
    return List.of(orderedActivityIds.get(nextIndex));
  }

  private boolean hasActiveOrCompletedTaskForActivity(
      ProcessRuntimeInstance instance,
      String activityId) {
    return instance.tasks().stream()
      .anyMatch((task) -> Objects.equals(task.activityId(), activityId) && task.state() != ProcessRuntimeTaskState.CANCELLED);
  }

  private Map<String, Object> resolveActivityInput(
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      ProcessRuntimeInstance instance) {
    Map<String, Object> input = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.InputSourceDescriptor source : activityDescriptor.inputSources()) {
      Map<String, Object> sourceData = resolveInputSourceData(source, instance);
      if (source.mappings() == null || source.mappings().isEmpty()) {
        String fallbackKey = source.sourceRef() == null || source.sourceRef().isBlank()
          ? String.valueOf(source.sourceType()).toLowerCase()
          : source.sourceRef();
        input.put(fallbackKey, sourceData);
        continue;
      }

      for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : source.mappings()) {
        Object value = readPathValue(sourceData, mapping.from());
        if (value != null) {
          writePathValue(input, mapping.to(), value);
        }
      }
    }

    return input;
  }

  private Map<String, Object> resolveInputSourceData(
      GeneratedProcessRuntimeCatalog.InputSourceDescriptor source,
      ProcessRuntimeInstance instance) {
    String sourceType = source.sourceType() == null ? "PROCESS_CONTEXT" : source.sourceType().toUpperCase();
    if ("PROCESS_CONTEXT".equals(sourceType)) {
      return instance.contextData();
    }
    if ("PREVIOUS_ACTIVITY".equals(sourceType)) {
      return instance.readActivityOutput(source.sourceRef());
    }
    if ("SHARED_DATA".equals(sourceType)) {
      String sharedEntityKey = normalizeSharedEntityKey(inferSharedEntityKey(source.sourceRef()));
      if (sharedEntityKey == null) {
        return Map.of();
      }
      return processRuntimeStorePort.readSharedData(sharedEntityKey);
    }
    if ("BACKEND_SERVICE".equals(sourceType) || "EXTERNAL_SERVICE".equals(sourceType)) {
      return loadServiceSourceData(sourceType, source.sourceRef(), instance);
    }

    return Map.of();
  }

  private Map<String, Object> loadServiceSourceData(String sourceType, String sourceRef, ProcessRuntimeInstance instance) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("status", "NOT_IMPLEMENTED");
    payload.put("sourceType", sourceType);
    payload.put("sourceRef", sourceRef == null ? "" : sourceRef);
    payload.put("instanceId", instance.instanceId());
    return payload;
  }

  private Map<String, Object> executeAutomaticActivity(
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      Map<String, Object> inputData,
      ProcessRuntimeInstance instance) {
    Map<String, Object> safeInput = inputData == null ? Map.of() : inputData;
    Map<String, Object> configuration = activityDescriptor.automaticConfiguration() == null
      ? Map.of()
      : activityDescriptor.automaticConfiguration();
    String taskTypeKey = normalizeTaskTypeKey(
      activityDescriptor.automaticTaskTypeKey(),
      activityDescriptor.automaticHandlerRef()
    );

    Map<String, Object> builtinOutput = executeBuiltinAutomaticTask(
      taskTypeKey,
      safeInput,
      configuration,
      instance,
      activityDescriptor
    );
    if (builtinOutput != null) {
      return builtinOutput;
    }

    Map<String, Object> customOutput = executeCustomAutomaticTask(
      taskTypeKey,
      safeInput,
      configuration,
      instance,
      activityDescriptor
    );
    if (customOutput != null) {
      return customOutput;
    }

    Map<String, Object> output = new HashMap<>();
    output.put("status", "AUTOMATIC_EXECUTED_STUB");
    output.put("activityId", activityDescriptor.activityId());
    output.put("handlerRef", activityDescriptor.automaticHandlerRef());
    output.put("taskTypeKey", taskTypeKey);
    output.put("instanceId", instance.instanceId());
    if (!safeInput.isEmpty()) {
      output.put("inputEcho", safeInput);
    }
    if (!configuration.isEmpty()) {
      output.put("configurationEcho", configuration);
    }
    return output;
  }

  private String normalizeTaskTypeKey(String taskTypeKey, String handlerRef) {
    String normalized = taskTypeKey == null ? "" : taskTypeKey.trim().toLowerCase();
    if (!normalized.isBlank()) {
      return normalized;
    }

    String fallback = handlerRef == null ? "" : handlerRef.trim().toLowerCase();
    if (fallback.startsWith("handlers.")) {
      fallback = fallback.substring("handlers.".length());
    }
    if (fallback.isBlank()) {
      return "core.echo";
    }
    return "custom." + fallback.replaceAll("[^a-z0-9._-]+", "-");
  }

  private Map<String, Object> executeBuiltinAutomaticTask(
      String taskTypeKey,
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    switch (taskTypeKey) {
      case "core.echo":
        return executeCoreEchoTask(inputData, configuration, instance, activityDescriptor);
      case "core.email.send":
      case "core.email.broadcast":
        return executeCoreEmailTask(taskTypeKey, inputData, configuration, instance, activityDescriptor);
      case "core.document.generate":
        return executeCoreDocumentGenerationTask(inputData, configuration, instance, activityDescriptor);
      case "core.data.delete":
        return executeCoreDeleteDataTask(inputData, configuration, instance, activityDescriptor);
      case "core.data.transform":
      case "core.json.merge":
        return executeCoreDataTransformTask(taskTypeKey, inputData, configuration, instance, activityDescriptor);
      case "core.http.request":
      case "core.webhook.emit":
        return executeCoreHttpOrWebhookTask(taskTypeKey, inputData, configuration, instance, activityDescriptor);
      case "core.wait.delay":
        return executeCoreDelayTask(inputData, configuration, instance, activityDescriptor);
      case "core.notification.emit":
        return executeCoreNotificationTask(inputData, configuration, instance, activityDescriptor);
      case "core.audit.log":
        return executeCoreAuditTask(inputData, configuration, instance, activityDescriptor);
      default:
        return null;
    }
  }

  private Map<String, Object> executeCustomAutomaticTask(
      String taskTypeKey,
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    switch (taskTypeKey) {
${customTaskDispatchCases}
    }
  }

  private Map<String, Object> executeCoreEchoTask(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    Map<String, Object> output = new HashMap<>();
    output.put("status", asString(configuration.get("status"), "ECHO_OK"));
    output.put("activityId", activityDescriptor.activityId());
    output.put("instanceId", instance.instanceId());
    if (asBoolean(configuration.get("includeInput"), true)) {
      output.put("payload", inputData);
    }
    return output;
  }

  private Map<String, Object> executeCoreEmailTask(
      String taskTypeKey,
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    List<String> recipients = readStringList(configuration.get("to"));
    String recipientsFromPath = asString(configuration.get("toFromInputPath"), "");
    if (!recipientsFromPath.isBlank()) {
      recipients.addAll(readStringList(readPathValue(inputData, recipientsFromPath)));
    }
    String recipientListPath = asString(configuration.get("recipientListFromInputPath"), "");
    if (!recipientListPath.isBlank()) {
      recipients.addAll(readStringList(readPathValue(inputData, recipientListPath)));
    }
    recipients = recipients.stream()
      .map((entry) -> entry == null ? "" : entry.trim())
      .filter((entry) -> !entry.isBlank())
      .distinct()
      .toList();
    String subject = asString(configuration.get("subject"), "");
    String subjectFromPath = asString(configuration.get("subjectFromInputPath"), "");
    if (!subjectFromPath.isBlank()) {
      subject = asString(readPathValue(inputData, subjectFromPath), subject);
    }
    String template = asString(configuration.get("template"), "");
    String dataFromPath = asString(configuration.get("dataFromInputPath"), "");
    Object templateData = dataFromPath.isBlank() ? inputData : readPathValue(inputData, dataFromPath);
    String body = renderTemplate(template, templateData);

    Map<String, Object> output = new HashMap<>();
    output.put("status", recipients.isEmpty() ? "NO_RECIPIENT" : "SENT_SIMULATED");
    output.put("taskTypeKey", taskTypeKey);
    output.put("activityId", activityDescriptor.activityId());
    output.put("recipientCount", recipients.size());
    output.put("recipients", recipients);
    output.put("subject", subject);
    output.put("body", body);
    output.put("smtpProfile", asString(configuration.get("smtpProfile"), "default"));
    output.put("instanceId", instance.instanceId());
    return output;
  }

  private Map<String, Object> executeCoreDocumentGenerationTask(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    String template = asString(configuration.get("template"), "");
    String fileName = asString(configuration.get("fileName"), activityDescriptor.activityId() + "-document.txt");
    String format = asString(configuration.get("format"), "TEXT").toUpperCase();
    String dataFromPath = asString(configuration.get("dataFromInputPath"), "");
    Object templateData = dataFromPath.isBlank() ? inputData : readPathValue(inputData, dataFromPath);

    Map<String, Object> document = new HashMap<>();
    document.put("fileName", fileName);
    document.put("format", format);
    if ("JSON".equals(format)) {
      document.put("content", asString(templateData, "{}"));
    } else {
      document.put("content", renderTemplate(template, templateData));
    }
    document.put("generatedAt", Instant.now().toString());
    document.put("instanceId", instance.instanceId());

    Map<String, Object> output = new HashMap<>();
    output.put("status", "DOCUMENT_GENERATED");
    output.put("activityId", activityDescriptor.activityId());
    output.put("document", document);
    return output;
  }

  private Map<String, Object> executeCoreDeleteDataTask(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    List<String> contextPaths = readStringList(configuration.get("contextPaths"));
    List<String> sharedEntityKeys = readStringList(configuration.get("sharedEntityKeys"));

    Map<String, Object> output = new HashMap<>();
    output.put("status", "DELETE_APPLIED");
    output.put("activityId", activityDescriptor.activityId());
    output.put("contextPathsRequested", contextPaths);
    output.put("sharedEntitiesRequested", sharedEntityKeys);
    output.put("contextDeletionMode", "ADVISORY");

    for (String entityKey : sharedEntityKeys) {
      if (entityKey == null || entityKey.isBlank()) {
        continue;
      }
      processRuntimeStorePort.writeSharedData(entityKey, Map.of());
    }
    output.put("sharedEntitiesCleared", sharedEntityKeys.size());
    output.put("inputEcho", inputData);
    return output;
  }

  private Map<String, Object> executeCoreDataTransformTask(
      String taskTypeKey,
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    String mode = asString(configuration.get("mode"), "MERGE").toUpperCase();
    String fromPath = asString(configuration.get("fromPath"), "");
    String toPath = asString(configuration.get("toPath"), "");
    List<String> sourcePaths = readStringList(configuration.get("sourcePaths"));

    Map<String, Object> output = new HashMap<>();
    output.put("status", "TRANSFORM_APPLIED");
    output.put("taskTypeKey", taskTypeKey);
    output.put("activityId", activityDescriptor.activityId());
    output.put("mode", mode);
    output.put("instanceId", instance.instanceId());

    if ("PICK".equals(mode) && !fromPath.isBlank()) {
      Object value = readPathValue(inputData, fromPath);
      writePathValue(output, toPath.isBlank() ? "result" : toPath, value);
      return output;
    }

    Map<String, Object> merged = new HashMap<>();
    if (!sourcePaths.isEmpty()) {
      for (String sourcePath : sourcePaths) {
        Object value = readPathValue(inputData, sourcePath);
        if (value instanceof Map<?, ?> typedMap) {
          for (Map.Entry<?, ?> entry : typedMap.entrySet()) {
            if (entry.getKey() != null) {
              merged.put(String.valueOf(entry.getKey()), entry.getValue());
            }
          }
        }
      }
    } else {
      merged.putAll(inputData);
    }
    writePathValue(output, toPath.isBlank() ? "result" : toPath, merged);
    return output;
  }

  private Map<String, Object> executeCoreHttpOrWebhookTask(
      String taskTypeKey,
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    String url = asString(configuration.get("url"), "");
    String method = asString(configuration.get("method"), "POST").toUpperCase();
    String payloadPath = asString(configuration.get("payloadFromInputPath"), "");
    Object payload = payloadPath.isBlank() ? inputData : readPathValue(inputData, payloadPath);

    Map<String, Object> output = new HashMap<>();
    output.put("status", "REQUEST_SIMULATED");
    output.put("taskTypeKey", taskTypeKey);
    output.put("activityId", activityDescriptor.activityId());
    output.put("url", url);
    output.put("method", method);
    output.put("payload", payload);
    output.put("response", Map.of(
      "statusCode", 202,
      "message", "Simulated by generated runtime"
    ));
    output.put("instanceId", instance.instanceId());
    return output;
  }

  private Map<String, Object> executeCoreDelayTask(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    int delaySeconds = asInteger(configuration.get("delaySeconds"), 0);
    if (delaySeconds < 0) {
      delaySeconds = 0;
    }
    Instant scheduledAt = Instant.now().plusSeconds(delaySeconds);

    Map<String, Object> output = new HashMap<>();
    output.put("status", "DELAY_REGISTERED");
    output.put("activityId", activityDescriptor.activityId());
    output.put("delaySeconds", delaySeconds);
    output.put("scheduledAt", scheduledAt.toString());
    output.put("reason", asString(configuration.get("reason"), ""));
    output.put("instanceId", instance.instanceId());
    output.put("inputEcho", inputData);
    return output;
  }

  private Map<String, Object> executeCoreNotificationTask(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    String message = asString(configuration.get("message"), "");
    String level = asString(configuration.get("level"), "INFO").toUpperCase();
    String recipientsPath = asString(configuration.get("recipientsFromInputPath"), "");
    List<String> recipients = recipientsPath.isBlank()
      ? List.of()
      : readStringList(readPathValue(inputData, recipientsPath));

    Map<String, Object> output = new HashMap<>();
    output.put("status", recipients.isEmpty() ? "NOTIFICATION_READY" : "NOTIFICATION_DISPATCHED");
    output.put("activityId", activityDescriptor.activityId());
    output.put("message", message);
    output.put("level", level);
    output.put("recipients", recipients);
    output.put("instanceId", instance.instanceId());
    return output;
  }

  private Map<String, Object> executeCoreAuditTask(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    String eventName = asString(configuration.get("eventName"), "PROCESS_AUTOMATIC_AUDIT");
    String category = asString(configuration.get("category"), "PROCESS");
    String detailsPath = asString(configuration.get("detailsFromInputPath"), "");
    Object details = detailsPath.isBlank() ? inputData : readPathValue(inputData, detailsPath);

    logProcessEvent(
      eventName,
      instance,
      activityDescriptor.activityId(),
      "SYSTEM",
      null,
      "category=" + category + ",details=" + safeAuditValue(details)
    );

    Map<String, Object> output = new HashMap<>();
    output.put("status", "AUDIT_EMITTED");
    output.put("activityId", activityDescriptor.activityId());
    output.put("eventName", eventName);
    output.put("category", category);
    output.put("details", details);
    output.put("instanceId", instance.instanceId());
    return output;
  }

  private String renderTemplate(String template, Object data) {
    String content = template == null ? "" : template;
    if (content.isBlank()) {
      return content;
    }
    if (!(data instanceof Map<?, ?> typedMap)) {
      return content;
    }
    String rendered = content;
    for (Map.Entry<?, ?> entry : typedMap.entrySet()) {
      if (entry.getKey() == null) {
        continue;
      }
      String token = "${" + String.valueOf(entry.getKey()) + "}";
      String replacement = entry.getValue() == null ? "" : String.valueOf(entry.getValue());
      rendered = rendered.replace(token, replacement);
    }
    return rendered;
  }

  private List<String> readStringList(Object value) {
    if (value instanceof List<?> typedList) {
      return typedList.stream()
        .map((entry) -> entry == null ? "" : String.valueOf(entry).trim())
        .filter((entry) -> !entry.isBlank())
        .toList();
    }
    String scalar = asString(value, "");
    if (scalar.isBlank()) {
      return List.of();
    }
    return List.of(scalar);
  }

  private boolean asBoolean(Object value, boolean fallback) {
    if (value instanceof Boolean typedBoolean) {
      return typedBoolean;
    }
    String normalized = asString(value, "").toLowerCase();
    if ("true".equals(normalized) || "1".equals(normalized) || "yes".equals(normalized) || "on".equals(normalized)) {
      return true;
    }
    if ("false".equals(normalized) || "0".equals(normalized) || "no".equals(normalized) || "off".equals(normalized)) {
      return false;
    }
    return fallback;
  }

  private int asInteger(Object value, int fallback) {
    if (value instanceof Number typedNumber) {
      return typedNumber.intValue();
    }
    try {
      return Integer.parseInt(asString(value, String.valueOf(fallback)));
    } catch (NumberFormatException ignored) {
      return fallback;
    }
  }

  private String asString(Object value, String fallback) {
    if (value == null) {
      return fallback;
    }
    String normalized = String.valueOf(value);
    return normalized.isBlank() ? fallback : normalized;
  }

  private String safeAuditValue(Object value) {
    if (value == null) {
      return "null";
    }
    String raw = String.valueOf(value);
    if (raw.length() <= 300) {
      return raw;
    }
    return raw.substring(0, 300) + "...";
  }

  private Map<String, Object> applyOutputMappings(
      Map<String, Object> payload,
      List<GeneratedProcessRuntimeCatalog.FieldMappingDescriptor> mappings) {
    if (payload == null || payload.isEmpty()) {
      return Map.of();
    }

    if (mappings == null || mappings.isEmpty()) {
      return new HashMap<>(payload);
    }

    Map<String, Object> mapped = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : mappings) {
      Object value = readPathValue(payload, mapping.from());
      if (value != null) {
        writePathValue(mapped, mapping.to(), value);
      }
    }
    return mapped;
  }

  private void applyOutputStorage(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      Map<String, Object> outputPayload) {
    String storage = activityDescriptor.outputStorage() == null
      ? "INSTANCE"
      : activityDescriptor.outputStorage().toUpperCase();

    if ("INSTANCE".equals(storage) || "BOTH".equals(storage)) {
      Map<String, Object> instanceProjection = projectOutputForInstance(outputPayload, activityDescriptor.outputMappings());
      if (!instanceProjection.isEmpty()) {
        instance.putContextData(instanceProjection);
      }
    }

    if ("SHARED".equals(storage) || "BOTH".equals(storage)) {
      Map<String, Map<String, Object>> sharedProjection = projectOutputForShared(outputPayload, activityDescriptor.outputMappings());
      for (Map.Entry<String, Map<String, Object>> entry : sharedProjection.entrySet()) {
        processRuntimeStorePort.writeSharedData(entry.getKey(), entry.getValue());
      }
    }
  }

  private Map<String, Object> projectOutputForInstance(
      Map<String, Object> outputPayload,
      List<GeneratedProcessRuntimeCatalog.FieldMappingDescriptor> mappings) {
    if (outputPayload == null || outputPayload.isEmpty()) {
      return Map.of();
    }

    if (mappings == null || mappings.isEmpty()) {
      return new HashMap<>(outputPayload);
    }

    Map<String, Object> projection = new HashMap<>();
    for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : mappings) {
      if (resolveSharedTarget(mapping.to()) != null) {
        continue;
      }
      Object value = readPathValue(outputPayload, mapping.to());
      if (value != null) {
        writePathValue(projection, mapping.to(), value);
      }
    }
    return projection;
  }

  private Map<String, Map<String, Object>> projectOutputForShared(
      Map<String, Object> outputPayload,
      List<GeneratedProcessRuntimeCatalog.FieldMappingDescriptor> mappings) {
    Map<String, Map<String, Object>> projection = new HashMap<>();
    if (outputPayload == null || outputPayload.isEmpty() || mappings == null || mappings.isEmpty()) {
      return projection;
    }

    for (GeneratedProcessRuntimeCatalog.FieldMappingDescriptor mapping : mappings) {
      Object value = readPathValue(outputPayload, mapping.to());
      if (value == null) {
        continue;
      }
      SharedTarget sharedTarget = resolveSharedTarget(mapping.to());
      if (sharedTarget == null) {
        continue;
      }

      Map<String, Object> entityValues = projection.computeIfAbsent(sharedTarget.entityKey, (ignored) -> new HashMap<>());
      writePathValue(entityValues, sharedTarget.fieldPath, value);
    }

    return projection;
  }

  private SharedTarget resolveSharedTarget(String targetPath) {
    String normalized = normalizePath(targetPath);
    String lowered = normalized.toLowerCase();
    if (lowered.startsWith("shared.")) {
      normalized = normalized.substring("shared.".length());
    } else if (lowered.startsWith("shared_data.")) {
      normalized = normalized.substring("shared_data.".length());
    } else if (lowered.startsWith("shareddata.")) {
      normalized = normalized.substring("shareddata.".length());
    } else {
      return null;
    }

    if (normalized.isBlank()) {
      return null;
    }

    int separatorIndex = normalized.indexOf('.');
    String rawEntityKey = separatorIndex < 0 ? normalized : normalized.substring(0, separatorIndex);
    String fieldPath = separatorIndex < 0 ? "value" : normalized.substring(separatorIndex + 1);

    String entityKey = normalizeSharedEntityKey(rawEntityKey);
    if (entityKey == null) {
      return null;
    }
    if (fieldPath.isBlank()) {
      fieldPath = "value";
    }

    return new SharedTarget(entityKey, fieldPath);
  }

  private String inferSharedEntityKey(String sourceRef) {
    SharedTarget target = resolveSharedTarget(sourceRef);
    if (target != null) {
      return normalizeSharedEntityKey(target.entityKey);
    }
    String normalized = normalizePath(sourceRef);
    int separatorIndex = normalized.indexOf('.');
    String candidate = separatorIndex < 0 ? normalized : normalized.substring(0, separatorIndex);
    return normalizeSharedEntityKey(candidate);
  }

  private Object readPathValue(Map<String, Object> source, String path) {
    if (source == null) {
      return null;
    }
    String normalized = normalizePath(path);
    if (normalized.isBlank()) {
      return null;
    }

    Object cursor = source;
    String[] segments = normalized.split("\\\\.");
    for (String segment : segments) {
      if (!(cursor instanceof Map)) {
        return null;
      }
      Map<?, ?> map = (Map<?, ?>) cursor;
      cursor = map.get(segment);
      if (cursor == null) {
        return null;
      }
    }

    return cursor;
  }

  @SuppressWarnings("unchecked")
  private void writePathValue(Map<String, Object> target, String path, Object value) {
    String normalized = normalizePath(path);
    if (normalized.isBlank()) {
      return;
    }

    String[] segments = normalized.split("\\\\.");
    Map<String, Object> cursor = target;
    for (int index = 0; index < segments.length - 1; index += 1) {
      String segment = segments[index];
      Object next = cursor.get(segment);
      if (!(next instanceof Map)) {
        Map<String, Object> created = new HashMap<>();
        cursor.put(segment, created);
        cursor = created;
      } else {
        cursor = (Map<String, Object>) next;
      }
    }

    cursor.put(segments[segments.length - 1], value);
  }

  private String normalizePath(String path) {
    if (path == null) {
      return "";
    }
    return path.trim().replaceAll("^\\\\.+", "").replaceAll("\\\\[(\\\\d+)\\\\]", "");
  }

  private boolean canViewTaskData(GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor, List<String> actorRoles) {
    if (activityDescriptor == null || activityDescriptor.dataViewerRoles() == null || activityDescriptor.dataViewerRoles().isEmpty()) {
      return true;
    }
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    return activityDescriptor.dataViewerRoles().stream().anyMatch(roles::contains);
  }

  private boolean canActorAssignTask(
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      List<String> actorRoles) {
    if (activityDescriptor == null) {
      return false;
    }
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    if (roles.stream().anyMatch((role) -> "PROCESS_MONITOR".equals(role) || "ADMINISTRATOR".equals(role))) {
      return true;
    }

    if ("MANUAL".equals(normalizeUpper(activityDescriptor.assignmentMode(), "AUTOMATIC"))) {
      if (activityDescriptor.manualAssignerRoles() == null || activityDescriptor.manualAssignerRoles().isEmpty()) {
        return false;
      }
      return activityDescriptor.manualAssignerRoles().stream().anyMatch(roles::contains);
    }

    if ("MANUAL_ONLY".equals(normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE"))) {
      if (activityDescriptor.manualAssignerRoles() == null || activityDescriptor.manualAssignerRoles().isEmpty()) {
        return false;
      }
      return activityDescriptor.manualAssignerRoles().stream().anyMatch(roles::contains);
    }

    return false;
  }

  private boolean canRoleConsultInstance(
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      List<String> actorRoles) {
    if (descriptor == null) {
      return false;
    }
    List<String> roles = actorRoles == null ? List.of() : actorRoles;
    if (roles.isEmpty()) {
      return false;
    }
    return descriptor.activities().stream()
      .anyMatch((activity) ->
        activity.activityViewerRoles() != null
        && activity.activityViewerRoles().stream().anyMatch(roles::contains)
      );
  }

  private boolean canActorSeeInstance(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      String actor,
      List<String> actorRoles) {
    if (actor == null || actor.isBlank()) {
      return false;
    }

    if (Objects.equals(instance.startedBy(), actor)) {
      return true;
    }
    if (instance.tasks().stream().anyMatch((task) -> Objects.equals(task.assignee(), actor))) {
      return true;
    }
    return canRoleConsultInstance(descriptor, actorRoles);
  }

  private RuntimeTaskView toTaskView(
      String instanceId,
      ProcessRuntimeTask task,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor,
      List<String> actorRoles) {
    boolean canViewData = canViewTaskData(activityDescriptor, actorRoles);
    Map<String, Object> visibleInput = canViewData ? task.inputData() : Map.of();
    Map<String, Object> visibleOutput = canViewData ? task.outputData() : Map.of();

    return new RuntimeTaskView(
      instanceId,
      task.taskId(),
      task.activityId(),
      task.activityType(),
      task.assignee(),
      task.isAssigned() ? "ASSIGNED" : "UNASSIGNED",
      activityDescriptor == null ? "AUTOMATIC" : normalizeUpper(activityDescriptor.assignmentMode(), "AUTOMATIC"),
      activityDescriptor == null ? "ROLE_QUEUE" : normalizeUpper(activityDescriptor.assignmentStrategy(), "ROLE_QUEUE"),
      activityDescriptor == null || activityDescriptor.candidateRoles() == null ? List.of() : activityDescriptor.candidateRoles(),
      activityDescriptor == null || activityDescriptor.manualAssignerRoles() == null ? List.of() : activityDescriptor.manualAssignerRoles(),
      task.automaticTaskPolicy(),
      task.autoExecuteAt(),
      task.state().name(),
      task.createdAt(),
      task.assignedAt(),
      task.completedAt(),
      visibleInput,
      visibleOutput
    );
  }

  private RuntimeInstanceView toInstanceView(
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ProcessDescriptor descriptor,
      List<String> actorRoles) {
    List<RuntimeTaskView> taskViews = instance.tasks().stream()
      .map((task) -> {
        GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor = descriptor == null
          ? null
          : findActivity(descriptor, task.activityId()).orElse(null);
        return toTaskView(instance.instanceId(), task, activityDescriptor, actorRoles);
      })
      .collect(Collectors.toCollection(ArrayList::new));

    return new RuntimeInstanceView(
      instance.instanceId(),
      instance.modelKey(),
      instance.versionNumber(),
      instance.state().name(),
      instance.startedBy(),
      instance.startedAt(),
      instance.updatedAt(),
      instance.stoppedBy(),
      instance.stopReason(),
      instance.archivedBy(),
      taskViews
    );
  }

  private record SharedTarget(String entityKey, String fieldPath) {
  }

  private record AssignmentResolution(String assignee, List<String> candidateIds, String reason) {
  }

  private record AutomaticExecutionPlan(String policy, Instant autoExecuteAt, boolean executeImmediately) {
  }
}
`;
}

function buildInMemoryProcessRuntimeStoreAdapterJava({ basePackage }) {
  return `package ${basePackage}.system.infrastructure.process.runtime;

import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;

@Component
public class InMemoryProcessRuntimeStoreAdapter implements ProcessRuntimeStorePort {
  private final Map<String, ProcessRuntimeInstance> byInstanceId = new ConcurrentHashMap<>();
  private final Map<String, Map<String, Object>> sharedDataByEntity = new ConcurrentHashMap<>();
  private final List<ProcessRuntimeStorePort.RuntimeMonitorEvent> monitorEvents = new CopyOnWriteArrayList<>();
  private final Map<String, ProcessRuntimeStorePort.RuntimeUserPreferences> userPreferencesByUserId = new ConcurrentHashMap<>();
  private final List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = List.of(
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.user", List.of("PROCESS_USER"), "unit.operations", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.supervisor", List.of("PROCESS_MONITOR", "PROCESS_USER"), "unit.operations", "runtime.admin"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.approverA", List.of("PROCESS_USER"), "unit.finance", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.approverB", List.of("PROCESS_USER"), "unit.finance", "runtime.supervisor"),
    new ProcessRuntimeStorePort.RuntimeUserDescriptor("runtime.admin", List.of("ADMINISTRATOR", "PROCESS_MONITOR"), "unit.executive", null)
  );
  private final ProcessRuntimeStorePort.RuntimeOrganizationSnapshot organizationSnapshot = new ProcessRuntimeStorePort.RuntimeOrganizationSnapshot(
    List.of(
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.executive", null, "runtime.admin", List.of("runtime.admin")),
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.operations", "unit.executive", "runtime.supervisor", List.of("runtime.user", "runtime.supervisor")),
      new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.finance", "unit.executive", "runtime.supervisor", List.of("runtime.approverA", "runtime.approverB"))
    )
  );

  public InMemoryProcessRuntimeStoreAdapter() {
    registerDefaultPreference("runtime.user", "Runtime User", "en", "SYSTEM", "IN_APP_EMAIL", true, "MANUAL_TRIGGER", 0, true);
    registerDefaultPreference("runtime.supervisor", "Runtime Supervisor", "en", "SYSTEM", "IN_APP_EMAIL", true, "AUTO_IMMEDIATE", 0, true);
    registerDefaultPreference("runtime.approverA", "Runtime Approver A", "en", "SYSTEM", "IN_APP_EMAIL", true, "AUTO_AFTER_DELAY", 30, true);
    registerDefaultPreference("runtime.approverB", "Runtime Approver B", "en", "SYSTEM", "IN_APP_EMAIL", true, "MANUAL_TRIGGER", 0, true);
    registerDefaultPreference("runtime.admin", "Runtime Administrator", "en", "SYSTEM", "IN_APP_EMAIL", true, "AUTO_IMMEDIATE", 0, true);
  }

  private void registerDefaultPreference(
      String userId,
      String displayName,
      String language,
      String theme,
      String channel,
      boolean notificationsEnabled,
      String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly) {
    userPreferencesByUserId.put(
      userId,
      new ProcessRuntimeStorePort.RuntimeUserPreferences(
        userId,
        displayName,
        "",
        language,
        theme,
        channel,
        notificationsEnabled,
        automaticTaskPolicy,
        automaticTaskDelaySeconds,
        automaticTaskNotifyOnly
      )
    );
  }

  @Override
  public List<ProcessRuntimeInstance> listInstances() {
    return new ArrayList<>(byInstanceId.values());
  }

  @Override
  public Optional<ProcessRuntimeInstance> findById(String instanceId) {
    return Optional.ofNullable(byInstanceId.get(instanceId));
  }

  @Override
  public void save(ProcessRuntimeInstance instance) {
    byInstanceId.put(instance.instanceId(), instance);
  }

  @Override
  public Map<String, Object> readSharedData(String entityKey) {
    return Map.copyOf(sharedDataByEntity.getOrDefault(entityKey, Map.of()));
  }

  @Override
  public void writeSharedData(String entityKey, Map<String, Object> values) {
    if (entityKey == null || entityKey.isBlank()) {
      return;
    }

    sharedDataByEntity.compute(
      entityKey,
      (ignored, previous) -> {
        Map<String, Object> next = new HashMap<>(previous == null ? Map.of() : previous);
        if (values != null) {
          next.putAll(values);
        }
        return next;
      }
    );
  }

  @Override
  public List<String> listSharedDataEntityKeys() {
    return sharedDataByEntity.keySet().stream().sorted().toList();
  }

  @Override
  public void deleteSharedData(String entityKey) {
    if (entityKey == null || entityKey.isBlank()) {
      return;
    }
    sharedDataByEntity.remove(entityKey);
  }

  @Override
  public List<ProcessRuntimeStorePort.RuntimeUserDescriptor> listUsers() {
    return users;
  }

  @Override
  public ProcessRuntimeStorePort.RuntimeOrganizationSnapshot readOrganizationSnapshot() {
    return organizationSnapshot;
  }

  @Override
  public void appendMonitorEvent(ProcessRuntimeStorePort.RuntimeMonitorEvent event) {
    if (event == null) {
      return;
    }
    monitorEvents.add(
      new ProcessRuntimeStorePort.RuntimeMonitorEvent(
        event.eventId(),
        event.occurredAt() == null ? Instant.now() : event.occurredAt(),
        event.actionType(),
        event.actor(),
        event.actorRoleCodes() == null ? List.of() : List.copyOf(event.actorRoleCodes()),
        event.targetType(),
        event.targetId(),
        event.details(),
        event.forced()
      )
    );
  }

  @Override
  public List<ProcessRuntimeStorePort.RuntimeMonitorEvent> listMonitorEvents() {
    return List.copyOf(monitorEvents);
  }

  @Override
  public ProcessRuntimeStorePort.RuntimeUserPreferences readUserPreferences(String userId) {
    if (userId == null || userId.isBlank()) {
      return null;
    }
    return userPreferencesByUserId.get(userId);
  }

  @Override
  public void saveUserPreferences(ProcessRuntimeStorePort.RuntimeUserPreferences preferences) {
    if (preferences == null || preferences.userId() == null || preferences.userId().isBlank()) {
      return;
    }
    userPreferencesByUserId.put(
      preferences.userId(),
      new ProcessRuntimeStorePort.RuntimeUserPreferences(
        preferences.userId(),
        preferences.profileDisplayName(),
        preferences.profilePhotoUrl(),
        preferences.preferredLanguage(),
        preferences.preferredTheme(),
        preferences.notificationChannel(),
        preferences.notificationsEnabled(),
        preferences.automaticTaskPolicy(),
        preferences.automaticTaskDelaySeconds(),
        preferences.automaticTaskNotifyOnly()
      )
    );
  }
}
`;
}

function buildProcessRuntimeModuleConfigJava({ basePackage }) {
  return `package ${basePackage}.system.infrastructure.config;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.application.process.runtime.service.ProcessRuntimeEngineService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ProcessRuntimeModuleConfig {
  @Bean
  ProcessRuntimeEngineUseCase processRuntimeEngineUseCase(ProcessRuntimeStorePort processRuntimeStorePort) {
    return new ProcessRuntimeEngineService(processRuntimeStorePort);
  }
}
`;
}

function buildGatewayProcessRuntimeControllerJava({ basePackage }) {
  return `package ${basePackage}.gateway.api;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/process-runtime")
public class ProcessRuntimeController {
  private final ProcessRuntimeEngineUseCase processRuntimeEngineUseCase;

  public ProcessRuntimeController(ProcessRuntimeEngineUseCase processRuntimeEngineUseCase) {
    this.processRuntimeEngineUseCase = processRuntimeEngineUseCase;
  }

  @Operation(summary = "List guided start options for an actor and roles")
  @GetMapping("/start-options")
  public Map<String, Object> listStartOptions(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "startOptions",
      processRuntimeEngineUseCase.listStartOptions(new ProcessRuntimeEngineUseCase.StartOptionsQuery(actor, roles))
    );
  }

  @Operation(summary = "Start a process instance")
  @PostMapping("/instances/start")
  public Map<String, Object> startInstance(@RequestBody StartInstancePayload payload) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.startInstance(
        new ProcessRuntimeEngineUseCase.StartCommand(
          payload.modelKey(),
          payload.versionNumber(),
          payload.startActivityId(),
          payload.actor(),
          payload.roleCodes(),
          payload.initialPayload()
        )
      )
    );
  }

  @Operation(summary = "List runtime instances visible to actor roles")
  @GetMapping("/instances")
  public Map<String, Object> listInstances(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "instances",
      processRuntimeEngineUseCase.listInstances(new ProcessRuntimeEngineUseCase.InstanceQuery(actor, roles))
    );
  }

  @Operation(summary = "List pending tasks for actor and roles")
  @GetMapping("/tasks")
  public Map<String, Object> listTasks(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "tasks",
      processRuntimeEngineUseCase.listTasks(new ProcessRuntimeEngineUseCase.TaskQuery(actor, roles))
    );
  }

  @Operation(summary = "Complete a runtime task")
  @PostMapping("/tasks/{taskId}/complete")
  public Map<String, Object> completeTask(
    @PathVariable("taskId") String taskId,
    @RequestBody CompleteTaskPayload payload
  ) {
    return Map.of(
      "task",
      processRuntimeEngineUseCase.completeTask(
        new ProcessRuntimeEngineUseCase.CompleteTaskCommand(
          payload.instanceId(),
          taskId,
          payload.actor(),
          payload.roleCodes(),
          payload.payload()
        )
      )
    );
  }

  @Operation(summary = "Assign or reassign a runtime task")
  @PostMapping("/tasks/{taskId}/assign")
  public Map<String, Object> assignTask(
    @PathVariable("taskId") String taskId,
    @RequestBody AssignTaskPayload payload
  ) {
    return Map.of(
      "task",
      processRuntimeEngineUseCase.assignTask(
        new ProcessRuntimeEngineUseCase.AssignTaskCommand(
          payload.instanceId(),
          taskId,
          payload.actor(),
          payload.roleCodes(),
          payload.assignee(),
          payload.force()
        )
      )
    );
  }

  @Operation(summary = "Read process runtime instance with role-aware data filtering")
  @GetMapping("/instances/{instanceId}")
  public Map<String, Object> readInstance(
    @PathVariable("instanceId") String instanceId,
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.readInstance(new ProcessRuntimeEngineUseCase.ReadInstanceQuery(instanceId, actor, roles))
    );
  }

  @Operation(summary = "Read process runtime timeline")
  @GetMapping("/instances/{instanceId}/timeline")
  public Map<String, Object> readTimeline(@PathVariable("instanceId") String instanceId) {
    return Map.of("timeline", processRuntimeEngineUseCase.readTimeline(instanceId));
  }

  @Operation(summary = "Stop runtime instance")
  @PostMapping("/instances/{instanceId}/stop")
  public Map<String, Object> stopInstance(
    @PathVariable("instanceId") String instanceId,
    @RequestBody StopInstancePayload payload
  ) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.stopInstance(
        new ProcessRuntimeEngineUseCase.StopCommand(instanceId, payload.actor(), payload.roleCodes(), payload.reason())
      )
    );
  }

  @Operation(summary = "Archive runtime instance")
  @PostMapping("/instances/{instanceId}/archive")
  public Map<String, Object> archiveInstance(
    @PathVariable("instanceId") String instanceId,
    @RequestBody ArchiveInstancePayload payload
  ) {
    return Map.of(
      "instance",
      processRuntimeEngineUseCase.archiveInstance(
        new ProcessRuntimeEngineUseCase.ArchiveCommand(instanceId, payload.actor(), payload.roleCodes())
      )
    );
  }

  @Operation(summary = "List PROCESS_MONITOR governance audit events")
  @GetMapping("/monitor/events")
  public Map<String, Object> listMonitorEvents(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles,
    @RequestParam(name = "instanceId", required = false) String instanceId,
    @RequestParam(name = "actionType", required = false) String actionType,
    @RequestParam(name = "limit", required = false, defaultValue = "100") int limit
  ) {
    return Map.of(
      "events",
      processRuntimeEngineUseCase.listMonitorEvents(
        new ProcessRuntimeEngineUseCase.MonitorEventsQuery(actor, roles, instanceId, actionType, limit)
      )
    );
  }

  @Operation(summary = "Read runtime user preferences")
  @GetMapping("/preferences")
  public Map<String, Object> readUserPreferences(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles,
    @RequestParam(name = "targetUserId", required = false) String targetUserId
  ) {
    return Map.of(
      "preferences",
      processRuntimeEngineUseCase.readUserPreferences(
        new ProcessRuntimeEngineUseCase.UserPreferencesQuery(actor, roles, targetUserId)
      )
    );
  }

  @Operation(summary = "Update runtime user preferences")
  @PostMapping("/preferences")
  public Map<String, Object> updateUserPreferences(@RequestBody UpdateUserPreferencesPayload payload) {
    return Map.of(
      "preferences",
      processRuntimeEngineUseCase.updateUserPreferences(
        new ProcessRuntimeEngineUseCase.UpdateUserPreferencesCommand(
          payload.actor(),
          payload.roleCodes(),
          payload.targetUserId(),
          payload.profileDisplayName(),
          payload.profilePhotoUrl(),
          payload.preferredLanguage(),
          payload.preferredTheme(),
          payload.notificationChannel(),
          payload.notificationsEnabled(),
          payload.automaticTaskPolicy(),
          payload.automaticTaskDelaySeconds(),
          payload.automaticTaskNotifyOnly()
        )
      )
    );
  }

  @Operation(summary = "List modeled shared process entities and their current values")
  @GetMapping("/shared-data/entities")
  public Map<String, Object> listSharedDataEntities(
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "entities",
      processRuntimeEngineUseCase.listSharedDataEntities(
        new ProcessRuntimeEngineUseCase.SharedDataQuery(actor, roles)
      )
    );
  }

  @Operation(summary = "Read one shared process entity payload")
  @GetMapping("/shared-data/entities/{entityKey}")
  public Map<String, Object> readSharedDataEntity(
    @PathVariable("entityKey") String entityKey,
    @RequestParam(name = "actor", required = false) String actor,
    @RequestParam(name = "roles", required = false) List<String> roles
  ) {
    return Map.of(
      "entity",
      processRuntimeEngineUseCase.readSharedDataEntity(
        new ProcessRuntimeEngineUseCase.ReadSharedDataQuery(actor, roles, entityKey)
      )
    );
  }

  @Operation(summary = "Upsert shared process entity data")
  @PostMapping("/shared-data/entities/{entityKey}")
  public Map<String, Object> upsertSharedDataEntity(
    @PathVariable("entityKey") String entityKey,
    @RequestBody SharedDataMutationPayload payload
  ) {
    return Map.of(
      "entity",
      processRuntimeEngineUseCase.upsertSharedDataEntity(
        new ProcessRuntimeEngineUseCase.UpsertSharedDataCommand(
          payload.actor(),
          payload.roleCodes(),
          entityKey,
          payload.values()
        )
      )
    );
  }

  @Operation(summary = "Delete shared process entity data")
  @DeleteMapping("/shared-data/entities/{entityKey}")
  public Map<String, Object> deleteSharedDataEntity(
    @PathVariable("entityKey") String entityKey,
    @RequestBody SharedDataDeletePayload payload
  ) {
    return Map.of(
      "deleted",
      Boolean.valueOf(
        processRuntimeEngineUseCase.deleteSharedDataEntity(
          new ProcessRuntimeEngineUseCase.DeleteSharedDataCommand(
            payload.actor(),
            payload.roleCodes(),
            entityKey
          )
        )
      )
    );
  }

  public record StartInstancePayload(
    String modelKey,
    int versionNumber,
    String startActivityId,
    String actor,
    List<String> roleCodes,
    Map<String, Object> initialPayload
  ) {
  }

  public record CompleteTaskPayload(
    String instanceId,
    String actor,
    List<String> roleCodes,
    Map<String, Object> payload
  ) {
  }

  public record AssignTaskPayload(
    String instanceId,
    String actor,
    List<String> roleCodes,
    String assignee,
    boolean force
  ) {
  }

  public record StopInstancePayload(
    String actor,
    List<String> roleCodes,
    String reason
  ) {
  }

  public record ArchiveInstancePayload(
    String actor,
    List<String> roleCodes
  ) {
  }

  public record UpdateUserPreferencesPayload(
    String actor,
    List<String> roleCodes,
    String targetUserId,
    String profileDisplayName,
    String profilePhotoUrl,
    String preferredLanguage,
    String preferredTheme,
    String notificationChannel,
    boolean notificationsEnabled,
    String automaticTaskPolicy,
      int automaticTaskDelaySeconds,
      boolean automaticTaskNotifyOnly
  ) {
  }

  public record SharedDataMutationPayload(
    String actor,
    List<String> roleCodes,
    Map<String, Object> values
  ) {
  }

  public record SharedDataDeletePayload(
    String actor,
    List<String> roleCodes
  ) {
  }
}
`;
}

function buildProcessRuntimeEngineUtJava({ basePackage }) {
  return `package ${basePackage}.tests.unit;

import ${basePackage}.system.application.process.runtime.port.in.ProcessRuntimeEngineUseCase;
import ${basePackage}.system.application.process.runtime.port.out.ProcessRuntimeStorePort;
import ${basePackage}.system.application.process.runtime.service.ProcessRuntimeEngineService;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProcessRuntimeEngineUT {
  @Test
  void shouldStartAndCompleteTaskForDeployedProcess() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());

    List<ProcessRuntimeEngineUseCase.StartOption> startOptions = useCase.listStartOptions(
      new ProcessRuntimeEngineUseCase.StartOptionsQuery("alice", List.of("PROCESS_USER"))
    );
    assertThat(startOptions).isNotEmpty();

    ProcessRuntimeEngineUseCase.StartOption option = startOptions.get(0);
    ProcessRuntimeEngineUseCase.RuntimeInstanceView started = useCase.startInstance(
      new ProcessRuntimeEngineUseCase.StartCommand(
        option.modelKey(),
        option.versionNumber(),
        option.allowedStartActivities().isEmpty() ? null : option.allowedStartActivities().get(0),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("amount", 1000)
      )
    );

    assertThat(started.instanceId()).isNotBlank();
    assertThat(started.tasks()).isNotEmpty();

    ProcessRuntimeEngineUseCase.RuntimeTaskView task = started.tasks().stream()
      .filter((entry) -> "PENDING".equals(entry.status()))
      .findFirst()
      .orElseThrow();

    ProcessRuntimeEngineUseCase.RuntimeTaskView completed = useCase.completeTask(
      new ProcessRuntimeEngineUseCase.CompleteTaskCommand(
        started.instanceId(),
        task.taskId(),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("decision", "APPROVED")
      )
    );

    assertThat(completed.status()).isEqualTo("COMPLETED");
  }

  @Test
  void shouldAllowMonitorToAssignPendingTask() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());
    ProcessRuntimeEngineUseCase.StartOption option = useCase.listStartOptions(
      new ProcessRuntimeEngineUseCase.StartOptionsQuery("alice", List.of("PROCESS_USER"))
    ).get(0);

    ProcessRuntimeEngineUseCase.RuntimeInstanceView started = useCase.startInstance(
      new ProcessRuntimeEngineUseCase.StartCommand(
        option.modelKey(),
        option.versionNumber(),
        option.allowedStartActivities().isEmpty() ? null : option.allowedStartActivities().get(0),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("seed", "assignment-test")
      )
    );

    ProcessRuntimeEngineUseCase.RuntimeTaskView pending = started.tasks().stream()
      .filter((entry) -> "PENDING".equals(entry.status()))
      .findFirst()
      .orElseThrow();

    ProcessRuntimeEngineUseCase.RuntimeTaskView reassigned = useCase.assignTask(
      new ProcessRuntimeEngineUseCase.AssignTaskCommand(
        started.instanceId(),
        pending.taskId(),
        "manager",
        List.of("PROCESS_MONITOR"),
        "alice",
        true
      )
    );

    assertThat(reassigned.assignee()).isEqualTo("alice");
    assertThat(reassigned.assignmentStatus()).isEqualTo("ASSIGNED");
  }

  @Test
  void shouldRequireMonitorRoleForGovernanceActionsAndTrackAuditEvents() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());
    ProcessRuntimeEngineUseCase.StartOption option = useCase.listStartOptions(
      new ProcessRuntimeEngineUseCase.StartOptionsQuery("alice", List.of("PROCESS_USER"))
    ).get(0);

    ProcessRuntimeEngineUseCase.RuntimeInstanceView started = useCase.startInstance(
      new ProcessRuntimeEngineUseCase.StartCommand(
        option.modelKey(),
        option.versionNumber(),
        option.allowedStartActivities().isEmpty() ? null : option.allowedStartActivities().get(0),
        "alice",
        List.of("PROCESS_USER"),
        Map.of("seed", "monitor-audit-test")
      )
    );

    assertThatThrownBy(() ->
      useCase.stopInstance(
        new ProcessRuntimeEngineUseCase.StopCommand(
          started.instanceId(),
          "alice",
          List.of("PROCESS_USER"),
          "not-allowed"
        )
      )
    ).isInstanceOf(IllegalStateException.class);

    ProcessRuntimeEngineUseCase.RuntimeInstanceView stopped = useCase.stopInstance(
      new ProcessRuntimeEngineUseCase.StopCommand(
        started.instanceId(),
        "manager",
        List.of("PROCESS_MONITOR"),
        "suspicious runtime drift"
      )
    );
    assertThat(stopped.status()).isEqualTo("STOPPED");

    ProcessRuntimeEngineUseCase.RuntimeInstanceView archived = useCase.archiveInstance(
      new ProcessRuntimeEngineUseCase.ArchiveCommand(
        started.instanceId(),
        "manager",
        List.of("PROCESS_MONITOR")
      )
    );
    assertThat(archived.status()).isEqualTo("ARCHIVED");

    List<ProcessRuntimeEngineUseCase.MonitorEventView> events = useCase.listMonitorEvents(
      new ProcessRuntimeEngineUseCase.MonitorEventsQuery(
        "manager",
        List.of("PROCESS_MONITOR"),
        started.instanceId(),
        "",
        20
      )
    );

    assertThat(events).isNotEmpty();
    assertThat(events).anyMatch((entry) -> "INSTANCE_STOP".equals(entry.actionType()));
    assertThat(events).anyMatch((entry) -> "INSTANCE_ARCHIVE".equals(entry.actionType()));
  }

  @Test
  void shouldReadAndUpdateUserPreferences() {
    ProcessRuntimeEngineUseCase useCase = new ProcessRuntimeEngineService(new InMemoryStore());

    ProcessRuntimeEngineUseCase.RuntimeUserPreferencesView current = useCase.readUserPreferences(
      new ProcessRuntimeEngineUseCase.UserPreferencesQuery("alice", List.of("PROCESS_USER"), null)
    );
    assertThat(current.userId()).isEqualTo("alice");

    ProcessRuntimeEngineUseCase.RuntimeUserPreferencesView updated = useCase.updateUserPreferences(
      new ProcessRuntimeEngineUseCase.UpdateUserPreferencesCommand(
        "alice",
        List.of("PROCESS_USER"),
        null,
        "Alice Cooper",
        "",
        "fr",
        "LIGHT",
        "IN_APP",
        true,
        "AUTO_AFTER_DELAY",
        30,
        true
      )
    );

    assertThat(updated.profileDisplayName()).isEqualTo("Alice Cooper");
    assertThat(updated.preferredLanguage()).isEqualTo("fr");
    assertThat(updated.automaticTaskPolicy()).isEqualTo("AUTO_AFTER_DELAY");
    assertThat(updated.automaticTaskDelaySeconds()).isEqualTo(30);
  }

  private static final class InMemoryStore implements ProcessRuntimeStorePort {
    private final Map<String, ProcessRuntimeInstance> byId = new HashMap<>();
    private final Map<String, Map<String, Object>> sharedDataByEntity = new HashMap<>();
    private final List<ProcessRuntimeStorePort.RuntimeMonitorEvent> monitorEvents = new ArrayList<>();
    private final Map<String, ProcessRuntimeStorePort.RuntimeUserPreferences> preferencesByUserId = new HashMap<>();
    private final List<ProcessRuntimeStorePort.RuntimeUserDescriptor> users = List.of(
      new ProcessRuntimeStorePort.RuntimeUserDescriptor("alice", List.of("PROCESS_USER"), "unit.operations", "manager"),
      new ProcessRuntimeStorePort.RuntimeUserDescriptor("manager", List.of("PROCESS_MONITOR", "PROCESS_USER"), "unit.operations", "admin"),
      new ProcessRuntimeStorePort.RuntimeUserDescriptor("admin", List.of("ADMINISTRATOR", "PROCESS_MONITOR"), "unit.executive", null)
    );
    private final ProcessRuntimeStorePort.RuntimeOrganizationSnapshot organizationSnapshot = new ProcessRuntimeStorePort.RuntimeOrganizationSnapshot(
      List.of(
        new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.executive", null, "admin", List.of("admin")),
        new ProcessRuntimeStorePort.RuntimeOrganizationUnitDescriptor("unit.operations", "unit.executive", "manager", List.of("alice", "manager"))
      )
    );

    private InMemoryStore() {
      preferencesByUserId.put(
        "alice",
        new ProcessRuntimeStorePort.RuntimeUserPreferences(
          "alice",
          "Alice",
          "",
          "en",
          "SYSTEM",
          "IN_APP_EMAIL",
          true,
          "MANUAL_TRIGGER",
          0,
          true
        )
      );
      preferencesByUserId.put(
        "manager",
        new ProcessRuntimeStorePort.RuntimeUserPreferences(
          "manager",
          "Manager",
          "",
          "en",
          "SYSTEM",
          "IN_APP_EMAIL",
          true,
          "AUTO_IMMEDIATE",
          0,
          true
        )
      );
    }

    @Override
    public List<ProcessRuntimeInstance> listInstances() {
      return new ArrayList<>(byId.values());
    }

    @Override
    public Optional<ProcessRuntimeInstance> findById(String instanceId) {
      return Optional.ofNullable(byId.get(instanceId));
    }

    @Override
    public void save(ProcessRuntimeInstance instance) {
      byId.put(instance.instanceId(), instance);
    }

    @Override
    public Map<String, Object> readSharedData(String entityKey) {
      return Map.copyOf(sharedDataByEntity.getOrDefault(entityKey, Map.of()));
    }

    @Override
    public void writeSharedData(String entityKey, Map<String, Object> values) {
      if (entityKey == null || entityKey.isBlank()) {
        return;
      }

      Map<String, Object> merged = new HashMap<>(sharedDataByEntity.getOrDefault(entityKey, Map.of()));
      if (values != null) {
        merged.putAll(values);
      }
      sharedDataByEntity.put(entityKey, merged);
    }

    @Override
    public List<String> listSharedDataEntityKeys() {
      return sharedDataByEntity.keySet().stream().sorted().toList();
    }

    @Override
    public void deleteSharedData(String entityKey) {
      if (entityKey == null || entityKey.isBlank()) {
        return;
      }
      sharedDataByEntity.remove(entityKey);
    }

    @Override
    public List<ProcessRuntimeStorePort.RuntimeUserDescriptor> listUsers() {
      return users;
    }

    @Override
    public ProcessRuntimeStorePort.RuntimeOrganizationSnapshot readOrganizationSnapshot() {
      return organizationSnapshot;
    }

    @Override
    public void appendMonitorEvent(ProcessRuntimeStorePort.RuntimeMonitorEvent event) {
      if (event == null) {
        return;
      }
      monitorEvents.add(
        new ProcessRuntimeStorePort.RuntimeMonitorEvent(
          event.eventId(),
          event.occurredAt() == null ? Instant.now() : event.occurredAt(),
          event.actionType(),
          event.actor(),
          event.actorRoleCodes() == null ? List.of() : List.copyOf(event.actorRoleCodes()),
          event.targetType(),
          event.targetId(),
          event.details(),
          event.forced()
        )
      );
    }

    @Override
    public List<ProcessRuntimeStorePort.RuntimeMonitorEvent> listMonitorEvents() {
      return List.copyOf(monitorEvents);
    }

    @Override
    public ProcessRuntimeStorePort.RuntimeUserPreferences readUserPreferences(String userId) {
      return preferencesByUserId.get(userId);
    }

    @Override
    public void saveUserPreferences(ProcessRuntimeStorePort.RuntimeUserPreferences preferences) {
      if (preferences == null || preferences.userId() == null || preferences.userId().isBlank()) {
        return;
      }
      preferencesByUserId.put(preferences.userId(), preferences);
    }
  }
}
`;
}

function buildProcessRuntimeEngineItJava({ basePackage, modelKey, versionNumber }) {
  return `package ${basePackage}.tests.system;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prooweb.generated.app.ProowebApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
  classes = ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=jdbc:h2:mem:prooweb-runtime-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
  }
)
@AutoConfigureMockMvc
class ProcessRuntimeEngineIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldStartAndCompleteRuntimeTaskThroughApi() throws Exception {
    mockMvc.perform(
      get("/api/process-runtime/start-options")
        .queryParam("actor", "runtime.user")
        .queryParam("roles", "PROCESS_USER")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.startOptions").isArray());

    MvcResult startResult = mockMvc.perform(
      post("/api/process-runtime/instances/start")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "modelKey": "${escapeJavaSingle(modelKey)}",
            "versionNumber": ${versionNumber},
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
            "initialPayload": {
              "seed": "runtime-test"
            }
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instance.instanceId").isNotEmpty())
      .andReturn();

    JsonNode startPayload = objectMapper.readTree(startResult.getResponse().getContentAsString());
    String instanceId = startPayload.path("instance").path("instanceId").asText();
    String taskId = startPayload.path("instance").path("tasks").get(0).path("taskId").asText();

    mockMvc.perform(
      get("/api/process-runtime/instances")
        .queryParam("actor", "runtime.user")
        .queryParam("roles", "PROCESS_USER")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instances").isArray());

    mockMvc.perform(
      get("/api/process-runtime/tasks")
        .queryParam("actor", "runtime.supervisor")
        .queryParam("roles", "PROCESS_MONITOR")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.tasks").isArray())
      .andExpect(jsonPath("$.tasks[0].assignmentStatus").isNotEmpty())
      .andExpect(jsonPath("$.tasks[0].assignmentMode").isNotEmpty())
      .andExpect(jsonPath("$.tasks[0].assignmentStrategy").isNotEmpty());

    mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/assign")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "instanceId": "__INSTANCE_ID__",
            "actor": "runtime.supervisor",
            "roleCodes": ["PROCESS_MONITOR"],
            "assignee": "runtime.user",
            "force": true
          }
          """.replace("__INSTANCE_ID__", instanceId))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.task.assignee").value("runtime.user"));

    mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/complete")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "instanceId": "__INSTANCE_ID__",
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
            "payload": {
              "decision": "APPROVED"
            }
          }
          """.replace("__INSTANCE_ID__", instanceId))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.task.status").value("COMPLETED"));

    mockMvc.perform(
      get("/api/process-runtime/instances/" + instanceId + "/timeline")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.timeline").isArray());

    MvcResult monitorStartResult = mockMvc.perform(
      post("/api/process-runtime/instances/start")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "modelKey": "${escapeJavaSingle(modelKey)}",
            "versionNumber": ${versionNumber},
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
            "initialPayload": {
              "seed": "monitor-run"
            }
          }
          """)
    )
      .andExpect(status().isOk())
      .andReturn();

    JsonNode monitorStartPayload = objectMapper.readTree(monitorStartResult.getResponse().getContentAsString());
    String monitorInstanceId = monitorStartPayload.path("instance").path("instanceId").asText();

    mockMvc.perform(
      post("/api/process-runtime/instances/" + monitorInstanceId + "/stop")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "actor": "runtime.supervisor",
            "roleCodes": ["PROCESS_MONITOR"],
            "reason": "operator-stop"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instance.status").value("STOPPED"));

    mockMvc.perform(
      post("/api/process-runtime/instances/" + monitorInstanceId + "/archive")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "actor": "runtime.supervisor",
            "roleCodes": ["PROCESS_MONITOR"]
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.instance.status").value("ARCHIVED"));

    mockMvc.perform(
      get("/api/process-runtime/monitor/events")
        .queryParam("actor", "runtime.supervisor")
        .queryParam("roles", "PROCESS_MONITOR")
        .queryParam("instanceId", monitorInstanceId)
        .queryParam("limit", "20")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.events").isArray())
      .andExpect(jsonPath("$.events[0].actionType").isNotEmpty());

    mockMvc.perform(
      get("/api/process-runtime/preferences")
        .queryParam("actor", "runtime.user")
        .queryParam("roles", "PROCESS_USER")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.preferences.userId").value("runtime.user"));

    mockMvc.perform(
      post("/api/process-runtime/preferences")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "actor": "runtime.user",
            "roleCodes": ["PROCESS_USER"],
            "preferredLanguage": "fr",
            "preferredTheme": "LIGHT",
            "notificationChannel": "IN_APP",
            "notificationsEnabled": true,
            "automaticTaskPolicy": "AUTO_AFTER_DELAY",
            "automaticTaskDelaySeconds": 12,
            "automaticTaskNotifyOnly": true
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.preferences.preferredLanguage").value("fr"))
      .andExpect(jsonPath("$.preferences.automaticTaskPolicy").value("AUTO_AFTER_DELAY"))
      .andExpect(jsonPath("$.preferences.automaticTaskDelaySeconds").value(12));
  }
}
`;
}

function buildGeneratedProcessRuntimeApiJs() {
  return `const PROCESS_RUNTIME_API_ROOT = "/api/process-runtime";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || ("Process runtime request failed: " + response.status));
  }

  return payload;
}

function buildBasicHeader(username, password) {
  const raw = String(username || "") + ":" + String(password || "");
  if (typeof globalThis.btoa !== "function") {
    throw new Error("Browser runtime does not support Base64 encoding.");
  }
  return "Basic " + globalThis.btoa(raw);
}

function requestJsonWithBasic(url, payload = {}, basicAuth = null) {
  const headers = basicAuth
    ? {
        Authorization: buildBasicHeader(basicAuth.username, basicAuth.password),
      }
    : {};
  return requestJson(url, {
    method: "POST",
    body: payload,
    headers,
  });
}

export function fetchProcessRuntimeStartOptions({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/start-options?" + query.toString());
}

export function startProcessRuntimeInstance(payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/start", {
    method: "POST",
    body: payload,
  });
}

export function listProcessRuntimeTasks({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/tasks?" + query.toString());
}

export function listProcessRuntimeInstances({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances?" + query.toString());
}

export function completeProcessRuntimeTask(taskId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/tasks/" + encodeURIComponent(taskId) + "/complete", {
    method: "POST",
    body: payload,
  });
}

export function assignProcessRuntimeTask(taskId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/tasks/" + encodeURIComponent(taskId) + "/assign", {
    method: "POST",
    body: payload,
  });
}

export function readProcessRuntimeInstance(instanceId, { actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(
    PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "?" + query.toString(),
  );
}

export function readProcessRuntimeTimeline(instanceId) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/timeline");
}

export function listProcessRuntimeMonitorEvents(
  { actor = "", roles = [], instanceId = "", actionType = "", limit = 100 } = {},
) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  if (instanceId) {
    query.set("instanceId", instanceId);
  }
  if (actionType) {
    query.set("actionType", actionType);
  }
  if (limit) {
    query.set("limit", String(limit));
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/monitor/events?" + query.toString());
}

export function readProcessRuntimeUserPreferences({ actor = "", roles = [], targetUserId = "" } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  if (targetUserId) {
    query.set("targetUserId", targetUserId);
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/preferences?" + query.toString());
}

export function updateProcessRuntimeUserPreferences(payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/preferences", {
    method: "POST",
    body: payload,
  });
}

export function listProcessRuntimeSharedDataEntities({ actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/shared-data/entities?" + query.toString());
}

export function readProcessRuntimeSharedDataEntity(entityKey, { actor = "", roles = [] } = {}) {
  const query = new URLSearchParams();
  if (actor) {
    query.set("actor", actor);
  }
  for (const role of roles) {
    if (role) {
      query.append("roles", role);
    }
  }
  return requestJson(
    PROCESS_RUNTIME_API_ROOT + "/shared-data/entities/" + encodeURIComponent(entityKey) + "?" + query.toString(),
  );
}

export function upsertProcessRuntimeSharedDataEntity(entityKey, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/shared-data/entities/" + encodeURIComponent(entityKey), {
    method: "POST",
    body: payload,
  });
}

export function deleteProcessRuntimeSharedDataEntity(entityKey, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/shared-data/entities/" + encodeURIComponent(entityKey), {
    method: "DELETE",
    body: payload,
  });
}

export function setupOtpMfaWithBasicAuth({ username, password }) {
  return requestJsonWithBasic("/api/account/mfa/otp/setup", {}, { username, password });
}

export function setupTotpMfaWithBasicAuth({ username, password }) {
  return requestJsonWithBasic("/api/account/mfa/totp/setup", {}, { username, password });
}

export function requestPasswordReset(payload) {
  return requestJson("/api/auth/password-reset/request", {
    method: "POST",
    body: payload,
  });
}

export function confirmPasswordReset(payload) {
  return requestJson("/api/auth/password-reset/confirm", {
    method: "POST",
    body: payload,
  });
}

export function stopProcessRuntimeInstance(instanceId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/stop", {
    method: "POST",
    body: payload,
  });
}

export function archiveProcessRuntimeInstance(instanceId, payload) {
  return requestJson(PROCESS_RUNTIME_API_ROOT + "/instances/" + encodeURIComponent(instanceId) + "/archive", {
    method: "POST",
    body: payload,
  });
}
`;
}

function buildGeneratedProcessRuntimeHandlersReadmeMd(runtimeEntries) {
  const lines = [
    "# Generated Automatic Handler Stubs",
    "",
    "These classes are generated from deployed process specifications.",
    "Each method is a compilation-safe placeholder for automatic activities and must be implemented by developers.",
    "",
    "## Generated Stubs",
  ];

  for (const { model, version, runtimeContract } of runtimeEntries) {
    const automaticActivities = (runtimeContract.activities || []).filter((activity) => activity.activityType === "AUTOMATIC");
    lines.push(`- ${model.modelKey} v${version.versionNumber}: ${automaticActivities.length} automatic handler stub(s)`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function toAutomaticTaskClassName(taskTypeKey) {
  const pascal = toPascalCase(String(taskTypeKey || "").replace(/[._-]+/g, " "));
  return `${pascal}AutomaticTask`;
}

function buildCustomAutomaticTaskClassJava({
  basePackage,
  taskTypeKey,
  sourceCode,
}) {
  const className = toAutomaticTaskClassName(taskTypeKey);
  const rawBody = normalizeString(sourceCode)
    ? String(sourceCode)
    : `output.put("status", "CUSTOM_NOT_IMPLEMENTED");
    output.put("taskTypeKey", "${escapeJavaString(taskTypeKey)}");
    output.put("activityId", activityDescriptor.activityId());
    return output;`;
  const body = /return\s+[A-Za-z0-9_.()]+[\s;]*/.test(rawBody)
    ? rawBody
    : `${rawBody}
    return output;`;

  return `package ${basePackage}.system.application.process.runtime.service.autotasks;

import ${basePackage}.system.domain.process.runtime.GeneratedProcessRuntimeCatalog;
import ${basePackage}.system.domain.process.runtime.ProcessRuntimeInstance;
import java.util.HashMap;
import java.util.Map;

public final class ${className} {
  private ${className}() {
  }

  public static Map<String, Object> execute(
      Map<String, Object> inputData,
      Map<String, Object> configuration,
      ProcessRuntimeInstance instance,
      GeneratedProcessRuntimeCatalog.ActivityDescriptor activityDescriptor) {
    Map<String, Object> output = new HashMap<>();
    ${body}
  }
}
`;
}

function buildCustomAutomaticTaskDispatchCases({ basePackage, taskTypes }) {
  const rows = Array.isArray(taskTypes) ? taskTypes : [];
  if (rows.length === 0) {
    return "      default:\n        return null;";
  }

  const cases = rows.map((taskType) => {
    const className = toAutomaticTaskClassName(taskType.taskTypeKey);
    return `      case "${escapeJavaString(taskType.taskTypeKey)}":
        return ${basePackage}.system.application.process.runtime.service.autotasks.${className}.execute(
          inputData,
          configuration,
          instance,
          activityDescriptor
        );`;
  });

  cases.push("      default:\n        return null;");
  return cases.join("\n");
}

function buildAutomaticHandlersStubJava({ basePackage, processName, modelKey, versionNumber, runtimeContract }) {
  const className = `${processName}ProcessV${versionNumber}AutomaticHandlers`;
  const automaticActivities = (runtimeContract.activities || []).filter((entry) => entry.activityType === "AUTOMATIC");
  const methods = automaticActivities.length > 0
    ? automaticActivities.map((activity) => {
      const methodName = `handle${toPascalCase(activity.activityId)}`;
      const handlerRef = activity.automaticExecution?.handlerRef || `handlers.${toCamelCase(activity.activityId)}`;
      return `  /**
   * Stub generated from ${handlerRef}.
   * Replace this placeholder with business implementation.
   */
  public Map<String, Object> ${methodName}(Map<String, Object> inputData) {
    return Map.of(
      "status", "NOT_IMPLEMENTED",
      "handlerRef", "${escapeJavaString(handlerRef)}",
      "activityId", "${escapeJavaString(activity.activityId)}"
    );
  }`;
    }).join("\n\n")
    : `  public Map<String, Object> noAutomaticActivityStub(Map<String, Object> inputData) {
    return Map.of(
      "status", "NO_AUTOMATIC_ACTIVITY",
      "modelKey", "${escapeJavaString(modelKey)}"
    );
  }`;

  return `package ${basePackage}.system.application.process.runtime.handlers;

import java.util.Map;

public class ${className} {
${methods}
}
`;
}

function buildVersionMetadata(model, version, runtimeContract, dataContract) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      modelKey: model.modelKey,
      title: model.title,
      description: model.description || "",
      versionNumber: version.versionNumber,
      status: version.status,
      summary: version.summary || "",
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      deployedAt: version.deployedAt || null,
      specificationSchemaVersion: version?.specification?.schemaVersion || null,
      specification: version?.specification || null,
      runtimeSummary: runtimeContract?.summary || null,
      dataSummary: dataContract?.summary || null,
    },
    null,
    2,
  ) + "\n";
}

function buildHappyPathActivityIds(runtimeContract) {
  const activities = Array.isArray(runtimeContract?.activities) ? runtimeContract.activities : [];
  const activityIds = activities
    .map((entry) => normalizeString(entry?.activityId))
    .filter(Boolean);
  if (activityIds.length === 0) {
    return [];
  }

  const outgoingBySource = new Map();
  const transitions = Array.isArray(runtimeContract?.flow?.transitions) ? runtimeContract.flow.transitions : [];
  for (const transition of transitions) {
    const source = normalizeString(transition?.sourceActivityId);
    const target = normalizeString(transition?.targetActivityId);
    if (!source || !target) {
      continue;
    }
    if (!outgoingBySource.has(source)) {
      outgoingBySource.set(source, new Set());
    }
    outgoingBySource.get(source).add(target);
  }

  const configuredStarts = Array.isArray(runtimeContract?.start?.startActivities)
    ? runtimeContract.start.startActivities.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  const startActivity = configuredStarts.find((entry) => activityIds.includes(entry)) || activityIds[0];
  const path = [];
  const visited = new Set();
  let cursor = startActivity;

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    path.push(cursor);
    const nextTargets = Array.from(outgoingBySource.get(cursor) || []);
    if (nextTargets.length === 0) {
      break;
    }
    nextTargets.sort((left, right) => left.localeCompare(right));
    const nextCursor = nextTargets.find((entry) => !visited.has(entry)) || null;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return path;
}

function resolveBusinessStartRoles(runtimeContract) {
  const startableByRoles = Array.isArray(runtimeContract?.start?.startableByRoles)
    ? runtimeContract.start.startableByRoles.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  if (startableByRoles.length > 0) {
    return startableByRoles;
  }
  return ["PROCESS_USER"];
}

function resolveBusinessActor(roleCodes) {
  const roles = Array.isArray(roleCodes) ? roleCodes : [];
  if (roles.includes("ADMINISTRATOR")) {
    return "runtime.admin";
  }
  if (roles.includes("PROCESS_MONITOR")) {
    return "runtime.supervisor";
  }
  return "runtime.user";
}

function buildBackendDeployedProcessFeatureFile({ modelKey, versionNumber, runtimeContract }) {
  const happyPathActivityIds = buildHappyPathActivityIds(runtimeContract);
  const startRoles = resolveBusinessStartRoles(runtimeContract);
  const actor = resolveBusinessActor(startRoles);
  const roleCsv = startRoles.join(",");
  const activityAssertions = happyPathActivityIds
    .map((activityId) => `    And the deployed process timeline contains activity "${activityId}"`)
    .join("\n");
  const activitySection = activityAssertions ? `${activityAssertions}\n` : "";

  return `Feature: Deployed process ${modelKey} v${versionNumber} business runtime validation

  Scenario: ${modelKey} v${versionNumber} executes end to end as modeled
    Given deployed process "${modelKey}" version ${versionNumber} with actor "${actor}" and roles "${roleCsv}"
    When I start the deployed process instance
    Then the deployed process instance is created
    When I drive the deployed process instance to completion as monitor
    Then the deployed process instance reaches terminal status "COMPLETED"
    And the deployed process timeline contains marker "INSTANCE_STARTED"
${activitySection}    And the deployed process timeline contains marker "INSTANCE_COMPLETED"
`;
}

function buildFrontendDeployedProcessCypressSpec({ modelKey, versionNumber, runtimeContract }) {
  const happyPathActivityIds = buildHappyPathActivityIds(runtimeContract);
  const activityTypeById = {};
  const activities = Array.isArray(runtimeContract?.activities) ? runtimeContract.activities : [];
  for (const activity of activities) {
    const activityId = normalizeString(activity?.activityId);
    if (!activityId) {
      continue;
    }
    activityTypeById[activityId] = normalizeString(activity?.activityType || "MANUAL").toUpperCase() || "MANUAL";
  }
  const firstActivityId = happyPathActivityIds[0] || "";

  return `describe("Deployed process ${modelKey} v${versionNumber} business flow", () => {
  const modelKey = ${JSON.stringify(modelKey)};
  const versionNumber = ${versionNumber};
  const happyPathActivityIds = ${JSON.stringify(happyPathActivityIds)};
  const activityTypeById = ${JSON.stringify(activityTypeById, null, 2)};
  const firstActivityId = ${JSON.stringify(firstActivityId)};

  let started = false;
  let instanceId = "prc-cypress-generated";
  let instanceStatus = "RUNNING";
  let timeline = [];
  let pendingTasks = [];
  let pathCursor = 0;

  function buildTask(activityId) {
    const activityType = String(activityTypeById[activityId] || "MANUAL").toUpperCase();
    return {
      taskId: "tsk-" + activityId + "-" + String(pathCursor),
      instanceId,
      activityId,
      assignee: "process.user",
      activityType,
      assignmentStatus: "ASSIGNED",
      assignmentMode: "AUTOMATIC",
      assignmentStrategy: "ROLE_QUEUE",
      candidateRoles: ["PROCESS_USER"],
      manualAssignerRoles: ["PROCESS_MONITOR"],
      automaticTaskPolicy: activityType === "AUTOMATIC" ? "AUTO_IMMEDIATE" : "NONE",
    };
  }

  function advancePathUntilPendingOrCompleted() {
    while (pathCursor < happyPathActivityIds.length) {
      const activityId = happyPathActivityIds[pathCursor];
      const activityType = String(activityTypeById[activityId] || "MANUAL").toUpperCase();
      if (activityType === "AUTOMATIC") {
        timeline.push("AUTOMATIC_ACTIVITY_EXECUTED:" + activityId + ":AUTO_IMMEDIATE:process.user");
        pathCursor += 1;
        continue;
      }

      pendingTasks = [buildTask(activityId)];
      timeline.push("TASK_CREATED:" + activityId + ":process.user:AUTO_ASSIGNED_ROLE_QUEUE");
      return;
    }

    pendingTasks = [];
    instanceStatus = "COMPLETED";
    timeline.push("INSTANCE_COMPLETED");
  }

  function buildInstancePayload() {
    return {
      instanceId,
      modelKey,
      versionNumber,
      status: instanceStatus,
      startedBy: "process.user",
      tasks: pendingTasks.map((task) => ({
        taskId: task.taskId,
        activityId: task.activityId,
        assignee: task.assignee,
        status: "PENDING",
      })),
    };
  }

  beforeEach(() => {
    started = false;
    instanceId = "prc-cypress-generated";
    instanceStatus = "RUNNING";
    timeline = [];
    pendingTasks = [];
    pathCursor = 0;

    cy.intercept("GET", "**/api/meta*", {
      statusCode: 200,
      body: {
        siteTitle: "Generated ProOWeb App",
        backend: "springboot",
        database: "postgresql",
        swaggerEnabled: true,
        swaggerProfiles: ["dev", "test"],
      },
    });

    cy.intercept("GET", "**/api/system-health*", {
      statusCode: 200,
      body: {
        status: "UP",
      },
    });

    cy.intercept("GET", "**/api/process-runtime/start-options*", {
      statusCode: 200,
      body: {
        startOptions: [
          {
            modelKey,
            versionNumber,
            allowedStartActivities: firstActivityId ? [firstActivityId] : [],
            startableByRoles: ["PROCESS_USER"],
          },
        ],
      },
    }).as("runtimeStartOptions");

    cy.intercept("GET", "**/api/process-runtime/tasks*", (request) => {
      request.reply({
        statusCode: 200,
        body: {
          tasks: started ? pendingTasks : [],
        },
      });
    });

    cy.intercept("GET", "**/api/process-runtime/instances/*/timeline*", (request) => {
      request.reply({
        statusCode: 200,
        body: {
          timeline: started ? timeline : [],
        },
      });
    });

    cy.intercept("GET", "**/api/process-runtime/instances/*", (request) => {
      request.reply({
        statusCode: 200,
        body: {
          instance: started
            ? buildInstancePayload()
            : null,
        },
      });
    });

    cy.intercept("GET", "**/api/process-runtime/instances*", (request) => {
      request.reply({
        statusCode: 200,
        body: {
          instances: started ? [buildInstancePayload()] : [],
        },
      });
    });

    cy.intercept("GET", "**/api/process-runtime/preferences*", {
      statusCode: 200,
      body: {
        preferences: {
          userId: "process.user",
          profileDisplayName: "Process User",
          profilePhotoUrl: "",
          preferredLanguage: "en",
          preferredTheme: "SYSTEM",
          notificationChannel: "IN_APP_EMAIL",
          notificationsEnabled: true,
          automaticTaskPolicy: "MANUAL_TRIGGER",
          automaticTaskDelaySeconds: 0,
          automaticTaskNotifyOnly: true,
        },
      },
    });

    cy.intercept("GET", "**/api/process-runtime/monitor/events*", {
      statusCode: 200,
      body: {
        events: [],
      },
    });

    cy.intercept("POST", "**/api/process-runtime/instances/start", (request) => {
      started = true;
      instanceStatus = "RUNNING";
      timeline = ["INSTANCE_STARTED:process.user"];
      pendingTasks = [];
      pathCursor = 0;
      advancePathUntilPendingOrCompleted();
      request.reply({
        statusCode: 200,
        body: {
          instance: buildInstancePayload(),
        },
      });
    });

    cy.intercept("POST", "**/api/process-runtime/tasks/*/assign", (request) => {
      const taskId = String(request.url.split("/tasks/")[1] || "").split("/")[0];
      pendingTasks = pendingTasks.map((task) =>
        task.taskId === taskId
          ? {
              ...task,
              assignee: String(request.body?.assignee || "process.user"),
            }
          : task,
      );
      request.reply({
        statusCode: 200,
        body: {
          task: pendingTasks[0] || null,
        },
      });
    });

    cy.intercept("POST", "**/api/process-runtime/tasks/*/complete", (request) => {
      const currentTask = pendingTasks[0] || null;
      if (currentTask) {
        timeline.push("TASK_COMPLETED:" + currentTask.activityId + ":process.user");
        pendingTasks = [];
        pathCursor += 1;
      }
      advancePathUntilPendingOrCompleted();

      request.reply({
        statusCode: 200,
        body: {
          task: currentTask
            ? {
                ...currentTask,
                status: "COMPLETED",
              }
            : null,
        },
      });
    });
  });

  it("executes a modeled business flow end to end on the generated runtime workbench", () => {
    cy.visit("/");
    cy.contains("Process Runtime Workbench");
    cy.contains("button", "Refresh runtime snapshot").click();
    cy.wait("@runtimeStartOptions");
    cy.contains("button", "Start process instance", { timeout: 10000 }).should("not.be.disabled").click();

    const manualHappyPathSize = happyPathActivityIds.filter((activityId) =>
      String(activityTypeById[activityId] || "MANUAL").toUpperCase() !== "AUTOMATIC",
    ).length;

    for (let index = 0; index < manualHappyPathSize; index += 1) {
      cy.contains("button", "Complete task").should("be.enabled").click();
    }

    cy.contains("button", "Refresh runtime snapshot").click();
    cy.wait("@runtimeStartOptions");
    cy.contains("Selected status:");
    cy.contains("COMPLETED");
    cy.contains("INSTANCE_COMPLETED");
    happyPathActivityIds.forEach((activityId) => {
      cy.contains(activityId);
    });
  });
});
`;
}

function buildDeploymentFiles({
  workspaceConfig,
  model,
  version,
  deployedRecords,
  automaticTaskCatalog,
}) {
  const basePackage = normalizeBasePackage(workspaceConfig?.project?.basePackage || DEFAULT_BASE_PACKAGE);
  const basePackagePath = basePackage.replace(/\./g, "/");
  const processName = toPascalCase(model.modelKey);
  const normalizedModelFileSegment = toFileSegment(model.modelKey);
  const backendBddCucumberEnabled = Boolean(workspaceConfig?.backendOptions?.testAutomation?.backendBddCucumberEnabled);
  const frontendCypressE2eEnabled = Boolean(workspaceConfig?.backendOptions?.testAutomation?.frontendE2eCypressEnabled);
  const runtimeContract = buildRuntimeContract({ model, version });
  const dataContract = buildDataContract({
    model,
    version,
    runtimeContract,
  });
  const runtimeEntries = deployedRecords.map((entry) => {
    const deployedRuntimeContract = buildRuntimeContract({
      model: entry.model,
      version: entry.version,
    });
    const deployedDataContract = buildDataContract({
      model: entry.model,
      version: entry.version,
      runtimeContract: deployedRuntimeContract,
    });

    return {
      model: entry.model,
      version: entry.version,
      runtimeContract: deployedRuntimeContract,
      dataContract: deployedDataContract,
      entry: buildRuntimeCatalogEntry({
        model: entry.model,
        version: entry.version,
        contract: deployedRuntimeContract,
      }),
      dataEntry: buildDataCatalogEntry({
        model: entry.model,
        version: entry.version,
        dataContract: deployedDataContract,
      }),
    };
  });
  const currentRuntimeEntry = runtimeEntries.find(
    (entry) =>
      entry.model.modelKey === model.modelKey
      && entry.version.versionNumber === version.versionNumber,
  );
  const usedAutomaticTaskTypes = resolveUsedAutomaticTaskTypes(
    automaticTaskCatalog,
    runtimeEntries,
  );
  const usedCustomAutomaticTaskTypes = usedAutomaticTaskTypes.usedTaskTypes
    .filter((entry) => entry.kind === "CUSTOM")
    .sort((left, right) => left.taskTypeKey.localeCompare(right.taskTypeKey));
  const customAutomaticTaskDispatchCases = buildCustomAutomaticTaskDispatchCases({
    basePackage,
    taskTypes: usedCustomAutomaticTaskTypes,
  });
  const compiledSharedEntities = normalizeSharedEntitiesForCompilation(runtimeEntries);
  const sharedEntityClassByKey = new Map(compiledSharedEntities.map((entry) => [entry.entityKey, entry.className]));

  const backendProcessRoot = path.join(
    "src/backend/springboot/system/system-domain/src/main/java",
    basePackagePath,
    "system/domain/process",
  );
  const backendDomainRuntimeRoot = path.join(
    "src/backend/springboot/system/system-domain/src/main/java",
    basePackagePath,
    "system/domain/process/runtime",
  );
  const backendApplicationRuntimeRoot = path.join(
    "src/backend/springboot/system/system-application/src/main/java",
    basePackagePath,
    "system/application/process/runtime",
  );
  const backendInfrastructureRuntimeRoot = path.join(
    "src/backend/springboot/system/system-infrastructure/src/main/java",
    basePackagePath,
    "system/infrastructure/process/runtime",
  );
  const backendInfrastructureSharedDataModelRoot = path.join(
    "src/backend/springboot/system/system-infrastructure/src/main/java",
    basePackagePath,
    "system/infrastructure/process/runtime/shareddata/model",
  );
  const backendInfrastructureSharedDataRepositoryRoot = path.join(
    "src/backend/springboot/system/system-infrastructure/src/main/java",
    basePackagePath,
    "system/infrastructure/process/runtime/shareddata/repository",
  );
  const backendInfrastructureConfigRoot = path.join(
    "src/backend/springboot/system/system-infrastructure/src/main/java",
    basePackagePath,
    "system/infrastructure/config",
  );
  const backendGatewayApiRoot = path.join(
    "src/backend/springboot/gateway/src/main/java",
    basePackagePath,
    "gateway/api",
  );
  const backendUnitTestsRoot = path.join(
    "src/backend/springboot/tests/vanilla-unit-tests/system-application-ut/src/test/java",
    basePackagePath,
    "tests/unit",
  );
  const backendIntegrationTestsRoot = path.join(
    "src/backend/springboot/system/system-infrastructure-it/src/test/java",
    basePackagePath,
    "tests/system",
  );
  const backendResourcesMainRoot = "src/backend/springboot/prooweb-application/src/main/resources";
  const liquibaseLayout = resolveLiquibaseResourceLayout(workspaceConfig);
  const backendResourcesRoot = path.join("src/backend/springboot/prooweb-application/src/main/resources/processes", model.modelKey);
  const backendBddFeaturesRoot = "src/backend/springboot/tests/system-infrastructure-it/src/test/resources/features";
  const frontendProcessRoot = path.join("src/frontend/web/react/src/modules/processes", model.modelKey);
  const frontendRuntimeRoot = "src/frontend/web/react/src/modules/processes/runtime";
  const frontendCypressE2eRoot = "src/frontend/web/react/cypress/e2e";

  const files = [
    {
      relativePath: toPosixPath(path.join(backendProcessRoot, `${processName}ProcessV${version.versionNumber}Spec.java`)),
      content: buildBackendDefinitionClass({
        basePackage,
        modelKey: model.modelKey,
        versionNumber: version.versionNumber,
        processName,
      }),
      kind: "backend-java",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.bpmn`)),
      content: String(version.bpmnXml || ""),
      kind: "backend-bpmn",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.json`)),
      content: buildVersionMetadata(model, version, runtimeContract, dataContract),
      kind: "backend-metadata",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.runtime.json`)),
      content: `${JSON.stringify(runtimeContract, null, 2)}\n`,
      kind: "backend-runtime-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesRoot, `v${version.versionNumber}.data.json`)),
      content: `${JSON.stringify(dataContract, null, 2)}\n`,
      kind: "backend-data-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: "src/backend/springboot/prooweb-application/src/main/resources/processes/runtime-catalog.json",
      content: buildBackendRuntimeCatalogJson(runtimeEntries),
      kind: "backend-runtime-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: "src/backend/springboot/prooweb-application/src/main/resources/processes/data-catalog.json",
      content: buildBackendDataCatalogJson(runtimeEntries),
      kind: "backend-data-catalog",
      modelKey: "_data_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: "src/backend/springboot/prooweb-application/src/main/resources/processes/automatic-task-catalog.json",
      content: buildBackendAutomaticTaskCatalogJson({
        usedTaskTypes: usedAutomaticTaskTypes.usedTaskTypes,
        libraryCatalog: automaticTaskCatalog?.libraries || { maven: [], npm: [] },
        missingTaskTypes: usedAutomaticTaskTypes.missingTaskTypes,
      }),
      kind: "backend-automatic-task-catalog",
      modelKey: "_automatic_task_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "GeneratedProcessRuntimeCatalog.java")),
      content: buildGeneratedProcessRuntimeCatalogJava({ basePackage, runtimeEntries }),
      kind: "backend-runtime-generated-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeState.java")),
      content: buildProcessRuntimeStateJava({ basePackage }),
      kind: "backend-runtime-domain-state",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeTaskState.java")),
      content: buildProcessRuntimeTaskStateJava({ basePackage }),
      kind: "backend-runtime-domain-task-state",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeTask.java")),
      content: buildProcessRuntimeTaskJava({ basePackage }),
      kind: "backend-runtime-domain-task",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendDomainRuntimeRoot, "ProcessRuntimeInstance.java")),
      content: buildProcessRuntimeInstanceJava({ basePackage }),
      kind: "backend-runtime-domain-instance",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "port/in/ProcessRuntimeEngineUseCase.java")),
      content: buildProcessRuntimeEngineUseCaseJava({ basePackage }),
      kind: "backend-runtime-application-usecase",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "port/out/ProcessRuntimeStorePort.java")),
      content: buildProcessRuntimeStorePortJava({ basePackage }),
      kind: "backend-runtime-application-store-port",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "service/ProcessRuntimeEngineService.java")),
      content: buildProcessRuntimeEngineServiceJava({
        basePackage,
        customTaskDispatchCases: customAutomaticTaskDispatchCases,
      }),
      kind: "backend-runtime-application-service",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, `handlers/${processName}ProcessV${version.versionNumber}AutomaticHandlers.java`)),
      content: buildAutomaticHandlersStubJava({
        basePackage,
        processName,
        modelKey: model.modelKey,
        versionNumber: version.versionNumber,
        runtimeContract,
      }),
      kind: "backend-runtime-automatic-handler-stub",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(backendApplicationRuntimeRoot, "handlers/README.md")),
      content: buildGeneratedProcessRuntimeHandlersReadmeMd(runtimeEntries),
      kind: "backend-runtime-handlers-readme",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendInfrastructureRuntimeRoot, "InMemoryProcessRuntimeStoreAdapter.java")),
      content: buildInMemoryProcessRuntimeStoreAdapterJava({ basePackage }),
      kind: "backend-runtime-infrastructure-store",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendInfrastructureRuntimeRoot, "JpaBackedProcessRuntimeStoreAdapter.java")),
      content: buildJpaBackedProcessRuntimeStoreAdapterJava({
        basePackage,
        sharedEntities: compiledSharedEntities,
      }),
      kind: "backend-runtime-infrastructure-jpa-store",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    ...compiledSharedEntities.map((entity) => ({
      relativePath: toPosixPath(path.join(backendInfrastructureSharedDataModelRoot, `${entity.className}.java`)),
      content: buildSharedDataEntityJpaJava({
        basePackage,
        entity,
        entityClassByKey: sharedEntityClassByKey,
      }),
      kind: "backend-runtime-shared-entity-jpa-model",
      modelKey: "_shared_data_",
      versionNumber: 1,
    })),
    ...compiledSharedEntities.map((entity) => ({
      relativePath: toPosixPath(path.join(backendInfrastructureSharedDataRepositoryRoot, `${entity.repositoryName}.java`)),
      content: buildSharedDataRepositoryJava({
        basePackage,
        entity,
      }),
      kind: "backend-runtime-shared-entity-jpa-repository",
      modelKey: "_shared_data_",
      versionNumber: 1,
    })),
    {
      relativePath: toPosixPath(path.join(backendInfrastructureConfigRoot, "ProcessRuntimeModuleConfig.java")),
      content: buildProcessRuntimeModuleConfigJava({ basePackage }),
      kind: "backend-runtime-infrastructure-config",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendGatewayApiRoot, "ProcessRuntimeController.java")),
      content: buildGatewayProcessRuntimeControllerJava({ basePackage }),
      kind: "backend-runtime-gateway-controller",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendUnitTestsRoot, "ProcessRuntimeEngineUT.java")),
      content: buildProcessRuntimeEngineUtJava({ basePackage }),
      kind: "backend-runtime-ut",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendIntegrationTestsRoot, "ProcessRuntimeEngineIT.java")),
      content: buildProcessRuntimeEngineItJava({
        basePackage,
        modelKey: model.modelKey,
        versionNumber: version.versionNumber,
      }),
      kind: "backend-runtime-it",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}Descriptor.js`)),
      content: buildFrontendDescriptorModule({
        model,
        version,
        processName,
        runtimeContract,
        runtimeCatalogEntry: currentRuntimeEntry?.entry || buildRuntimeCatalogEntry({ model, version, contract: runtimeContract }),
        dataContract,
        dataCatalogEntry: currentRuntimeEntry?.dataEntry || buildDataCatalogEntry({ model, version, dataContract }),
      }),
      kind: "frontend-descriptor",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}RuntimeContract.js`)),
      content: buildFrontendRuntimeContractModule({
        runtimeContract,
        processName,
        versionNumber: version.versionNumber,
      }),
      kind: "frontend-runtime-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(frontendProcessRoot, `Process${processName}V${version.versionNumber}DataContract.js`)),
      content: buildFrontendDataContractModule({
        dataContract,
        processName,
        versionNumber: version.versionNumber,
      }),
      kind: "frontend-data-contract",
      modelKey: model.modelKey,
      versionNumber: version.versionNumber,
    },
    {
      relativePath: toPosixPath(path.join(
        "src/backend/springboot/system/system-domain/src/main/java",
        basePackagePath,
        "system/domain/process/GeneratedProcessRegistry.java",
      )),
      content: buildBackendRegistryClass({ basePackage, runtimeEntries }),
      kind: "backend-registry",
      modelKey: "_registry_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessRegistry.js",
      content: buildFrontendRegistryModule(runtimeEntries),
      kind: "frontend-registry",
      modelKey: "_registry_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedTaskInboxCatalog.js",
      content: buildFrontendTaskInboxCatalogModule(runtimeEntries),
      kind: "frontend-task-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessFormCatalog.js",
      content: buildFrontendProcessFormCatalogModule(runtimeEntries),
      kind: "frontend-form-catalog",
      modelKey: "_runtime_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessDataLineageCatalog.js",
      content: buildFrontendDataLineageCatalogModule(runtimeEntries),
      kind: "frontend-data-lineage-catalog",
      modelKey: "_data_catalog_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesMainRoot, liquibaseLayout.masterResourcePath)),
      content: buildLiquibaseMasterWithProcessSharedDataYaml(liquibaseLayout),
      kind: "backend-liquibase-master",
      modelKey: "_shared_data_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(backendResourcesMainRoot, liquibaseLayout.generatedProcessSharedDataResourcePath)),
      content: buildProcessSharedDataLiquibaseChangelogYaml({ sharedEntities: compiledSharedEntities }),
      kind: "backend-liquibase-process-shared-data",
      modelKey: "_shared_data_",
      versionNumber: 1,
    },
    {
      relativePath: toPosixPath(path.join(frontendRuntimeRoot, "generatedProcessRuntimeApi.js")),
      content: buildGeneratedProcessRuntimeApiJs(),
      kind: "frontend-runtime-api",
      modelKey: "_runtime_engine_",
      versionNumber: 1,
    },
    ...(backendBddCucumberEnabled
      ? [
          {
            relativePath: toPosixPath(
              path.join(backendBddFeaturesRoot, `process_${normalizedModelFileSegment}_v${version.versionNumber}.feature`),
            ),
            content: buildBackendDeployedProcessFeatureFile({
              modelKey: model.modelKey,
              versionNumber: version.versionNumber,
              runtimeContract,
            }),
            kind: "backend-cucumber-feature",
            modelKey: model.modelKey,
            versionNumber: version.versionNumber,
          },
        ]
      : []),
    ...(frontendCypressE2eEnabled
      ? [
          {
            relativePath: toPosixPath(
              path.join(frontendCypressE2eRoot, `process-${normalizedModelFileSegment}-v${version.versionNumber}.cy.js`),
            ),
            content: buildFrontendDeployedProcessCypressSpec({
              modelKey: model.modelKey,
              versionNumber: version.versionNumber,
              runtimeContract,
            }),
            kind: "frontend-cypress-spec",
            modelKey: model.modelKey,
            versionNumber: version.versionNumber,
          },
        ]
      : []),
    ...usedCustomAutomaticTaskTypes.map((taskType) => ({
      relativePath: toPosixPath(path.join(
        backendApplicationRuntimeRoot,
        "service/autotasks",
        `${toAutomaticTaskClassName(taskType.taskTypeKey)}.java`,
      )),
      content: buildCustomAutomaticTaskClassJava({
        basePackage,
        taskTypeKey: taskType.taskTypeKey,
        sourceCode: taskType.source || "",
      }),
      kind: "backend-runtime-custom-automatic-task",
      modelKey: "_automatic_task_catalog_",
      versionNumber: 1,
    })),
  ];

  return {
    files,
    runtimeContract,
    dataContract,
    runtimeEntries,
    usedAutomaticTaskTypes,
  };
}

function buildDeploymentRecordKey(modelKey, versionNumber) {
  return `${normalizeModelKey(modelKey)}::${normalizeVersionNumber(versionNumber)}`;
}

function applyTemplateOverridesOnDeploymentFile(templateOverrideRuntime, file) {
  const overrideResult = applyTemplateOverridesToFile(
    templateOverrideRuntime,
    toPosixPath(file.relativePath),
    file.content,
  );

  return {
    ...file,
    content: overrideResult.content,
    templateOverrides: overrideResult.appliedOverrides,
    templateOverrideSkips: overrideResult.skippedOverrides,
  };
}

function buildManagedDeploymentPlan({
  rootDir,
  workspaceConfig,
  deployedRecords,
  templateOverrideRuntime,
  automaticTaskCatalog,
}) {
  const fileByPath = new Map();
  const buildByRecord = new Map();

  for (const record of Array.isArray(deployedRecords) ? deployedRecords : []) {
    const build = buildDeploymentFiles({
      workspaceConfig,
      model: record.model,
      version: record.version,
      deployedRecords,
      automaticTaskCatalog,
    });
    buildByRecord.set(
      buildDeploymentRecordKey(record.model.modelKey, record.version.versionNumber),
      build,
    );

    for (const file of build.files) {
      const overrideAwareFile = applyTemplateOverridesOnDeploymentFile(templateOverrideRuntime, file);
      fileByPath.set(toPosixPath(file.relativePath), overrideAwareFile);
    }
  }

  if (fileByPath.size === 0) {
    const fallbackRuntimeEntries = [];
    const fallbackFiles = [
      {
        relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessRegistry.js",
        content: buildFrontendRegistryModule(fallbackRuntimeEntries),
        kind: "frontend-generated-registry-fallback",
        modelKey: "_runtime_catalog_",
        versionNumber: 1,
      },
      {
        relativePath: "src/frontend/web/react/src/modules/processes/generatedTaskInboxCatalog.js",
        content: buildFrontendTaskInboxCatalogModule(fallbackRuntimeEntries),
        kind: "frontend-generated-task-catalog-fallback",
        modelKey: "_runtime_catalog_",
        versionNumber: 1,
      },
      {
        relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessFormCatalog.js",
        content: buildFrontendProcessFormCatalogModule(fallbackRuntimeEntries),
        kind: "frontend-generated-form-catalog-fallback",
        modelKey: "_runtime_catalog_",
        versionNumber: 1,
      },
      {
        relativePath: "src/frontend/web/react/src/modules/processes/generatedProcessDataLineageCatalog.js",
        content: buildFrontendDataLineageCatalogModule(fallbackRuntimeEntries),
        kind: "frontend-generated-lineage-catalog-fallback",
        modelKey: "_runtime_catalog_",
        versionNumber: 1,
      },
      {
        relativePath: "src/frontend/web/react/src/modules/processes/runtime/generatedProcessRuntimeApi.js",
        content: buildGeneratedProcessRuntimeApiJs(),
        kind: "frontend-generated-runtime-api-fallback",
        modelKey: "_runtime_catalog_",
        versionNumber: 1,
      },
    ];

    for (const file of fallbackFiles) {
      const overrideAwareFile = applyTemplateOverridesOnDeploymentFile(templateOverrideRuntime, file);
      fileByPath.set(toPosixPath(file.relativePath), overrideAwareFile);
    }
  }

  const files = Array.from(fileByPath.values());
  const overrideApplications = files.reduce(
    (count, file) => count + (Array.isArray(file.templateOverrides) ? file.templateOverrides.length : 0),
    0,
  );
  const filesWithOverrides = files.reduce(
    (count, file) => count + (Array.isArray(file.templateOverrides) && file.templateOverrides.length > 0 ? 1 : 0),
    0,
  );
  const overrideSkips = files.reduce(
    (count, file) => count + (Array.isArray(file.templateOverrideSkips) ? file.templateOverrideSkips.length : 0),
    0,
  );

  return {
    files,
    buildByRecord,
    templateCustomization: {
      filesWithOverrides,
      overrideApplications,
      overrideSkips,
      overridesMissingSources: templateOverrideRuntime?.diagnostics?.missingSourceFiles?.length || 0,
    },
  };
}

function applyManagedDeploymentWrite(rootDir, files, deploymentId, options = {}) {
  const removeMissing = Boolean(options.removeMissing);
  const filesWithOverrides = files.reduce(
    (count, file) => count + (Array.isArray(file.templateOverrides) && file.templateOverrides.length > 0 ? 1 : 0),
    0,
  );
  const overrideApplications = files.reduce(
    (count, file) => count + (Array.isArray(file.templateOverrides) ? file.templateOverrides.length : 0),
    0,
  );
  const overrideSkips = files.reduce(
    (count, file) => count + (Array.isArray(file.templateOverrideSkips) ? file.templateOverrideSkips.length : 0),
    0,
  );
  const report = {
    deploymentId,
    backupRoot: toPosixPath(path.join(".prooweb", "backups", deploymentId)),
    summary: {
      filesGenerated: files.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      conflictsResolved: 0,
      collisionsResolved: 0,
      backupsCreated: 0,
      filesWithOverrides,
      overrideApplications,
      overrideSkips,
    },
    details: {
      created: [],
      updated: [],
      unchanged: [],
      removed: [],
      conflictsResolved: [],
      collisionsResolved: [],
      backups: [],
      overrideSkips: [],
    },
  };

  const managedIndex = readManagedFileIndex(rootDir);
  const filesIndex = managedIndex.files || {};
  const existingManagedEntries = { ...filesIndex };
  const targetPaths = new Set(files.map((entry) => toPosixPath(entry.relativePath)));

  for (const file of files) {
    const relativePath = toPosixPath(file.relativePath);
    const absolutePath = resolveSafeAbsolutePath(rootDir, relativePath);
    const newHash = hashContent(file.content);
    const previousManaged = filesIndex[relativePath] || null;
    const exists = fs.existsSync(absolutePath);

    if (!exists) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, file.content, "utf8");
      report.summary.created += 1;
      report.details.created.push({
        path: relativePath,
        kind: file.kind,
        templateOverrides: file.templateOverrides || [],
      });
      if (Array.isArray(file.templateOverrideSkips) && file.templateOverrideSkips.length > 0) {
        report.details.overrideSkips.push({ path: relativePath, skips: file.templateOverrideSkips });
      }
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        templateOverrides: file.templateOverrides || [],
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    const currentHash = readFileHash(absolutePath);

    if (currentHash === newHash) {
      report.summary.unchanged += 1;
      report.details.unchanged.push({
        path: relativePath,
        kind: file.kind,
        templateOverrides: file.templateOverrides || [],
      });
      if (Array.isArray(file.templateOverrideSkips) && file.templateOverrideSkips.length > 0) {
        report.details.overrideSkips.push({ path: relativePath, skips: file.templateOverrideSkips });
      }
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        templateOverrides: file.templateOverrides || [],
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    const manuallyChangedManaged = Boolean(previousManaged?.sha256) && previousManaged.sha256 !== currentHash;
    const collision = !previousManaged?.sha256;

    if (manuallyChangedManaged) {
      const backupPath = backupProjectFile(rootDir, deploymentId, relativePath);
      report.summary.backupsCreated += 1;
      report.summary.conflictsResolved += 1;
      report.details.backups.push({ path: relativePath, backupPath });
      report.details.conflictsResolved.push({
        path: relativePath,
        kind: file.kind,
        backupPath,
        previousManagedHash: previousManaged.sha256,
        currentHash,
        newHash,
        templateOverrides: file.templateOverrides || [],
      });
      if (Array.isArray(file.templateOverrideSkips) && file.templateOverrideSkips.length > 0) {
        report.details.overrideSkips.push({ path: relativePath, skips: file.templateOverrideSkips });
      }

      fs.writeFileSync(absolutePath, file.content, "utf8");
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        templateOverrides: file.templateOverrides || [],
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    if (collision) {
      const backupPath = backupProjectFile(rootDir, deploymentId, relativePath);
      report.summary.backupsCreated += 1;
      report.summary.collisionsResolved += 1;
      report.details.backups.push({ path: relativePath, backupPath });
      report.details.collisionsResolved.push({
        path: relativePath,
        kind: file.kind,
        backupPath,
        currentHash,
        newHash,
        templateOverrides: file.templateOverrides || [],
      });
      if (Array.isArray(file.templateOverrideSkips) && file.templateOverrideSkips.length > 0) {
        report.details.overrideSkips.push({ path: relativePath, skips: file.templateOverrideSkips });
      }

      fs.writeFileSync(absolutePath, file.content, "utf8");
      filesIndex[relativePath] = {
        sha256: newHash,
        modelKey: file.modelKey,
        versionNumber: file.versionNumber,
        kind: file.kind,
        templateOverrides: file.templateOverrides || [],
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    fs.writeFileSync(absolutePath, file.content, "utf8");
    report.summary.updated += 1;
    report.details.updated.push({
      path: relativePath,
      kind: file.kind,
      currentHash,
      newHash,
      templateOverrides: file.templateOverrides || [],
    });
    if (Array.isArray(file.templateOverrideSkips) && file.templateOverrideSkips.length > 0) {
      report.details.overrideSkips.push({ path: relativePath, skips: file.templateOverrideSkips });
    }
    filesIndex[relativePath] = {
      sha256: newHash,
      modelKey: file.modelKey,
      versionNumber: file.versionNumber,
      kind: file.kind,
      templateOverrides: file.templateOverrides || [],
      updatedAt: new Date().toISOString(),
    };
  }

  if (removeMissing) {
    for (const relativePath of Object.keys(existingManagedEntries)) {
      if (targetPaths.has(relativePath)) {
        continue;
      }

      const absolutePath = resolveSafeAbsolutePath(rootDir, relativePath);
      const previousManaged = existingManagedEntries[relativePath];
      if (fs.existsSync(absolutePath)) {
        const currentHash = readFileHash(absolutePath);
        const manuallyChangedManaged = Boolean(previousManaged?.sha256) && previousManaged.sha256 !== currentHash;
        if (manuallyChangedManaged) {
          const backupPath = backupProjectFile(rootDir, deploymentId, relativePath);
          report.summary.backupsCreated += 1;
          report.summary.conflictsResolved += 1;
          report.details.backups.push({ path: relativePath, backupPath });
          report.details.conflictsResolved.push({
            path: relativePath,
            kind: previousManaged?.kind || "managed-generated-file",
            backupPath,
            previousManagedHash: previousManaged.sha256,
            currentHash,
            newHash: null,
            reason: "Removal of stale managed file",
          });
        }

        fs.rmSync(absolutePath, { force: true });
      }

      delete filesIndex[relativePath];
      report.summary.removed += 1;
      report.details.removed.push({
        path: relativePath,
        kind: previousManaged?.kind || "managed-generated-file",
      });
    }
  }

  writeManagedFileIndex(rootDir, managedIndex);
  return report;
}

function deployProcessModelVersion({ rootDir, workspaceConfig, modelKey, versionNumber }) {
  const normalizedModelKey = normalizeModelKey(modelKey);
  const normalizedVersion = normalizeVersionNumber(versionNumber);
  const allowDirectDeployment = Boolean(workspaceConfig?.backendOptions?.processModeling?.allowDirectDeployment);

  const model = loadProcessModel(rootDir, normalizedModelKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedModelKey}' was not found.`);
  }

  const versionIndex = model.versions.findIndex((entry) => entry.versionNumber === normalizedVersion);
  if (versionIndex < 0) {
    throw createCatalogError(
      404,
      `Version ${normalizedVersion} was not found for model '${normalizedModelKey}'.`,
    );
  }

  const targetVersion = model.versions[versionIndex];
  if (targetVersion.status === "RETIRED") {
    throw createCatalogError(
      409,
      `Version ${normalizedVersion} is retired and cannot be deployed.`,
    );
  }

  if (targetVersion.status !== "VALIDATED" && targetVersion.status !== "DEPLOYED" && !allowDirectDeployment) {
    throw createCatalogError(
      409,
      "Only VALIDATED versions can be deployed when direct deployment is disabled.",
    );
  }

  const now = new Date().toISOString();
  for (let index = 0; index < model.versions.length; index += 1) {
    const currentVersion = model.versions[index];
    if (currentVersion.status === "DEPLOYED" && currentVersion.versionNumber !== normalizedVersion) {
      model.versions[index] = {
        ...currentVersion,
        status: "RETIRED",
        retiredAt: now,
        updatedAt: now,
      };
    }
  }

  model.versions[versionIndex] = {
    ...targetVersion,
    status: "DEPLOYED",
    deployedAt: now,
    retiredAt: null,
    updatedAt: now,
  };
  model.updatedAt = now;

  const savedModel = saveProcessModel(rootDir, model);
  const savedVersion = savedModel.versions.find((entry) => entry.versionNumber === normalizedVersion);

  const templateOverrideRuntime = loadTemplateOverrideRuntime(rootDir);
  const automaticTaskCatalog = readAutomaticTaskCatalog(rootDir, { includeSources: true });
  const deployedRecords = listDeployedModels(rootDir)
    .map((entry) => ({ model: entry.model, version: entry.version }))
    .sort((left, right) => left.model.modelKey.localeCompare(right.model.modelKey));
  const deploymentPlan = buildManagedDeploymentPlan({
    rootDir,
    workspaceConfig,
    deployedRecords,
    templateOverrideRuntime,
    automaticTaskCatalog,
  });
  const deploymentBuild = deploymentPlan.buildByRecord.get(
    buildDeploymentRecordKey(savedModel.modelKey, savedVersion.versionNumber),
  ) || {
    runtimeContract: buildRuntimeContract({ model: savedModel, version: savedVersion }),
    dataContract: buildDataContract({
      model: savedModel,
      version: savedVersion,
      runtimeContract: buildRuntimeContract({ model: savedModel, version: savedVersion }),
    }),
    usedAutomaticTaskTypes: {
      usedKeys: [],
      usedTaskTypes: [],
      missingTaskTypes: [],
    },
  };
  const generatedFiles = deploymentPlan.files;

  const deploymentId = toDeploymentId();
  const report = applyManagedDeploymentWrite(rootDir, generatedFiles, deploymentId, {
    removeMissing: true,
  });

  const refreshedModel = loadProcessModel(rootDir, normalizedModelKey);
  const refreshedVersionIndex = refreshedModel.versions.findIndex(
    (entry) => entry.versionNumber === normalizedVersion,
  );
  refreshedModel.versions[refreshedVersionIndex] = {
    ...refreshedModel.versions[refreshedVersionIndex],
    deployment: {
      deploymentId,
      generatedAt: now,
      generatedFiles: generatedFiles.map((entry) => entry.relativePath),
      reportSummary: report.summary,
      runtimeSummary: deploymentBuild.runtimeContract.summary,
      dataSummary: deploymentBuild.dataContract.summary,
      startableByRoles: deploymentBuild.runtimeContract.start.startableByRoles,
      monitorRoles: deploymentBuild.runtimeContract.monitors.monitorRoles,
      sharedDataEntities: (deploymentBuild.dataContract.sharedData?.entities || []).map((entry) => entry.entityKey),
      automaticTaskTypesUsed: (deploymentBuild.usedAutomaticTaskTypes?.usedKeys || []),
    },
  };
  refreshedModel.updatedAt = new Date().toISOString();

  const finalModel = saveProcessModel(rootDir, refreshedModel);
  const finalVersion = finalModel.versions.find((entry) => entry.versionNumber === normalizedVersion);

  return {
    model: toPublicModel(finalModel),
    version: toPublicVersion(finalVersion, { includeBpmn: true }),
    deployment: {
      deploymentId,
      generatedFiles: generatedFiles.map((entry) => entry.relativePath),
      runtimeSummary: deploymentBuild.runtimeContract.summary,
      dataSummary: deploymentBuild.dataContract.summary,
      startableByRoles: deploymentBuild.runtimeContract.start.startableByRoles,
      monitorRoles: deploymentBuild.runtimeContract.monitors.monitorRoles,
      sharedDataEntities: (deploymentBuild.dataContract.sharedData?.entities || []).map((entry) => entry.entityKey),
      automaticTaskTypesUsed: (deploymentBuild.usedAutomaticTaskTypes?.usedKeys || []),
      report,
    },
  };
}

function undeployProcessModelVersion({ rootDir, workspaceConfig, modelKey, versionNumber }) {
  const normalizedModelKey = normalizeModelKey(modelKey);
  const normalizedVersion = normalizeVersionNumber(versionNumber);

  const model = loadProcessModel(rootDir, normalizedModelKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedModelKey}' was not found.`);
  }

  const versionIndex = model.versions.findIndex((entry) => entry.versionNumber === normalizedVersion);
  if (versionIndex < 0) {
    throw createCatalogError(
      404,
      `Version ${normalizedVersion} was not found for model '${normalizedModelKey}'.`,
    );
  }

  const targetVersion = model.versions[versionIndex];
  if (targetVersion.status !== "DEPLOYED") {
    throw createCatalogError(
      409,
      `Version ${normalizedVersion} is not deployed and cannot be undeployed.`,
    );
  }

  const now = new Date().toISOString();
  model.versions[versionIndex] = {
    ...targetVersion,
    status: "RETIRED",
    retiredAt: now,
    updatedAt: now,
    deployment: null,
  };
  model.updatedAt = now;
  const savedModel = saveProcessModel(rootDir, model);

  const deployedRecords = listDeployedModels(rootDir)
    .map((entry) => ({ model: entry.model, version: entry.version }))
    .sort((left, right) => left.model.modelKey.localeCompare(right.model.modelKey));
  const templateOverrideRuntime = loadTemplateOverrideRuntime(rootDir);
  const automaticTaskCatalog = readAutomaticTaskCatalog(rootDir, { includeSources: true });
  const deploymentPlan = buildManagedDeploymentPlan({
    rootDir,
    workspaceConfig,
    deployedRecords,
    templateOverrideRuntime,
    automaticTaskCatalog,
  });
  const generatedFiles = deploymentPlan.files;

  const deploymentId = `process-undeploy-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const report = applyManagedDeploymentWrite(rootDir, generatedFiles, deploymentId, {
    removeMissing: true,
  });

  const refreshedModel = loadProcessModel(rootDir, normalizedModelKey);
  const refreshedVersion = refreshedModel.versions.find((entry) => entry.versionNumber === normalizedVersion);

  return {
    model: toPublicModel(refreshedModel),
    version: toPublicVersion(refreshedVersion, { includeBpmn: true }),
    undeployment: {
      deploymentId,
      generatedFiles: generatedFiles.map((entry) => entry.relativePath),
      report,
    },
  };
}

module.exports = {
  deployProcessModelVersion,
  undeployProcessModelVersion,
};
