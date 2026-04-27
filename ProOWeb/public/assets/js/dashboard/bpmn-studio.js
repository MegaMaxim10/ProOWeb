import { setFeedback } from "../shared/feedback.js";

const BPMN_MODELER_SCRIPT_URL = "https://unpkg.com/bpmn-js@17.9.2/dist/bpmn-modeler.production.min.js";
const MONACO_LOADER_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js";
const MONACO_BASE_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";

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

const TASK_TYPES = new Set([
  "task",
  "userTask",
  "serviceTask",
  "scriptTask",
  "manualTask",
  "businessRuleTask",
  "receiveTask",
  "sendTask",
]);

let bpmnConstructorPromise = null;
let monacoPromise = null;

function loadScript(url) {
  const existing = document.querySelector(`script[data-prooweb-lib="${url}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${url}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.proowebLib = url;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load script: ${url}`)), { once: true });
    document.head.appendChild(script);
  });
}

function loadBpmnModelerConstructor() {
  if (window.BpmnJS) {
    return Promise.resolve(window.BpmnJS);
  }

  if (!bpmnConstructorPromise) {
    bpmnConstructorPromise = loadScript(BPMN_MODELER_SCRIPT_URL)
      .then(() => {
        if (!window.BpmnJS) {
          throw new Error("BPMN modeler library did not initialize.");
        }

        return window.BpmnJS;
      });
  }

  return bpmnConstructorPromise;
}

function loadMonacoEditor() {
  if (window.monaco?.editor) {
    return Promise.resolve(window.monaco);
  }

  if (!monacoPromise) {
    monacoPromise = loadScript(MONACO_LOADER_SCRIPT_URL)
      .then(() => new Promise((resolve, reject) => {
        const amdRequire = window.require;
        if (!amdRequire) {
          reject(new Error("Monaco AMD loader is not available."));
          return;
        }

        amdRequire.config({ paths: { vs: MONACO_BASE_URL } });
        window.MonacoEnvironment = {
          getWorkerUrl() {
            const workerSource =
              `self.MonacoEnvironment={baseUrl:'${MONACO_BASE_URL}'};` +
              `importScripts('${MONACO_BASE_URL}/base/worker/workerMain.js');`;
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`;
          },
        };

        amdRequire(["vs/editor/editor.main"], () => resolve(window.monaco), reject);
      }));
  }

  return monacoPromise;
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

function createDisabledStudio(feedbackElement, reason) {
  setFeedback(feedbackElement, `BPMN studio unavailable: ${reason}`, "error");

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

export async function initializeBpmnStudio({ documentRef = document, api = {} } = {}) {
  const canvasElement = documentRef.getElementById("process-bpmn-canvas");
  const editorElement = documentRef.getElementById("process-bpmn-editor");
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

  if (!canvasElement || !editorElement || !feedbackElement) {
    return createDisabledStudio(feedbackElement, "BPMN studio containers not found in DOM.");
  }

  let BpmnJS;
  let monaco;

  try {
    [BpmnJS, monaco] = await Promise.all([
      loadBpmnModelerConstructor(),
      loadMonacoEditor(),
    ]);
  } catch (error) {
    return createDisabledStudio(feedbackElement, error.message || "External libraries could not be loaded.");
  }

  const modeler = new BpmnJS({
    container: canvasElement,
    keyboard: {
      bindTo: documentRef,
    },
  });

  const editor = monaco.editor.create(editorElement, {
    value: DEFAULT_BPMN_XML,
    language: "xml",
    theme: "vs",
    automaticLayout: true,
    minimap: {
      enabled: false,
    },
    lineNumbers: "on",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });

  let currentXml = DEFAULT_BPMN_XML;
  let syncingFromModeler = false;
  let syncingFromEditor = false;
  let editorToModelerTimer = null;
  let modelerToEditorTimer = null;
  let catalogModels = [];

  function fillSelectOptions(selectElement, options, selectedValue = "") {
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

  function refreshVersionSelector() {
    if (!loadVersionSelector) {
      return;
    }

    const selectedModelKey = String(loadModelSelector?.value || "");
    const model = catalogModels.find((entry) => entry.modelKey === selectedModelKey) || null;
    const versionOptions = Array.isArray(model?.versions)
      ? model.versions
        .slice()
        .sort((left, right) => Number(left.versionNumber || 0) - Number(right.versionNumber || 0))
        .map((version) => ({
          value: String(version.versionNumber),
          label: `v${version.versionNumber} (${version.status})`,
        }))
      : [];

    fillSelectOptions(loadVersionSelector, versionOptions, loadVersionSelector.value);
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

    fillSelectOptions(loadModelSelector, modelOptions, loadModelSelector?.value);
    refreshVersionSelector();
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
    await createSnapshot(
      "load-version",
      `Loaded ${modelKey} v${versionNumber}`,
      Number.parseInt(versionNumber, 10),
    );
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
        // feedback already handled
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

  if (loadModelSelector) {
    loadModelSelector.addEventListener("change", () => {
      refreshVersionSelector();
    });
  }

  if (newButton) {
    newButton.addEventListener("click", async () => {
      try {
        await setXml(DEFAULT_BPMN_XML, { withFeedback: false });
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
  };
}
