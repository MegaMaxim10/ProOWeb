import { setFeedback } from "../shared/feedback.js";
import { loadBpmnModelerConstructor, loadMonacoEditor } from "../shared/ide-libs.js";

const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  targetNamespace="http://prooweb/generated">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

const DEFAULT_SPECIFICATION = Object.freeze({
  schemaVersion: 1,
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
  activities: {},
});

const TASK_TYPES = new Set([
  "task",
  "userTask",
  "serviceTask",
  "scriptTask",
  "manualTask",
  "businessRuleTask",
  "receiveTask",
  "sendTask",
  "callActivity",
  "subProcess",
]);

const AUTOMATIC_TASK_TYPES = new Set([
  "serviceTask",
  "scriptTask",
  "businessRuleTask",
  "receiveTask",
  "sendTask",
  "callActivity",
]);

const INPUT_SOURCE_TYPES = [
  "PREVIOUS_ACTIVITY",
  "PROCESS_CONTEXT",
  "SHARED_DATA",
  "BACKEND_SERVICE",
  "EXTERNAL_SERVICE",
];

const ASSIGNMENT_STRATEGIES = [
  "ROLE_QUEUE",
  "SUPERVISOR_ONLY",
  "SUPERVISOR_THEN_ANCESTORS",
  "UNIT_MEMBERS",
  "SINGLE_MATCH_ONLY",
  "MANUAL_ONLY",
  "ROUND_ROBIN",
];

const ASSIGNMENT_MODES = ["AUTOMATIC", "MANUAL"];
const ACTIVITY_TYPES = ["MANUAL", "AUTOMATIC"];
const OUTPUT_STORAGE_VALUES = ["INSTANCE", "SHARED", "BOTH"];
const TRIGGER_MODES = ["MANUAL_TRIGGER", "IMMEDIATE", "DEFERRED"];
const DEFAULT_AUTOMATIC_TASK_TYPE_KEY = "core.echo";
const SHARED_ENTITY_FIELD_TYPES = [
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
];
const SHARED_ENTITY_RELATION_TYPES = [
  "MANY_TO_ONE",
  "ONE_TO_MANY",
  "ONE_TO_ONE",
  "MANY_TO_MANY",
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toLineColumn(xml, index) {
  if (!Number.isFinite(index) || index < 0) {
    return { line: 1, column: 1 };
  }

  let line = 1;
  let column = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (xml[cursor] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function extractXmlErrorLocation(message) {
  const text = String(message || "");
  const lineColumnMatch = text.match(/line\s+(\d+)[^\d]+column\s+(\d+)/i);
  if (lineColumnMatch) {
    return {
      line: Number.parseInt(lineColumnMatch[1], 10),
      column: Number.parseInt(lineColumnMatch[2], 10),
    };
  }

  const lineMatch = text.match(/line\s+(\d+)/i);
  if (lineMatch) {
    return {
      line: Number.parseInt(lineMatch[1], 10),
      column: 1,
    };
  }

  return {
    line: 1,
    column: 1,
  };
}

function detectXmlSyntaxErrors(xml) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(xml || ""), "application/xml");
  const parserErrors = parsed.getElementsByTagName("parsererror");

  if (!parserErrors || parserErrors.length === 0) {
    return [];
  }

  const message = parserErrors[0].textContent || "Invalid XML document.";
  const location = extractXmlErrorLocation(message);

  return [{
    severity: "error",
    message: message.trim(),
    startLineNumber: Math.max(location.line, 1),
    startColumn: Math.max(location.column, 1),
    endLineNumber: Math.max(location.line, 1),
    endColumn: Math.max(location.column + 1, 2),
  }];
}

function localName(element) {
  return String(element?.localName || "").trim();
}

function markerAtAttribute(xml, attrName, attrValue, message, severity = "warning") {
  const token = `${attrName}="${String(attrValue || "").replace(/"/g, '\\"')}"`;
  const index = xml.indexOf(token);
  const { line, column } = toLineColumn(xml, index);

  return {
    severity,
    message,
    startLineNumber: line,
    startColumn: column,
    endLineNumber: line,
    endColumn: column + Math.max(token.length, 1),
  };
}

function markerAtToken(xml, token, message, severity = "warning") {
  const index = xml.indexOf(String(token || ""));
  const { line, column } = toLineColumn(xml, index);

  return {
    severity,
    message,
    startLineNumber: line,
    startColumn: column,
    endLineNumber: line,
    endColumn: column + Math.max(String(token || "").length, 1),
  };
}

function descendantsByLocalName(parent, name) {
  return Array.from(parent.getElementsByTagName("*"))
    .filter((entry) => localName(entry) === name);
}

function buildBpmnSemanticMarkers(xml) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(xml || ""), "application/xml");
  const allElements = Array.from(parsed.getElementsByTagName("*"));
  const markers = [];
  const idMap = new Map();
  const duplicateIds = new Set();
  const outgoingCountById = new Map();
  const incomingCountById = new Map();

  for (const element of allElements) {
    const id = element.getAttribute("id");
    if (!id) {
      continue;
    }

    if (idMap.has(id)) {
      duplicateIds.add(id);
    } else {
      idMap.set(id, element);
    }
  }

  for (const duplicateId of duplicateIds) {
    markers.push(markerAtAttribute(
      xml,
      "id",
      duplicateId,
      `Duplicate BPMN id detected: ${duplicateId}.`,
      "error",
    ));
  }

  const processElements = allElements.filter((entry) => localName(entry) === "process");
  if (processElements.length === 0) {
    markers.push(markerAtToken(xml, "<bpmn:definitions", "No BPMN process found in the XML.", "error"));
  }

  for (const processElement of processElements) {
    const processId = processElement.getAttribute("id") || "process";
    const starts = descendantsByLocalName(processElement, "startEvent");
    const ends = descendantsByLocalName(processElement, "endEvent");
    if (starts.length === 0) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        processId,
        `Process '${processId}' has no startEvent.`,
        "warning",
      ));
    }
    if (ends.length === 0) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        processId,
        `Process '${processId}' has no endEvent.`,
        "warning",
      ));
    }
  }

  const sequenceFlows = allElements.filter((entry) => localName(entry) === "sequenceFlow");
  for (const flow of sequenceFlows) {
    const flowId = flow.getAttribute("id") || "sequenceFlow";
    const sourceRef = flow.getAttribute("sourceRef");
    const targetRef = flow.getAttribute("targetRef");

    if (!sourceRef) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        flowId,
        `sequenceFlow '${flowId}' has no sourceRef.`,
        "error",
      ));
      continue;
    }
    if (!targetRef) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        flowId,
        `sequenceFlow '${flowId}' has no targetRef.`,
        "error",
      ));
      continue;
    }
    if (!idMap.has(sourceRef)) {
      markers.push(markerAtAttribute(
        xml,
        "sourceRef",
        sourceRef,
        `sequenceFlow '${flowId}' sourceRef '${sourceRef}' does not reference a BPMN element.`,
        "error",
      ));
    }
    if (!idMap.has(targetRef)) {
      markers.push(markerAtAttribute(
        xml,
        "targetRef",
        targetRef,
        `sequenceFlow '${flowId}' targetRef '${targetRef}' does not reference a BPMN element.`,
        "error",
      ));
    }
    if (sourceRef === targetRef) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        flowId,
        `sequenceFlow '${flowId}' references the same source and target ('${sourceRef}').`,
        "warning",
      ));
    }

    outgoingCountById.set(sourceRef, (outgoingCountById.get(sourceRef) || 0) + 1);
    incomingCountById.set(targetRef, (incomingCountById.get(targetRef) || 0) + 1);
  }

  for (const element of allElements) {
    const elementName = localName(element);
    const elementId = element.getAttribute("id");
    if (!elementId) {
      continue;
    }

    const incoming = incomingCountById.get(elementId) || 0;
    const outgoing = outgoingCountById.get(elementId) || 0;

    if (TASK_TYPES.has(elementName)) {
      if (incoming === 0) {
        markers.push(markerAtAttribute(
          xml,
          "id",
          elementId,
          `Task '${elementId}' has no incoming sequenceFlow.`,
        ));
      }
      if (outgoing === 0) {
        markers.push(markerAtAttribute(
          xml,
          "id",
          elementId,
          `Task '${elementId}' has no outgoing sequenceFlow.`,
        ));
      }
    }

    if (elementName.endsWith("Gateway")) {
      if (incoming + outgoing < 2) {
        markers.push(markerAtAttribute(
          xml,
          "id",
          elementId,
          `Gateway '${elementId}' should participate in at least two sequence flows.`,
        ));
      }
      if (incoming > 0 && outgoing === 0) {
        markers.push(markerAtAttribute(
          xml,
          "id",
          elementId,
          `Gateway '${elementId}' has no outgoing sequenceFlow.`,
        ));
      }
    }

    if (elementName === "startEvent" && incoming > 0) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        elementId,
        `startEvent '${elementId}' should not have incoming sequenceFlow.`,
      ));
    }
    if (elementName === "endEvent" && outgoing > 0) {
      markers.push(markerAtAttribute(
        xml,
        "id",
        elementId,
        `endEvent '${elementId}' should not have outgoing sequenceFlow.`,
      ));
    }
  }

  return markers;
}

function normalizeRoleCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseRoleList(value) {
  const rows = String(value || "")
    .split(/[,\n]/)
    .map((entry) => normalizeRoleCode(entry))
    .filter((entry) => Boolean(entry));
  return Array.from(new Set(rows));
}

function stringifyRoleList(values = []) {
  return Array.isArray(values) ? values.join(", ") : "";
}

function normalizeBpmnType(bpmnType) {
  const raw = String(bpmnType || "");
  const normalized = raw.includes(":") ? raw.split(":")[1] : raw;
  if (!normalized) {
    return "";
  }
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function parseMappings(multiline) {
  const rows = String(multiline || "").split("\n");
  const mappings = [];
  for (const row of rows) {
    const line = row.trim();
    if (!line) {
      continue;
    }

    const arrowIndex = line.indexOf("->");
    if (arrowIndex < 0) {
      continue;
    }
    const from = line.slice(0, arrowIndex).trim();
    const to = line.slice(arrowIndex + 2).trim();
    if (from && to) {
      mappings.push({ from, to });
    }
  }
  return mappings;
}

function stringifyMappings(mappings = []) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return "";
  }

  return mappings
    .map((entry) => `${String(entry?.from || "").trim()} -> ${String(entry?.to || "").trim()}`)
    .filter((entry) => entry !== " -> ")
    .join("\n");
}

function parseInputSources(multiline) {
  const rows = String(multiline || "").split("\n");
  const sources = [];
  for (const row of rows) {
    const line = row.trim();
    if (!line) {
      continue;
    }

    const parts = line.split("|").map((entry) => entry.trim());
    const sourceType = String(parts[0] || "").toUpperCase();
    if (!INPUT_SOURCE_TYPES.includes(sourceType)) {
      continue;
    }

    const sourceRef = String(parts[1] || "");
    const mappingsText = String(parts[2] || "");
    const mappingRows = mappingsText
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => Boolean(entry));
    const mappings = [];
    for (const mappingRow of mappingRows) {
      const arrowIndex = mappingRow.indexOf("->");
      if (arrowIndex < 0) {
        continue;
      }
      const from = mappingRow.slice(0, arrowIndex).trim();
      const to = mappingRow.slice(arrowIndex + 2).trim();
      if (from && to) {
        mappings.push({ from, to });
      }
    }

    sources.push({
      sourceType,
      sourceRef,
      mappings,
    });
  }

  return sources;
}

function stringifyInputSources(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return "";
  }
  return sources.map((entry) => {
    const sourceType = String(entry?.sourceType || "PROCESS_CONTEXT").toUpperCase();
    const sourceRef = String(entry?.sourceRef || "");
    const mappings = Array.isArray(entry?.mappings)
      ? entry.mappings
        .map((mapping) => `${String(mapping?.from || "").trim()}->${String(mapping?.to || "").trim()}`)
        .filter((row) => row !== "->")
        .join(", ")
      : "";
    return `${sourceType}|${sourceRef}|${mappings}`;
  }).join("\n");
}

function normalizeEntityKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeSharedFieldName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_");
}

function toDefaultSharedTableName(entityKey) {
  const normalized = String(entityKey || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = normalized || "entity";
  return (`shared_${safe}`).slice(0, 63).replace(/_+$/g, "");
}

function parseSharedEntityFields(multiline) {
  const rows = String(multiline || "").split("\n");
  const fields = [];
  const seen = new Set();

  for (const row of rows) {
    const line = row.trim();
    if (!line) {
      continue;
    }

    const parts = line.split("|").map((entry) => entry.trim());
    const rawName = String(parts[0] || "");
    const name = normalizeSharedFieldName(rawName);
    if (!name || seen.has(name)) {
      continue;
    }

    const rawType = String(parts[1] || "STRING").toUpperCase();
    const type = SHARED_ENTITY_FIELD_TYPES.includes(rawType) ? rawType : "STRING";
    const required = ["true", "1", "yes", "on"].includes(String(parts[2] || "").toLowerCase());
    const indexed = ["true", "1", "yes", "on"].includes(String(parts[3] || "").toLowerCase());
    const unique = ["true", "1", "yes", "on"].includes(String(parts[4] || "").toLowerCase());

    seen.add(name);
    fields.push({
      name,
      type,
      required,
      indexed,
      unique,
    });
  }

  return fields;
}

function parseSharedEntityRelations(multiline) {
  const rows = String(multiline || "").split("\n");
  const relations = [];
  const seen = new Set();

  for (const row of rows) {
    const line = row.trim();
    if (!line) {
      continue;
    }

    const parts = line.split("|").map((entry) => entry.trim());
    const rawName = String(parts[0] || "");
    const name = normalizeSharedFieldName(rawName);
    if (!name || seen.has(name)) {
      continue;
    }

    const rawType = String(parts[1] || "MANY_TO_ONE").toUpperCase();
    const type = SHARED_ENTITY_RELATION_TYPES.includes(rawType) ? rawType : "MANY_TO_ONE";
    const targetEntityKey = normalizeEntityKey(parts[2] || "");
    if (!targetEntityKey) {
      continue;
    }

    const mappedBy = normalizeSharedFieldName(parts[3] || "");
    const joinColumn = String(parts[4] || "").trim().toLowerCase();
    const joinTable = String(parts[5] || "").trim().toLowerCase();
    const inverseJoinColumn = String(parts[6] || "").trim().toLowerCase();
    const required = ["true", "1", "yes", "on"].includes(String(parts[7] || "").toLowerCase());

    seen.add(name);
    relations.push({
      name,
      type,
      targetEntityKey,
      mappedBy,
      joinColumn,
      joinTable,
      inverseJoinColumn,
      required,
    });
  }

  return relations;
}

function stringifySharedEntityFields(fields = []) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return "";
  }

  return fields
    .map((field) => [
      String(field?.name || "").trim(),
      String(field?.type || "STRING").toUpperCase(),
      field?.required ? "true" : "false",
      field?.indexed ? "true" : "false",
      field?.unique ? "true" : "false",
    ].join("|"))
    .filter((line) => !line.startsWith("|"))
    .join("\n");
}

function stringifySharedEntityRelations(relations = []) {
  if (!Array.isArray(relations) || relations.length === 0) {
    return "";
  }

  return relations
    .map((relation) => [
      String(relation?.name || "").trim(),
      String(relation?.type || "MANY_TO_ONE").toUpperCase(),
      normalizeEntityKey(relation?.targetEntityKey || ""),
      String(relation?.mappedBy || "").trim(),
      String(relation?.joinColumn || "").trim().toLowerCase(),
      String(relation?.joinTable || "").trim().toLowerCase(),
      String(relation?.inverseJoinColumn || "").trim().toLowerCase(),
      relation?.required ? "true" : "false",
    ].join("|"))
    .filter((line) => !line.startsWith("|"))
    .join("\n");
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

function buildDefaultActivitySpecification(activityId, elementType) {
  const normalizedType = normalizeBpmnType(elementType);
  const automatic = AUTOMATIC_TASK_TYPES.has(normalizedType);
  return {
    activityType: automatic ? "AUTOMATIC" : "MANUAL",
    candidateRoles: ["PROCESS_USER"],
    assignment: {
      mode: "AUTOMATIC",
      strategy: automatic ? "SINGLE_MATCH_ONLY" : "ROLE_QUEUE",
      allowPreviouslyAssignedAssignee: true,
      manualAssignerRoles: ["PROCESS_MONITOR", "ADMINISTRATOR"],
      maxAssignees: 1,
    },
    automaticExecution: automatic
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

function fillSelectOptions(documentRef, selectElement, options, selectedValue = "") {
  if (!selectElement) {
    return;
  }

  const previousValue = selectedValue || selectElement.value || "";
  selectElement.innerHTML = "";

  if (!Array.isArray(options) || options.length === 0) {
    const emptyOption = documentRef.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-";
    selectElement.appendChild(emptyOption);
    selectElement.value = "";
    return;
  }

  for (const optionData of options) {
    const optionElement = documentRef.createElement("option");
    optionElement.value = String(optionData.value);
    optionElement.textContent = String(optionData.label);
    selectElement.appendChild(optionElement);
  }

  const available = new Set(options.map((entry) => String(entry.value)));
  selectElement.value = available.has(String(previousValue))
    ? String(previousValue)
    : String(options[0].value);
}

function createDisabledStudio(feedbackElement, reason) {
  if (feedbackElement) {
    setFeedback(feedbackElement, `BPMN studio unavailable: ${reason}`, "error");
  }

  return {
    ready: false,
    async getXml() {
      return "";
    },
    async setXml() {
      return null;
    },
    applyXmlToTextarea() {
      return false;
    },
    setCatalog() {
      return null;
    },
    setAutomaticTaskTypes() {
      return null;
    },
  };
}

function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function findBpmnActivityMap(xml) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(xml || ""), "application/xml");
  const map = new Map();
  const entries = parsed.getElementsByTagName("*");
  for (const element of entries) {
    const id = String(element.getAttribute("id") || "");
    const name = localName(element);
    if (!id || !TASK_TYPES.has(name)) {
      continue;
    }
    map.set(id, {
      activityId: id,
      elementType: name,
    });
  }

  return map;
}

function toJsonSafeText(value, fallback = "{}") {
  try {
    return `${JSON.stringify(value, null, 2)}\n`;
  } catch (_) {
    return fallback;
  }
}

export async function initializeBpmnStudio({ documentRef = document, api = {} } = {}) {
  const canvasElement = documentRef.getElementById("process-bpmn-canvas");
  const editorElement = documentRef.getElementById("process-bpmn-editor");
  const editorShell = documentRef.getElementById("process-bpmn-editor-shell");
  const specEditorShell = documentRef.getElementById("process-spec-editor-shell");
  const specEditorElement = documentRef.getElementById("process-spec-editor");
  const feedbackElement = documentRef.getElementById("process-bpmn-feedback");
  const newButton = documentRef.getElementById("process-bpmn-new");
  const importButton = documentRef.getElementById("process-bpmn-import-trigger");
  const exportButton = documentRef.getElementById("process-bpmn-export");
  const validateButton = documentRef.getElementById("process-bpmn-validate");
  const fillCreateButton = documentRef.getElementById("process-bpmn-fill-create");
  const fillVersionButton = documentRef.getElementById("process-bpmn-fill-version");
  const loadModelSelector = documentRef.getElementById("process-bpmn-load-model");
  const loadVersionSelector = documentRef.getElementById("process-bpmn-load-version");
  const loadVersionButton = documentRef.getElementById("process-bpmn-load-version-button");
  const saveSnapshotButton = documentRef.getElementById("process-bpmn-save-snapshot");
  const undoButton = documentRef.getElementById("process-bpmn-undo");
  const redoButton = documentRef.getElementById("process-bpmn-redo");
  const importFileInput = documentRef.getElementById("process-bpmn-import-file");
  const toggleXmlButton = documentRef.getElementById("process-bpmn-toggle-xml");
  const toggleSpecJsonButton = documentRef.getElementById("process-bpmn-toggle-spec-json");
  const saveSpecButton = documentRef.getElementById("process-bpmn-save-spec");
  const validateSpecButton = documentRef.getElementById("process-bpmn-validate-spec");

  const selectionLine = documentRef.getElementById("process-selected-activity-line");
  const activityForm = documentRef.getElementById("process-activity-config-form");
  const activityIdInput = documentRef.getElementById("process-activity-id");
  const activityKindInput = documentRef.getElementById("process-activity-kind");
  const activityTypeSelect = documentRef.getElementById("process-activity-type");
  const candidateRolesInput = documentRef.getElementById("process-candidate-roles");
  const assignmentModeSelect = documentRef.getElementById("process-assignment-mode");
  const assignmentStrategySelect = documentRef.getElementById("process-assignment-strategy");
  const allowPrevAssignedCheckbox = documentRef.getElementById("process-allow-prev-assigned");
  const manualAssignerRolesInput = documentRef.getElementById("process-manual-assigner-roles");
  const maxAssigneesInput = documentRef.getElementById("process-max-assignees");
  const automaticSection = documentRef.getElementById("process-automatic-config");
  const automaticTaskTypeSelect = documentRef.getElementById("process-automatic-task-type");
  const automaticHandlerRefInput = documentRef.getElementById("process-automatic-handler-ref");
  const automaticTriggerModeSelect = documentRef.getElementById("process-automatic-trigger-mode");
  const automaticDelayInput = documentRef.getElementById("process-automatic-delay-minutes");
  const automaticConfigurationTextarea = documentRef.getElementById("process-automatic-config-json");
  const inputSourcesTextarea = documentRef.getElementById("process-input-sources");
  const outputStorageSelect = documentRef.getElementById("process-output-storage");
  const outputMappingsTextarea = documentRef.getElementById("process-output-mappings");
  const activityViewerRolesInput = documentRef.getElementById("process-activity-viewer-roles");
  const dataViewerRolesInput = documentRef.getElementById("process-data-viewer-roles");
  const applyConfigButton = documentRef.getElementById("process-activity-apply");
  const reloadConfigButton = documentRef.getElementById("process-activity-reload");
  const activityFeedbackElement = documentRef.getElementById("process-activity-feedback");
  const sharedEntitySelect = documentRef.getElementById("process-shared-entity-select");
  const sharedEntityKeyInput = documentRef.getElementById("process-shared-entity-key");
  const sharedEntityDisplayInput = documentRef.getElementById("process-shared-entity-display");
  const sharedEntityTableInput = documentRef.getElementById("process-shared-entity-table");
  const sharedEntityFieldsTextarea = documentRef.getElementById("process-shared-entity-fields");
  const sharedEntityRelationsTextarea = documentRef.getElementById("process-shared-entity-relations");
  const sharedEntityNewButton = documentRef.getElementById("process-shared-entity-new");
  const sharedEntityApplyButton = documentRef.getElementById("process-shared-entity-apply");
  const sharedEntityRemoveButton = documentRef.getElementById("process-shared-entity-remove");
  const sharedEntityFeedbackElement = documentRef.getElementById("process-shared-entity-feedback");

  if (!canvasElement || !editorElement || !feedbackElement) {
    return createDisabledStudio(feedbackElement, "BPMN studio containers not found in DOM.");
  }

  let BpmnJS;
  let monaco;

  try {
    // Load BPMN modeler first to avoid AMD/UMD conflicts when Monaco loader is present.
    BpmnJS = await loadBpmnModelerConstructor();
    monaco = await loadMonacoEditor();
  } catch (error) {
    return createDisabledStudio(feedbackElement, error.message || "External libraries could not be loaded.");
  }

  const modeler = new BpmnJS({
    container: canvasElement,
    keyboard: {
      bindTo: documentRef,
    },
  });
  const canvasApi = modeler.get("canvas");

  const monacoTheme = documentRef.documentElement?.dataset?.theme === "dark" ? "vs-dark" : "vs";
  const editor = monaco.editor.create(editorElement, {
    value: DEFAULT_BPMN_XML,
    language: "xml",
    theme: monacoTheme,
    automaticLayout: true,
    minimap: {
      enabled: false,
    },
    lineNumbers: "on",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });

  const specificationEditor = specEditorElement
    ? monaco.editor.create(specEditorElement, {
        value: toJsonSafeText(DEFAULT_SPECIFICATION),
        language: "json",
        theme: monacoTheme,
        automaticLayout: true,
        minimap: {
          enabled: false,
        },
        lineNumbers: "on",
        tabSize: 2,
        insertSpaces: true,
        wordWrap: "on",
      })
    : null;

  let currentXml = DEFAULT_BPMN_XML;
  let syncingFromModeler = false;
  let syncingFromEditor = false;
  let editorToModelerTimer = null;
  let modelerToEditorTimer = null;
  let catalogModels = [];
  let automaticTaskTypes = [];
  let selectedActivityId = "";
  let selectedElementType = "";
  let selectedSharedEntityKey = "";
  let selectedModelKey = "";
  let selectedVersionNumber = "";
  let currentSpecification = deepClone(DEFAULT_SPECIFICATION);
  let syncingSpecificationEditor = false;
  let resizeTimer = null;

  function setActivityFeedback(message, tone) {
    if (!activityFeedbackElement) {
      return;
    }
    setFeedback(activityFeedbackElement, message, tone);
  }

  function setSharedEntityFeedback(message, tone) {
    if (!sharedEntityFeedbackElement) {
      return;
    }
    setFeedback(sharedEntityFeedbackElement, message, tone);
  }

  function setCatalog(models = []) {
    catalogModels = Array.isArray(models) ? models.slice() : [];
    const modelOptions = catalogModels
      .slice()
      .sort((left, right) => String(left.modelKey || "").localeCompare(String(right.modelKey || "")))
      .map((model) => ({
        value: model.modelKey,
        label: `${model.modelKey} - ${model.title}`,
      }));

    fillSelectOptions(documentRef, loadModelSelector, modelOptions, loadModelSelector?.value);
    refreshVersionSelector();
  }

  function setAutomaticTaskTypes(taskTypes = []) {
    automaticTaskTypes = Array.isArray(taskTypes) ? taskTypes.slice() : [];
    if (!automaticTaskTypeSelect) {
      return;
    }

    const options = automaticTaskTypes
      .filter((entry) => entry?.enabled !== false)
      .sort((left, right) => String(left.taskTypeKey || "").localeCompare(String(right.taskTypeKey || "")))
      .map((entry) => ({
        value: entry.taskTypeKey,
        label: `${entry.taskTypeKey} (${entry.kind || "BUILTIN"})`,
      }));

    if (options.length === 0) {
      options.push({
        value: DEFAULT_AUTOMATIC_TASK_TYPE_KEY,
        label: DEFAULT_AUTOMATIC_TASK_TYPE_KEY,
      });
    }
    fillSelectOptions(documentRef, automaticTaskTypeSelect, options, automaticTaskTypeSelect.value);
  }

  function refreshVersionSelector() {
    if (!loadVersionSelector) {
      return;
    }

    const modelKey = String(loadModelSelector?.value || "");
    const model = catalogModels.find((entry) => entry.modelKey === modelKey) || null;
    const versionOptions = Array.isArray(model?.versions)
      ? model.versions
        .slice()
        .sort((left, right) => Number(left.versionNumber || 0) - Number(right.versionNumber || 0))
        .map((version) => ({
          value: String(version.versionNumber),
          label: `v${version.versionNumber} (${version.status})`,
        }))
      : [];
    fillSelectOptions(documentRef, loadVersionSelector, versionOptions, loadVersionSelector.value);
  }

  function setEditorMarkers(markers = []) {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const converted = markers.map((entry) => ({
      severity: entry.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: entry.message || "Validation issue",
      startLineNumber: entry.startLineNumber || 1,
      startColumn: entry.startColumn || 1,
      endLineNumber: entry.endLineNumber || 1,
      endColumn: entry.endColumn || 2,
    }));

    monaco.editor.setModelMarkers(model, "bpmn-xml", converted);
  }

  function validateXmlAndLint(xml, options = {}) {
    const syntaxMarkers = detectXmlSyntaxErrors(xml);
    const semanticMarkers = syntaxMarkers.length > 0 ? [] : buildBpmnSemanticMarkers(xml);
    const allMarkers = [...syntaxMarkers, ...semanticMarkers];
    setEditorMarkers(allMarkers);

    const errorCount = allMarkers.filter((entry) => entry.severity === "error").length;
    const warningCount = allMarkers.filter((entry) => entry.severity !== "error").length;
    const valid = errorCount === 0;

    if (options.withFeedback !== false) {
      if (errorCount > 0) {
        setFeedback(feedbackElement, `BPMN validation failed: ${errorCount} error(s), ${warningCount} warning(s).`, "error");
      } else if (warningCount > 0) {
        setFeedback(feedbackElement, `BPMN validation passed with ${warningCount} warning(s).`);
      } else {
        setFeedback(feedbackElement, "BPMN validation passed (0 errors, 0 warnings).", "success");
      }
    }

    return {
      valid,
      errorCount,
      warningCount,
      markers: allMarkers,
    };
  }

  function updateSpecificationEditor() {
    if (!specificationEditor) {
      refreshSharedEntitySelector();
      return;
    }
    syncingSpecificationEditor = true;
    specificationEditor.setValue(toJsonSafeText(currentSpecification));
    syncingSpecificationEditor = false;
    refreshSharedEntitySelector();
  }

  function normalizeSpecificationShape(input) {
    const source = input && typeof input === "object" && !Array.isArray(input)
      ? input
      : {};

    const merged = {
      ...deepClone(DEFAULT_SPECIFICATION),
      ...deepClone(source),
    };
    merged.schemaVersion = 1;
    merged.start = merged.start && typeof merged.start === "object" && !Array.isArray(merged.start)
      ? merged.start
      : deepClone(DEFAULT_SPECIFICATION.start);
    merged.monitors = merged.monitors && typeof merged.monitors === "object" && !Array.isArray(merged.monitors)
      ? merged.monitors
      : deepClone(DEFAULT_SPECIFICATION.monitors);
    merged.sharedData = merged.sharedData && typeof merged.sharedData === "object" && !Array.isArray(merged.sharedData)
      ? merged.sharedData
      : deepClone(DEFAULT_SPECIFICATION.sharedData);
    merged.sharedData.entities = Array.isArray(merged.sharedData.entities)
      ? merged.sharedData.entities
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return null;
          }
          const entityKey = normalizeEntityKey(entry.entityKey || entry.key || entry.name);
          if (!entityKey) {
            return null;
          }
          const fields = Array.isArray(entry.fields)
            ? entry.fields
              .map((field) => {
                if (!field || typeof field !== "object" || Array.isArray(field)) {
                  return null;
                }
                const name = normalizeSharedFieldName(field.name);
                if (!name) {
                  return null;
                }
                const rawType = String(field.type || "STRING").toUpperCase();
                const type = SHARED_ENTITY_FIELD_TYPES.includes(rawType) ? rawType : "STRING";
                return {
                  name,
                  type,
                  required: Boolean(field.required),
                  indexed: Boolean(field.indexed),
                  unique: Boolean(field.unique),
                };
              })
              .filter(Boolean)
            : [];
          const relations = Array.isArray(entry.relations)
            ? entry.relations
              .map((relation) => {
                if (!relation || typeof relation !== "object" || Array.isArray(relation)) {
                  return null;
                }
                const relationName = normalizeSharedFieldName(relation.name || relation.relationName);
                const targetEntityKey = normalizeEntityKey(
                  relation.targetEntityKey || relation.targetEntity || relation.target,
                );
                if (!relationName || !targetEntityKey) {
                  return null;
                }
                const rawType = String(relation.type || "MANY_TO_ONE").toUpperCase();
                return {
                  name: relationName,
                  type: SHARED_ENTITY_RELATION_TYPES.includes(rawType) ? rawType : "MANY_TO_ONE",
                  targetEntityKey,
                  mappedBy: normalizeSharedFieldName(relation.mappedBy || ""),
                  joinColumn: String(relation.joinColumn || "").trim().toLowerCase(),
                  joinTable: String(relation.joinTable || "").trim().toLowerCase(),
                  inverseJoinColumn: String(relation.inverseJoinColumn || relation.targetJoinColumn || "").trim().toLowerCase(),
                  required: Boolean(relation.required),
                };
              })
              .filter(Boolean)
            : [];
          const deduplicatedRelations = [];
          const seenRelationNames = new Set();
          for (const relation of relations) {
            const relationName = normalizeSharedFieldName(relation?.name || "");
            if (!relationName || seenRelationNames.has(relationName)) {
              continue;
            }
            seenRelationNames.add(relationName);
            deduplicatedRelations.push({
              ...relation,
              name: relationName,
            });
          }
          return {
            entityKey,
            displayName: String(entry.displayName || entry.title || entityKey).trim() || entityKey,
            tableName: String(entry.tableName || toDefaultSharedTableName(entityKey)).trim() || toDefaultSharedTableName(entityKey),
            fields: fields.length > 0
              ? fields
              : [{
                  name: "value",
                  type: "JSON",
                  required: false,
                  indexed: false,
                  unique: false,
                }],
            relations: deduplicatedRelations,
          };
        })
        .filter(Boolean)
      : [];
    const deduplicatedEntities = [];
    const seenSharedEntityKeys = new Set();
    for (const entity of merged.sharedData.entities) {
      const entityKey = normalizeEntityKey(entity.entityKey);
      if (!entityKey || seenSharedEntityKeys.has(entityKey)) {
        continue;
      }
      seenSharedEntityKeys.add(entityKey);
      deduplicatedEntities.push({
        ...entity,
        entityKey,
      });
    }
    merged.sharedData.entities = deduplicatedEntities;
    merged.activities = merged.activities && typeof merged.activities === "object" && !Array.isArray(merged.activities)
      ? merged.activities
      : {};

    return merged;
  }

  function ensureSharedDataContainer() {
    if (!currentSpecification.sharedData || typeof currentSpecification.sharedData !== "object" || Array.isArray(currentSpecification.sharedData)) {
      currentSpecification.sharedData = {
        entities: [],
      };
    }
    if (!Array.isArray(currentSpecification.sharedData.entities)) {
      currentSpecification.sharedData.entities = [];
    }
    return currentSpecification.sharedData;
  }

  function listSharedEntities() {
    const sharedData = ensureSharedDataContainer();
    return sharedData.entities
      .slice()
      .sort((left, right) => String(left?.entityKey || "").localeCompare(String(right?.entityKey || "")));
  }

  function readSharedEntity(entityKey) {
    const normalizedKey = normalizeEntityKey(entityKey);
    if (!normalizedKey) {
      return null;
    }
    return ensureSharedDataContainer().entities.find((entry) => entry.entityKey === normalizedKey) || null;
  }

  function renderSharedEntityForm(entity) {
    if (sharedEntityKeyInput) {
      sharedEntityKeyInput.value = entity?.entityKey || "";
    }
    if (sharedEntityDisplayInput) {
      sharedEntityDisplayInput.value = entity?.displayName || "";
    }
    if (sharedEntityTableInput) {
      sharedEntityTableInput.value = entity?.tableName || "";
    }
    if (sharedEntityFieldsTextarea) {
      sharedEntityFieldsTextarea.value = stringifySharedEntityFields(entity?.fields || []);
    }
    if (sharedEntityRelationsTextarea) {
      sharedEntityRelationsTextarea.value = stringifySharedEntityRelations(entity?.relations || []);
    }
  }

  function refreshSharedEntitySelector() {
    const entities = listSharedEntities();
    if (sharedEntitySelect) {
      const options = entities.map((entity) => ({
        value: entity.entityKey,
        label: `${entity.entityKey} (${entity.tableName || "table"})`,
      }));
      fillSelectOptions(
        documentRef,
        sharedEntitySelect,
        options,
        selectedSharedEntityKey || sharedEntitySelect.value,
      );
      selectedSharedEntityKey = String(sharedEntitySelect.value || "");
    }

    const selected = readSharedEntity(selectedSharedEntityKey) || entities[0] || null;
    selectedSharedEntityKey = selected?.entityKey || "";
    if (sharedEntitySelect) {
      sharedEntitySelect.value = selectedSharedEntityKey;
    }
    renderSharedEntityForm(selected);
  }

  function collectSharedEntityFromForm() {
    const entityKey = normalizeEntityKey(sharedEntityKeyInput?.value || selectedSharedEntityKey || "");
    if (!entityKey) {
      throw new Error("Shared entity key is required.");
    }

    const displayName = String(sharedEntityDisplayInput?.value || entityKey).trim() || entityKey;
    const tableName = String(sharedEntityTableInput?.value || toDefaultSharedTableName(entityKey)).trim() || toDefaultSharedTableName(entityKey);
    const fields = parseSharedEntityFields(sharedEntityFieldsTextarea?.value || "");
    if (fields.length === 0) {
      throw new Error("Define at least one shared entity field.");
    }
    const relations = parseSharedEntityRelations(sharedEntityRelationsTextarea?.value || "");

    return {
      entityKey,
      displayName,
      tableName,
      fields,
      relations,
    };
  }

  function createDraftSharedEntity() {
    const timestamp = Date.now();
    const key = `shared_entity_${timestamp}`;
    selectedSharedEntityKey = key;
    renderSharedEntityForm({
      entityKey: key,
      displayName: "Shared Entity",
      tableName: toDefaultSharedTableName(key),
      fields: [
        {
          name: "id",
          type: "STRING",
          required: true,
          indexed: true,
          unique: true,
        },
      ],
      relations: [],
    });
    setSharedEntityFeedback("Draft shared entity prepared. Apply to persist it in specification.", "success");
  }

  function applySharedEntityConfiguration() {
    const nextEntity = collectSharedEntityFromForm();
    const sharedData = ensureSharedDataContainer();
    const previousSelectedKey = normalizeEntityKey(selectedSharedEntityKey);
    if (previousSelectedKey && previousSelectedKey !== nextEntity.entityKey) {
      sharedData.entities = sharedData.entities.filter((entry) => entry.entityKey !== previousSelectedKey);
    }
    const existingIndex = sharedData.entities.findIndex((entry) => entry.entityKey === nextEntity.entityKey);
    if (existingIndex >= 0) {
      sharedData.entities[existingIndex] = nextEntity;
    } else {
      sharedData.entities.push(nextEntity);
    }
    selectedSharedEntityKey = nextEntity.entityKey;
    updateSpecificationEditor();
    refreshSharedEntitySelector();
    setSharedEntityFeedback(`Shared entity '${nextEntity.entityKey}' saved into specification.`, "success");
  }

  function removeSharedEntity() {
    const entityKey = normalizeEntityKey(sharedEntitySelect?.value || sharedEntityKeyInput?.value || "");
    if (!entityKey) {
      throw new Error("Select a shared entity before removing it.");
    }
    const sharedData = ensureSharedDataContainer();
    const previousSize = sharedData.entities.length;
    sharedData.entities = sharedData.entities.filter((entry) => entry.entityKey !== entityKey);
    if (sharedData.entities.length === previousSize) {
      throw new Error(`Shared entity '${entityKey}' was not found.`);
    }

    selectedSharedEntityKey = sharedData.entities[0]?.entityKey || "";
    updateSpecificationEditor();
    refreshSharedEntitySelector();
    setSharedEntityFeedback(`Shared entity '${entityKey}' removed.`, "success");
  }

  function ensureActivitySpec(activityId, elementType) {
    const id = String(activityId || "").trim();
    if (!id) {
      return null;
    }

    if (!currentSpecification.activities[id]) {
      currentSpecification.activities[id] = buildDefaultActivitySpecification(id, elementType);
      updateSpecificationEditor();
    }

    return currentSpecification.activities[id];
  }

  function setSelectionLine(message) {
    if (selectionLine) {
      selectionLine.textContent = message;
    }
  }

  function setActivityFormEnabled(enabled) {
    if (!activityForm) {
      return;
    }
    for (const field of activityForm.querySelectorAll("input, select, textarea, button")) {
      field.disabled = !enabled;
    }
  }

  function applyAutomaticSectionVisibility() {
    if (!automaticSection || !activityTypeSelect) {
      return;
    }

    const isAutomatic = String(activityTypeSelect.value || "").toUpperCase() === "AUTOMATIC";
    automaticSection.classList.toggle("hidden", !isAutomatic);
  }

  function renderActivityForm(activitySpec) {
    if (!activitySpec || !activityForm) {
      return;
    }

    if (activityIdInput) {
      activityIdInput.value = selectedActivityId;
    }
    if (activityKindInput) {
      activityKindInput.value = selectedElementType || "-";
    }
    if (activityTypeSelect) {
      activityTypeSelect.value = String(activitySpec.activityType || "MANUAL").toUpperCase();
    }
    if (candidateRolesInput) {
      candidateRolesInput.value = stringifyRoleList(activitySpec.candidateRoles);
    }
    if (assignmentModeSelect) {
      assignmentModeSelect.value = String(activitySpec.assignment?.mode || "AUTOMATIC").toUpperCase();
    }
    if (assignmentStrategySelect) {
      assignmentStrategySelect.value = String(activitySpec.assignment?.strategy || "ROLE_QUEUE").toUpperCase();
    }
    if (allowPrevAssignedCheckbox) {
      allowPrevAssignedCheckbox.checked = activitySpec.assignment?.allowPreviouslyAssignedAssignee !== false;
    }
    if (manualAssignerRolesInput) {
      manualAssignerRolesInput.value = stringifyRoleList(activitySpec.assignment?.manualAssignerRoles);
    }
    if (maxAssigneesInput) {
      maxAssigneesInput.value = String(activitySpec.assignment?.maxAssignees || 1);
    }

    const automaticExecution = activitySpec.automaticExecution || {};
    if (automaticTaskTypeSelect) {
      automaticTaskTypeSelect.value = String(automaticExecution.taskTypeKey || DEFAULT_AUTOMATIC_TASK_TYPE_KEY);
    }
    if (automaticHandlerRefInput) {
      automaticHandlerRefInput.value = String(automaticExecution.handlerRef || toHandlerRef(selectedActivityId));
    }
    if (automaticTriggerModeSelect) {
      automaticTriggerModeSelect.value = String(automaticExecution.triggerMode || "MANUAL_TRIGGER");
    }
    if (automaticDelayInput) {
      automaticDelayInput.value = automaticExecution.deferredDelayMinutes == null
        ? ""
        : String(automaticExecution.deferredDelayMinutes);
    }
    if (automaticConfigurationTextarea) {
      automaticConfigurationTextarea.value = toJsonSafeText(automaticExecution.configuration || {}, "{}").trim();
    }

    if (inputSourcesTextarea) {
      inputSourcesTextarea.value = stringifyInputSources(activitySpec.input?.sources || []);
    }
    if (outputStorageSelect) {
      outputStorageSelect.value = String(activitySpec.output?.storage || "INSTANCE").toUpperCase();
    }
    if (outputMappingsTextarea) {
      outputMappingsTextarea.value = stringifyMappings(activitySpec.output?.mappings || []);
    }
    if (activityViewerRolesInput) {
      activityViewerRolesInput.value = stringifyRoleList(activitySpec.visibility?.activityViewerRoles);
    }
    if (dataViewerRolesInput) {
      dataViewerRolesInput.value = stringifyRoleList(activitySpec.visibility?.dataViewerRoles);
    }

    applyAutomaticSectionVisibility();
  }

  function parseConfigurationJson(value) {
    const text = String(value || "").trim();
    if (!text) {
      return {};
    }

    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Automatic configuration must be a JSON object.");
    }
    return parsed;
  }

  function collectActivitySpecFromForm() {
    const activityType = String(activityTypeSelect?.value || "MANUAL").toUpperCase();
    const assignment = {
      mode: String(assignmentModeSelect?.value || "AUTOMATIC").toUpperCase(),
      strategy: String(assignmentStrategySelect?.value || "ROLE_QUEUE").toUpperCase(),
      allowPreviouslyAssignedAssignee: allowPrevAssignedCheckbox?.checked !== false,
      manualAssignerRoles: parseRoleList(manualAssignerRolesInput?.value || "PROCESS_MONITOR,ADMINISTRATOR"),
      maxAssignees: Math.max(1, Number.parseInt(String(maxAssigneesInput?.value || "1"), 10) || 1),
    };

    const outputStorage = String(outputStorageSelect?.value || "INSTANCE").toUpperCase();
    const automaticConfig = parseConfigurationJson(automaticConfigurationTextarea?.value || "{}");

    return {
      activityType,
      candidateRoles: parseRoleList(candidateRolesInput?.value || "PROCESS_USER"),
      assignment,
      automaticExecution: activityType === "AUTOMATIC"
        ? {
            taskTypeKey: String(automaticTaskTypeSelect?.value || DEFAULT_AUTOMATIC_TASK_TYPE_KEY).toLowerCase(),
            handlerRef: String(automaticHandlerRefInput?.value || toHandlerRef(selectedActivityId)).trim(),
            triggerMode: String(automaticTriggerModeSelect?.value || "MANUAL_TRIGGER").toUpperCase(),
            deferredDelayMinutes: String(automaticDelayInput?.value || "").trim()
              ? Math.max(1, Number.parseInt(String(automaticDelayInput.value), 10) || 1)
              : null,
            configuration: automaticConfig,
          }
        : null,
      input: {
        sources: parseInputSources(inputSourcesTextarea?.value || ""),
      },
      output: {
        storage: OUTPUT_STORAGE_VALUES.includes(outputStorage) ? outputStorage : "INSTANCE",
        mappings: parseMappings(outputMappingsTextarea?.value || ""),
      },
      visibility: {
        activityViewerRoles: parseRoleList(activityViewerRolesInput?.value || "PROCESS_USER,PROCESS_MONITOR,ADMINISTRATOR"),
        dataViewerRoles: parseRoleList(dataViewerRolesInput?.value || "PROCESS_USER,PROCESS_MONITOR,ADMINISTRATOR"),
      },
    };
  }

  function applyCurrentActivityConfiguration() {
    if (!selectedActivityId) {
      throw new Error("Select a BPMN activity before applying configuration.");
    }

    const nextSpec = collectActivitySpecFromForm();
    currentSpecification.activities[selectedActivityId] = nextSpec;
    updateSpecificationEditor();
    setActivityFeedback(`Configuration applied to activity '${selectedActivityId}'.`, "success");
  }

  async function saveSpecificationToVersion() {
    if (typeof api.saveProcessModelSpecification !== "function") {
      throw new Error("Save specification API is not available.");
    }

    const modelKey = String(loadModelSelector?.value || "");
    const versionNumber = String(loadVersionSelector?.value || "");
    if (!modelKey || !versionNumber) {
      throw new Error("Select model and version before saving specification.");
    }

    if (specificationEditor && !syncingSpecificationEditor) {
      const parsed = JSON.parse(specificationEditor.getValue() || "{}");
      currentSpecification = normalizeSpecificationShape(parsed);
    }

    const payload = await api.saveProcessModelSpecification(modelKey, versionNumber, {
      specification: currentSpecification,
    });
    const specification = payload?.specification || currentSpecification;
    currentSpecification = normalizeSpecificationShape(specification);
    updateSpecificationEditor();
    setActivityFeedback(`Specification saved for ${modelKey} v${versionNumber}.`, "success");
    return payload;
  }

  async function validateSpecificationForVersion() {
    if (typeof api.validateProcessModelSpecification !== "function") {
      throw new Error("Validate specification API is not available.");
    }

    const modelKey = String(loadModelSelector?.value || "");
    const versionNumber = String(loadVersionSelector?.value || "");
    if (!modelKey || !versionNumber) {
      throw new Error("Select model and version before validating specification.");
    }

    if (specificationEditor && !syncingSpecificationEditor) {
      const parsed = JSON.parse(specificationEditor.getValue() || "{}");
      currentSpecification = normalizeSpecificationShape(parsed);
    }

    const payload = await api.validateProcessModelSpecification(modelKey, versionNumber, {
      specification: currentSpecification,
    });
    const errorCount = Array.isArray(payload?.validation?.errors) ? payload.validation.errors.length : 0;
    const warningCount = Array.isArray(payload?.validation?.warnings) ? payload.validation.warnings.length : 0;
    if (errorCount > 0) {
      setActivityFeedback(`Specification validation failed with ${errorCount} error(s) and ${warningCount} warning(s).`, "error");
    } else if (warningCount > 0) {
      setActivityFeedback(`Specification validation passed with ${warningCount} warning(s).`);
    } else {
      setActivityFeedback("Specification validation passed (0 errors, 0 warnings).", "success");
    }
    return payload;
  }

  async function loadSpecificationForVersion(modelKey, versionNumber) {
    if (typeof api.fetchProcessModelSpecification !== "function") {
      currentSpecification = deepClone(DEFAULT_SPECIFICATION);
      updateSpecificationEditor();
      return;
    }

    try {
      const payload = await api.fetchProcessModelSpecification(modelKey, versionNumber);
      currentSpecification = normalizeSpecificationShape(payload?.specification || DEFAULT_SPECIFICATION);
      updateSpecificationEditor();
      setActivityFeedback(`Specification loaded for ${modelKey} v${versionNumber}.`, "success");
    } catch (error) {
      currentSpecification = deepClone(DEFAULT_SPECIFICATION);
      updateSpecificationEditor();
      setActivityFeedback(error.message || "Specification could not be loaded. Using defaults.", "error");
    }
  }

  function handleSelectionChanged(event) {
    const selected = Array.isArray(event?.newSelection) ? event.newSelection : [];
    const first = selected[0];
    const businessObject = first?.businessObject || null;
    const elementId = String(businessObject?.id || "");
    const typeName = normalizeBpmnType(businessObject?.$type || first?.type || "");

    if (!elementId || !TASK_TYPES.has(typeName)) {
      selectedActivityId = "";
      selectedElementType = "";
      setSelectionLine("Select a BPMN activity to configure assignment, automatic execution, and data mappings.");
      setActivityFormEnabled(false);
      setActivityFeedback("Activity configuration is waiting for an activity selection.");
      return;
    }

    selectedActivityId = elementId;
    selectedElementType = typeName;
    setSelectionLine(`Selected activity: ${selectedActivityId} (${selectedElementType})`);
    setActivityFormEnabled(true);

    const activitySpec = ensureActivitySpec(selectedActivityId, selectedElementType);
    renderActivityForm(activitySpec);
    setActivityFeedback("Activity configuration loaded.", "success");
  }

  async function importXmlIntoModeler(xml, options = {}) {
    const normalizedXml = String(xml || "");
    const lintResult = validateXmlAndLint(normalizedXml, { withFeedback: false });
    if (!lintResult.valid) {
      if (options.withFeedback !== false) {
        setFeedback(feedbackElement, "Cannot import BPMN XML while validation errors exist.", "error");
      }
      throw new Error("BPMN XML has validation errors.");
    }

    syncingFromEditor = true;
    try {
      const importResult = await modeler.importXML(normalizedXml);
      currentXml = normalizedXml;

      const activityMap = findBpmnActivityMap(normalizedXml);
      for (const [activityId, metadata] of activityMap.entries()) {
        ensureActivitySpec(activityId, metadata.elementType);
      }
      updateSpecificationEditor();

      if (options.withFeedback !== false) {
        const warnings = Array.isArray(importResult?.warnings) ? importResult.warnings.length : 0;
        if (warnings > 0 || lintResult.warningCount > 0) {
          setFeedback(
            feedbackElement,
            `BPMN synchronized with ${warnings + lintResult.warningCount} warning(s).`,
          );
        } else {
          setFeedback(feedbackElement, "BPMN XML synchronized with graphical model.", "success");
        }
      }

      return importResult;
    } finally {
      syncingFromEditor = false;
    }
  }

  async function syncEditorFromModeler() {
    if (syncingFromEditor) {
      return;
    }

    try {
      const exportResult = await modeler.saveXML({ format: true });
      const xml = String(exportResult?.xml || "");

      if (editor.getValue() !== xml) {
        syncingFromModeler = true;
        editor.setValue(xml);
        syncingFromModeler = false;
      }

      currentXml = xml;
      validateXmlAndLint(xml, { withFeedback: false });
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to sync XML from modeler.", "error");
    }
  }

  async function setXml(xml, options = {}) {
    const normalizedXml = String(xml || "");
    if (!normalizedXml.trim()) {
      throw new Error("BPMN XML cannot be empty.");
    }

    await importXmlIntoModeler(normalizedXml, {
      withFeedback: options.withFeedback,
    });

    if (editor.getValue() !== normalizedXml) {
      syncingFromModeler = true;
      editor.setValue(normalizedXml);
      syncingFromModeler = false;
    }

    currentXml = normalizedXml;
    validateXmlAndLint(normalizedXml, { withFeedback: false });
  }

  function applyXmlToTextarea(textareaElement) {
    if (!textareaElement) {
      return false;
    }

    textareaElement.value = editor.getValue();
    return true;
  }

  async function createSnapshot(source, summary, versionNumber = null) {
    if (typeof api.createProcessModelSnapshot !== "function") {
      return null;
    }

    const modelKey = String(loadModelSelector?.value || "");
    if (!modelKey) {
      throw new Error("Select a model before creating a persisted snapshot.");
    }

    const payload = {
      bpmnXml: editor.getValue(),
      source,
      summary,
      versionNumber,
    };
    return api.createProcessModelSnapshot(modelKey, payload);
  }

  async function loadSelectedVersionIntoStudio() {
    if (typeof api.fetchProcessModelVersion !== "function") {
      throw new Error("Load version API is not available.");
    }

    const modelKey = String(loadModelSelector?.value || "");
    const versionNumber = String(loadVersionSelector?.value || "");
    if (!modelKey || !versionNumber) {
      throw new Error("Select both model and version to load.");
    }

    const payload = await api.fetchProcessModelVersion(modelKey, versionNumber);
    const xml = payload?.version?.bpmnXml;
    if (!String(xml || "").trim()) {
      throw new Error(`Version ${versionNumber} has no BPMN XML.`);
    }

    await setXml(xml, { withFeedback: false });
    await loadSpecificationForVersion(modelKey, versionNumber);
    await createSnapshot(
      "load-version",
      `Loaded ${modelKey} v${versionNumber}`,
      Number.parseInt(versionNumber, 10),
    );
    selectedModelKey = modelKey;
    selectedVersionNumber = versionNumber;
    setFeedback(feedbackElement, `Loaded ${modelKey} v${versionNumber} into BPMN Studio.`, "success");
  }

  async function undoSnapshot() {
    if (typeof api.undoProcessModelSnapshot !== "function") {
      throw new Error("Undo API is not available.");
    }

    const modelKey = String(loadModelSelector?.value || "");
    if (!modelKey) {
      throw new Error("Select a model before undo.");
    }

    const payload = await api.undoProcessModelSnapshot(modelKey);
    const xml = payload?.history?.currentSnapshot?.bpmnXml;
    if (!String(xml || "").trim()) {
      throw new Error("Undo history returned an empty BPMN snapshot.");
    }

    await setXml(xml, { withFeedback: false });
    setFeedback(feedbackElement, "Undo applied from persisted history.", "success");
  }

  async function redoSnapshot() {
    if (typeof api.redoProcessModelSnapshot !== "function") {
      throw new Error("Redo API is not available.");
    }

    const modelKey = String(loadModelSelector?.value || "");
    if (!modelKey) {
      throw new Error("Select a model before redo.");
    }

    const payload = await api.redoProcessModelSnapshot(modelKey);
    const xml = payload?.history?.currentSnapshot?.bpmnXml;
    if (!String(xml || "").trim()) {
      throw new Error("Redo history returned an empty BPMN snapshot.");
    }

    await setXml(xml, { withFeedback: false });
    setFeedback(feedbackElement, "Redo applied from persisted history.", "success");
  }

  function toggleElementVisibility(toggleButton, shellElement, expandedText, collapsedText) {
    if (!toggleButton || !shellElement) {
      return;
    }

    const hidden = shellElement.classList.toggle("hidden");
    toggleButton.textContent = hidden ? collapsedText : expandedText;
    if (!hidden && shellElement.contains(editorElement)) {
      editor.layout();
    }
    if (!hidden && specificationEditor && shellElement.contains(specEditorElement)) {
      specificationEditor.layout();
    }
    if (canvasApi && typeof canvasApi.resized === "function") {
      canvasApi.resized();
    }
  }

  for (const [selectElement, options] of [
    [activityTypeSelect, ACTIVITY_TYPES],
    [assignmentModeSelect, ASSIGNMENT_MODES],
    [assignmentStrategySelect, ASSIGNMENT_STRATEGIES],
    [automaticTriggerModeSelect, TRIGGER_MODES],
    [outputStorageSelect, OUTPUT_STORAGE_VALUES],
  ]) {
    if (!selectElement) {
      continue;
    }
    fillSelectOptions(documentRef, selectElement, options.map((entry) => ({ value: entry, label: entry })), selectElement.value || options[0]);
  }

  if (automaticTaskTypeSelect) {
    fillSelectOptions(
      documentRef,
      automaticTaskTypeSelect,
      [{ value: DEFAULT_AUTOMATIC_TASK_TYPE_KEY, label: DEFAULT_AUTOMATIC_TASK_TYPE_KEY }],
      DEFAULT_AUTOMATIC_TASK_TYPE_KEY,
    );
  }

  setSelectionLine("Select a BPMN activity to configure assignment, automatic execution, and data mappings.");
  setActivityFormEnabled(false);
  applyAutomaticSectionVisibility();
  refreshSharedEntitySelector();

  if (toggleXmlButton && editorShell) {
    toggleXmlButton.addEventListener("click", () => {
      toggleElementVisibility(
        toggleXmlButton,
        editorShell,
        "Hide BPMN XML",
        "Show BPMN XML",
      );
    });
    toggleXmlButton.textContent = editorShell.classList.contains("hidden") ? "Show BPMN XML" : "Hide BPMN XML";
  }

  if (toggleSpecJsonButton && specEditorShell) {
    toggleSpecJsonButton.addEventListener("click", () => {
      toggleElementVisibility(
        toggleSpecJsonButton,
        specEditorShell,
        "Hide specification JSON",
        "Show specification JSON",
      );
    });
    toggleSpecJsonButton.textContent = specEditorShell.classList.contains("hidden")
      ? "Show specification JSON"
      : "Hide specification JSON";
  }

  editor.onDidChangeModelContent(() => {
    if (syncingFromModeler) {
      return;
    }

    const xml = editor.getValue();
    currentXml = xml;
    validateXmlAndLint(xml, { withFeedback: false });

    if (editorToModelerTimer) {
      clearTimeout(editorToModelerTimer);
    }

    editorToModelerTimer = window.setTimeout(async () => {
      try {
        await importXmlIntoModeler(xml, { withFeedback: true });
      } catch (_) {
        // feedback already emitted.
      }
    }, 700);
  });

  modeler.on("commandStack.changed", () => {
    if (syncingFromEditor) {
      return;
    }

    if (modelerToEditorTimer) {
      clearTimeout(modelerToEditorTimer);
    }

    modelerToEditorTimer = window.setTimeout(() => {
      syncEditorFromModeler();
    }, 220);
  });

  window.addEventListener("resize", () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      editor.layout();
      if (specificationEditor) {
        specificationEditor.layout();
      }
      if (canvasApi && typeof canvasApi.resized === "function") {
        canvasApi.resized();
      }
    }, 180);
  });

  const eventBus = modeler.get("eventBus");
  eventBus.on("selection.changed", handleSelectionChanged);

  if (specificationEditor) {
    specificationEditor.onDidChangeModelContent(() => {
      if (syncingSpecificationEditor) {
        return;
      }
      try {
        const parsed = JSON.parse(specificationEditor.getValue() || "{}");
        currentSpecification = normalizeSpecificationShape(parsed);
        refreshSharedEntitySelector();
      } catch (_) {
        // Keep editor free-form; explicit save/validate will surface parsing feedback.
      }
    });
  }

  if (activityTypeSelect) {
    activityTypeSelect.addEventListener("change", () => applyAutomaticSectionVisibility());
  }

  if (applyConfigButton) {
    applyConfigButton.addEventListener("click", () => {
      try {
        applyCurrentActivityConfiguration();
      } catch (error) {
        setActivityFeedback(error.message || "Failed to apply activity configuration.", "error");
      }
    });
  }

  if (reloadConfigButton) {
    reloadConfigButton.addEventListener("click", () => {
      if (!selectedActivityId) {
        setActivityFeedback("Select a BPMN activity before reloading configuration.", "error");
        return;
      }
      const activitySpec = ensureActivitySpec(selectedActivityId, selectedElementType);
      renderActivityForm(activitySpec);
      setActivityFeedback("Activity configuration reloaded from current specification.", "success");
    });
  }

  if (sharedEntitySelect) {
    sharedEntitySelect.addEventListener("change", () => {
      selectedSharedEntityKey = String(sharedEntitySelect.value || "");
      const entity = readSharedEntity(selectedSharedEntityKey);
      renderSharedEntityForm(entity);
      if (entity) {
        setSharedEntityFeedback(`Shared entity '${entity.entityKey}' loaded.`, "success");
      }
    });
  }

  if (sharedEntityNewButton) {
    sharedEntityNewButton.addEventListener("click", () => {
      createDraftSharedEntity();
    });
  }

  if (sharedEntityApplyButton) {
    sharedEntityApplyButton.addEventListener("click", () => {
      try {
        applySharedEntityConfiguration();
      } catch (error) {
        setSharedEntityFeedback(error.message || "Failed to save shared entity.", "error");
      }
    });
  }

  if (sharedEntityRemoveButton) {
    sharedEntityRemoveButton.addEventListener("click", () => {
      try {
        removeSharedEntity();
      } catch (error) {
        setSharedEntityFeedback(error.message || "Failed to remove shared entity.", "error");
      }
    });
  }

  if (saveSpecButton) {
    saveSpecButton.addEventListener("click", async () => {
      try {
        await saveSpecificationToVersion();
      } catch (error) {
        setActivityFeedback(error.message || "Failed to save specification.", "error");
      }
    });
  }

  if (validateSpecButton) {
    validateSpecButton.addEventListener("click", async () => {
      try {
        await validateSpecificationForVersion();
      } catch (error) {
        setActivityFeedback(error.message || "Failed to validate specification.", "error");
      }
    });
  }

  if (loadModelSelector) {
    loadModelSelector.addEventListener("change", () => {
      refreshVersionSelector();
    });
  }

  if (newButton) {
    newButton.addEventListener("click", async () => {
      try {
        await setXml(DEFAULT_BPMN_XML, { withFeedback: false });
        currentSpecification = deepClone(DEFAULT_SPECIFICATION);
        updateSpecificationEditor();
        setActivityFormEnabled(false);
        setSelectionLine("Select a BPMN activity to configure assignment, automatic execution, and data mappings.");
        await createSnapshot("new-diagram", "Initialized new BPMN diagram");
        setFeedback(feedbackElement, "New BPMN diagram created.", "success");
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to create new BPMN diagram.", "error");
      }
    });
  }

  if (importButton && importFileInput) {
    importButton.addEventListener("click", () => {
      importFileInput.click();
    });

    importFileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      try {
        const content = await file.text();
        await setXml(content, { withFeedback: false });
        await createSnapshot("import", `Imported BPMN file: ${file.name || "unnamed"}`);
        setFeedback(feedbackElement, "BPMN file imported.", "success");
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to import BPMN file.", "error");
      } finally {
        importFileInput.value = "";
      }
    });
  }

  if (exportButton) {
    exportButton.addEventListener("click", async () => {
      try {
        const exportResult = await modeler.saveXML({ format: true });
        const xml = String(exportResult?.xml || editor.getValue() || "");
        currentXml = xml;
        triggerDownload("process-model.bpmn", xml);
        setFeedback(feedbackElement, "BPMN file exported.", "success");
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to export BPMN file.", "error");
      }
    });
  }

  if (validateButton) {
    validateButton.addEventListener("click", () => {
      validateXmlAndLint(editor.getValue(), { withFeedback: true });
    });
  }

  if (loadVersionButton) {
    loadVersionButton.addEventListener("click", async () => {
      try {
        await loadSelectedVersionIntoStudio();
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to load selected process version.", "error");
      }
    });
  }

  if (saveSnapshotButton) {
    saveSnapshotButton.addEventListener("click", async () => {
      try {
        const versionNumber = Number.parseInt(String(loadVersionSelector?.value || ""), 10);
        await createSnapshot(
          "studio-edit",
          `Saved studio snapshot at ${new Date().toISOString()}`,
          Number.isFinite(versionNumber) ? versionNumber : null,
        );
        setFeedback(feedbackElement, "Snapshot persisted in .prooweb history.", "success");
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to save BPMN snapshot.", "error");
      }
    });
  }

  if (undoButton) {
    undoButton.addEventListener("click", async () => {
      try {
        await undoSnapshot();
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to apply undo.", "error");
      }
    });
  }

  if (redoButton) {
    redoButton.addEventListener("click", async () => {
      try {
        await redoSnapshot();
      } catch (error) {
        setFeedback(feedbackElement, error.message || "Failed to apply redo.", "error");
      }
    });
  }

  const createBpmnTextarea = documentRef.querySelector("#process-model-create-form textarea[name=\"bpmnXml\"]");
  const versionBpmnTextarea = documentRef.querySelector("#process-model-version-form textarea[name=\"bpmnXml\"]");

  if (fillCreateButton) {
    fillCreateButton.addEventListener("click", () => {
      applyXmlToTextarea(createBpmnTextarea);
      setFeedback(feedbackElement, "Studio XML copied to Create Model form.", "success");
    });
  }

  if (fillVersionButton) {
    fillVersionButton.addEventListener("click", () => {
      applyXmlToTextarea(versionBpmnTextarea);
      setFeedback(feedbackElement, "Studio XML copied to Create Version form.", "success");
    });
  }

  try {
    await setXml(DEFAULT_BPMN_XML, { withFeedback: false });
    if (typeof api.fetchAutomaticTaskCatalog === "function") {
      const catalogPayload = await api.fetchAutomaticTaskCatalog();
      setAutomaticTaskTypes(Array.isArray(catalogPayload?.catalog?.taskTypes) ? catalogPayload.catalog.taskTypes : []);
    }
    updateSpecificationEditor();
    setFeedback(feedbackElement, "BPMN studio ready.", "success");
  } catch (error) {
    setFeedback(feedbackElement, error.message || "Failed to initialize BPMN studio.", "error");
  }

  return {
    ready: true,
    async getXml() {
      return String(editor.getValue() || currentXml || "");
    },
    async setXml(xml, options = {}) {
      return setXml(xml, options);
    },
    applyXmlToTextarea,
    setCatalog,
    setAutomaticTaskTypes,
    async saveSpecification() {
      return saveSpecificationToVersion();
    },
    async validateSpecification() {
      return validateSpecificationForVersion();
    },
    getCurrentSelection() {
      return {
        modelKey: selectedModelKey,
        versionNumber: selectedVersionNumber,
        activityId: selectedActivityId,
      };
    },
  };
}
