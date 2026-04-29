import { setFeedback } from "../shared/feedback.js";

const MONACO_LOADER_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js";
const MONACO_BASE_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";

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

function loadMonacoEditor() {
  if (window.monaco?.editor) {
    return Promise.resolve(window.monaco);
  }

  if (!monacoPromise) {
    monacoPromise = loadScript(MONACO_LOADER_SCRIPT_URL).then(
      () =>
        new Promise((resolve, reject) => {
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
        }),
    );
  }

  return monacoPromise;
}

function fillSelectOptions(selectElement, options, selectedValue = "") {
  if (!selectElement) {
    return;
  }
  const previous = selectedValue || selectElement.value || "";
  selectElement.innerHTML = "";
  const safeOptions = Array.isArray(options) ? options : [];
  if (safeOptions.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "-";
    selectElement.appendChild(option);
    selectElement.value = "";
    return;
  }

  for (const row of safeOptions) {
    const option = document.createElement("option");
    option.value = String(row.value);
    option.textContent = String(row.label);
    selectElement.appendChild(option);
  }

  const available = new Set(safeOptions.map((entry) => String(entry.value)));
  selectElement.value = available.has(String(previous))
    ? String(previous)
    : String(safeOptions[0].value);
}

function parseJsonEditor(editor, label) {
  try {
    const value = JSON.parse(String(editor.getValue() || "{}"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return value;
  } catch (error) {
    throw new Error(error.message || `${label} JSON is invalid.`);
  }
}

function toTaskTypeOptions(catalog) {
  const rows = Array.isArray(catalog?.taskTypes) ? catalog.taskTypes : [];
  return rows
    .slice()
    .sort((left, right) => String(left.taskTypeKey || "").localeCompare(String(right.taskTypeKey || "")))
    .map((entry) => ({
      value: entry.taskTypeKey,
      label: `${entry.taskTypeKey} (${entry.kind || "-"})`,
    }));
}

export async function initializeAutomaticTaskCatalogStudio({
  documentRef = document,
  api = {},
  onReport = null,
} = {}) {
  const catalogEditorElement = documentRef.getElementById("process-auto-catalog-editor");
  const sourceEditorElement = documentRef.getElementById("process-auto-task-source-editor");
  const feedbackElement = documentRef.getElementById("process-auto-catalog-feedback");
  const sourcePathElement = documentRef.getElementById("process-auto-task-source-path");
  const loadCatalogButton = documentRef.getElementById("process-auto-catalog-load");
  const saveCatalogButton = documentRef.getElementById("process-auto-catalog-save");
  const taskTypeSelector = documentRef.getElementById("process-auto-task-type-select");
  const loadSourceButton = documentRef.getElementById("process-auto-task-source-load");
  const saveSourceButton = documentRef.getElementById("process-auto-task-source-save");

  if (
    !catalogEditorElement
    || !sourceEditorElement
    || !feedbackElement
    || !sourcePathElement
    || !loadCatalogButton
    || !saveCatalogButton
    || !taskTypeSelector
    || !loadSourceButton
    || !saveSourceButton
  ) {
    return {
      ready: false,
      async refresh() {
        return null;
      },
    };
  }

  let monaco;
  try {
    monaco = await loadMonacoEditor();
  } catch (error) {
    setFeedback(feedbackElement, error.message || "Automatic task catalog editor could not be loaded.", "error");
    return {
      ready: false,
      async refresh() {
        return null;
      },
    };
  }

  const catalogEditor = monaco.editor.create(catalogEditorElement, {
    value: "{\n  \"schemaVersion\": 1,\n  \"taskTypes\": [],\n  \"libraries\": {\n    \"maven\": [],\n    \"npm\": []\n  }\n}\n",
    language: "json",
    theme: "vs",
    automaticLayout: true,
    minimap: { enabled: false },
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });
  const sourceEditor = monaco.editor.create(sourceEditorElement, {
    value: "// Select a CUSTOM automatic task type and load its source.\n",
    language: "java",
    theme: "vs",
    automaticLayout: true,
    minimap: { enabled: false },
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });

  let latestCatalog = null;
  let latestSourceTaskTypeKey = "";
  let latestSourcePath = "";

  function selectedTaskTypeKey() {
    return String(taskTypeSelector.value || "").trim();
  }

  function updateTaskTypeSelector(catalog) {
    fillSelectOptions(taskTypeSelector, toTaskTypeOptions(catalog), taskTypeSelector.value);
  }

  function updateSourcePathLabel(pathValue) {
    sourcePathElement.textContent = `Custom source path: ${pathValue || "-"}`;
  }

  async function loadCatalog() {
    if (typeof api.fetchAutomaticTaskCatalog !== "function") {
      throw new Error("Automatic task catalog API is not available.");
    }
    const payload = await api.fetchAutomaticTaskCatalog();
    const catalog = payload?.catalog;
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
      throw new Error("Automatic task catalog payload is invalid.");
    }
    latestCatalog = catalog;
    catalogEditor.setValue(`${JSON.stringify(catalog, null, 2)}\n`);
    updateTaskTypeSelector(catalog);
    updateSourcePathLabel("");
    sourceEditor.setValue("// Select a CUSTOM automatic task type and load its source.\n");
    setFeedback(feedbackElement, "Automatic task catalog loaded.", "success");
    if (typeof onReport === "function") {
      onReport("catalog-load", payload);
    }
    return payload;
  }

  async function saveCatalog() {
    if (typeof api.saveAutomaticTaskCatalog !== "function") {
      throw new Error("Automatic task catalog save API is not available.");
    }
    const payload = parseJsonEditor(catalogEditor, "Automatic task catalog");
    const result = await api.saveAutomaticTaskCatalog(payload);
    latestCatalog = result?.catalog || payload;
    catalogEditor.setValue(`${JSON.stringify(latestCatalog, null, 2)}\n`);
    updateTaskTypeSelector(latestCatalog);
    setFeedback(feedbackElement, "Automatic task catalog saved.", "success");
    if (typeof onReport === "function") {
      onReport("catalog-save", result);
    }
    return result;
  }

  async function loadTaskTypeSource() {
    const taskTypeKey = selectedTaskTypeKey();
    if (!taskTypeKey) {
      throw new Error("Select an automatic task type.");
    }
    const selectedType = (latestCatalog?.taskTypes || []).find((entry) => entry.taskTypeKey === taskTypeKey) || null;
    if (!selectedType) {
      throw new Error(`Automatic task type '${taskTypeKey}' is missing from loaded catalog.`);
    }
    if (selectedType.kind !== "CUSTOM") {
      throw new Error(`'${taskTypeKey}' is BUILTIN and has no editable custom source.`);
    }
    if (typeof api.fetchAutomaticTaskTypeSource !== "function") {
      throw new Error("Automatic task source API is not available.");
    }
    const payload = await api.fetchAutomaticTaskTypeSource(taskTypeKey);
    sourceEditor.setValue(`${String(payload?.source || "")}\n`);
    latestSourceTaskTypeKey = taskTypeKey;
    latestSourcePath = String(payload?.sourcePath || "");
    updateSourcePathLabel(latestSourcePath);
    setFeedback(feedbackElement, `Source loaded for ${taskTypeKey}.`, "success");
    if (typeof onReport === "function") {
      onReport("source-load", payload);
    }
    return payload;
  }

  async function saveTaskTypeSource() {
    const taskTypeKey = selectedTaskTypeKey();
    if (!taskTypeKey) {
      throw new Error("Select an automatic task type.");
    }
    const selectedType = (latestCatalog?.taskTypes || []).find((entry) => entry.taskTypeKey === taskTypeKey) || null;
    if (!selectedType) {
      throw new Error(`Automatic task type '${taskTypeKey}' is missing from loaded catalog.`);
    }
    if (selectedType.kind !== "CUSTOM") {
      throw new Error(`'${taskTypeKey}' is BUILTIN and has no editable custom source.`);
    }
    if (typeof api.saveAutomaticTaskTypeSource !== "function") {
      throw new Error("Automatic task source save API is not available.");
    }
    const payload = {
      source: String(sourceEditor.getValue() || ""),
    };
    const result = await api.saveAutomaticTaskTypeSource(taskTypeKey, payload);
    latestSourceTaskTypeKey = taskTypeKey;
    latestSourcePath = String(result?.sourcePath || latestSourcePath || "");
    updateSourcePathLabel(latestSourcePath);
    setFeedback(feedbackElement, `Source saved for ${taskTypeKey}.`, "success");
    if (typeof onReport === "function") {
      onReport("source-save", result);
    }
    return result;
  }

  loadCatalogButton.addEventListener("click", async () => {
    try {
      await loadCatalog();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to load automatic task catalog.", "error");
    }
  });

  saveCatalogButton.addEventListener("click", async () => {
    try {
      await saveCatalog();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to save automatic task catalog.", "error");
    }
  });

  loadSourceButton.addEventListener("click", async () => {
    try {
      await loadTaskTypeSource();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to load automatic task source.", "error");
    }
  });

  saveSourceButton.addEventListener("click", async () => {
    try {
      await saveTaskTypeSource();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to save automatic task source.", "error");
    }
  });

  taskTypeSelector.addEventListener("change", () => {
    const selected = selectedTaskTypeKey();
    if (!selected || selected !== latestSourceTaskTypeKey) {
      updateSourcePathLabel("");
    }
  });

  try {
    await loadCatalog();
  } catch (error) {
    setFeedback(feedbackElement, error.message || "Failed to initialize automatic task catalog studio.", "error");
  }

  return {
    ready: true,
    async refresh() {
      return loadCatalog();
    },
  };
}
