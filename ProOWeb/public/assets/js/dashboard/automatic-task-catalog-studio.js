import { setFeedback } from "../shared/feedback.js";
import { loadMonacoEditor } from "../shared/ide-libs.js";

const DEFAULT_CATALOG = {
  schemaVersion: 1,
  taskTypes: [],
  libraries: {
    maven: [],
    npm: [],
  },
};

const INPUT_SOURCE_TYPES = [
  "PREVIOUS_ACTIVITY",
  "PROCESS_CONTEXT",
  "SHARED_DATA",
  "BACKEND_SERVICE",
  "EXTERNAL_SERVICE",
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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

function parseJsonObject(text, label) {
  const raw = String(text || "").trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed;
  } catch (error) {
    throw new Error(error.message || `${label} JSON is invalid.`);
  }
}

function parseCsv(value, mapper = (entry) => entry) {
  const rows = String(value || "")
    .split(/[,\n]/)
    .map((entry) => mapper(String(entry || "").trim()))
    .filter((entry) => Boolean(entry));
  return Array.from(new Set(rows));
}

function toPrettyJson(value, fallback = "{}") {
  try {
    return `${JSON.stringify(value, null, 2)}\n`;
  } catch (_) {
    return fallback;
  }
}

function normalizeTaskTypeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function initializeAutomaticTaskCatalogStudio({
  documentRef = document,
  api = {},
  onReport = null,
} = {}) {
  const catalogEditorElement = documentRef.getElementById("process-auto-catalog-editor");
  const catalogEditorShell = documentRef.getElementById("process-auto-catalog-editor-shell");
  const toggleCatalogJsonButton = documentRef.getElementById("process-auto-catalog-toggle-json");
  const sourceEditorElement = documentRef.getElementById("process-auto-task-source-editor");
  const feedbackElement = documentRef.getElementById("process-auto-catalog-feedback");
  const sourcePathElement = documentRef.getElementById("process-auto-task-source-path");
  const loadCatalogButton = documentRef.getElementById("process-auto-catalog-load");
  const saveCatalogButton = documentRef.getElementById("process-auto-catalog-save");
  const taskTypeSelector = documentRef.getElementById("process-auto-task-type-select");
  const loadSourceButton = documentRef.getElementById("process-auto-task-source-load");
  const saveSourceButton = documentRef.getElementById("process-auto-task-source-save");

  const taskKeyInput = documentRef.getElementById("process-auto-task-key");
  const taskDisplayInput = documentRef.getElementById("process-auto-task-display");
  const taskKindSelect = documentRef.getElementById("process-auto-task-kind");
  const taskCategoryInput = documentRef.getElementById("process-auto-task-category");
  const taskEnabledCheckbox = documentRef.getElementById("process-auto-task-enabled");
  const taskDescriptionInput = documentRef.getElementById("process-auto-task-description");
  const taskDependenciesInput = documentRef.getElementById("process-auto-task-dependencies");
  const taskInputSourcesInput = documentRef.getElementById("process-auto-task-input-sources");
  const taskMinSourcesInput = documentRef.getElementById("process-auto-task-min-sources");
  const taskOutputStorageInput = documentRef.getElementById("process-auto-task-output-storage");
  const taskConfigSchemaInput = documentRef.getElementById("process-auto-task-config-schema");
  const taskNewButton = documentRef.getElementById("process-auto-task-new");
  const taskApplyButton = documentRef.getElementById("process-auto-task-apply");
  const taskRemoveButton = documentRef.getElementById("process-auto-task-remove");
  const taskFormFeedback = documentRef.getElementById("process-auto-task-form-feedback");

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
      getTaskTypes() {
        return [];
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
      getTaskTypes() {
        return [];
      },
    };
  }

  const monacoTheme = documentRef.documentElement?.dataset?.theme === "dark" ? "vs-dark" : "vs";
  const catalogEditor = monaco.editor.create(catalogEditorElement, {
    value: toPrettyJson(DEFAULT_CATALOG),
    language: "json",
    theme: monacoTheme,
    automaticLayout: true,
    minimap: { enabled: false },
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });
  const sourceEditor = monaco.editor.create(sourceEditorElement, {
    value: "// Select a CUSTOM automatic task type and load its source.\n",
    language: "java",
    theme: monacoTheme,
    automaticLayout: true,
    minimap: { enabled: false },
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });

  let latestCatalog = deepClone(DEFAULT_CATALOG);
  let latestSourceTaskTypeKey = "";
  let latestSourcePath = "";

  function setTaskFormFeedback(message, tone) {
    if (!taskFormFeedback) {
      return;
    }
    setFeedback(taskFormFeedback, message, tone);
  }

  function selectedTaskTypeKey() {
    return String(taskTypeSelector.value || "").trim();
  }

  function updateTaskTypeSelector(catalog, preferred = "") {
    fillSelectOptions(taskTypeSelector, toTaskTypeOptions(catalog), preferred || taskTypeSelector.value);
  }

  function updateSourcePathLabel(pathValue) {
    sourcePathElement.textContent = `Custom source path: ${pathValue || "-"}`;
  }

  function renderTaskTypeDetails(taskTypeKey) {
    const selectedType = (latestCatalog?.taskTypes || []).find((entry) => entry.taskTypeKey === taskTypeKey) || null;
    if (!selectedType) {
      if (taskKeyInput) {
        taskKeyInput.value = "";
        taskKeyInput.readOnly = false;
      }
      if (taskDisplayInput) {
        taskDisplayInput.value = "";
      }
      if (taskKindSelect) {
        taskKindSelect.value = "CUSTOM";
        taskKindSelect.disabled = false;
      }
      if (taskCategoryInput) {
        taskCategoryInput.value = "";
      }
      if (taskEnabledCheckbox) {
        taskEnabledCheckbox.checked = true;
      }
      if (taskDescriptionInput) {
        taskDescriptionInput.value = "";
      }
      if (taskDependenciesInput) {
        taskDependenciesInput.value = "";
      }
      if (taskInputSourcesInput) {
        taskInputSourcesInput.value = "PROCESS_CONTEXT";
      }
      if (taskMinSourcesInput) {
        taskMinSourcesInput.value = "0";
      }
      if (taskOutputStorageInput) {
        taskOutputStorageInput.value = "INSTANCE";
      }
      if (taskConfigSchemaInput) {
        taskConfigSchemaInput.value = "{\n  \"type\": \"object\",\n  \"properties\": {}\n}";
      }
      if (taskRemoveButton) {
        taskRemoveButton.disabled = true;
      }
      if (loadSourceButton) {
        loadSourceButton.disabled = true;
      }
      if (saveSourceButton) {
        saveSourceButton.disabled = true;
      }
      setTaskFormFeedback("Create a new task type, then apply changes.");
      return;
    }

    if (taskKeyInput) {
      taskKeyInput.value = String(selectedType.taskTypeKey || "");
      taskKeyInput.readOnly = String(selectedType.kind || "").toUpperCase() === "BUILTIN";
    }
    if (taskDisplayInput) {
      taskDisplayInput.value = String(selectedType.displayName || "");
    }
    if (taskKindSelect) {
      taskKindSelect.value = String(selectedType.kind || "CUSTOM").toUpperCase();
      taskKindSelect.disabled = String(selectedType.kind || "").toUpperCase() === "BUILTIN";
    }
    if (taskCategoryInput) {
      taskCategoryInput.value = String(selectedType.category || "");
    }
    if (taskEnabledCheckbox) {
      taskEnabledCheckbox.checked = selectedType.enabled !== false;
    }
    if (taskDescriptionInput) {
      taskDescriptionInput.value = String(selectedType.description || "");
    }
    if (taskDependenciesInput) {
      taskDependenciesInput.value = Array.isArray(selectedType.dependencies) ? selectedType.dependencies.join(", ") : "";
    }
    if (taskInputSourcesInput) {
      const sourceTypes = Array.isArray(selectedType?.inputContract?.allowedSourceTypes)
        ? selectedType.inputContract.allowedSourceTypes
        : [];
      taskInputSourcesInput.value = sourceTypes.join(", ");
    }
    if (taskMinSourcesInput) {
      taskMinSourcesInput.value = String(selectedType?.inputContract?.minSources || 0);
    }
    if (taskOutputStorageInput) {
      taskOutputStorageInput.value = String(selectedType?.outputContract?.defaultStorage || "INSTANCE").toUpperCase();
    }
    if (taskConfigSchemaInput) {
      taskConfigSchemaInput.value = toPrettyJson(selectedType.configurationSchema || {}, "{}").trim();
    }

    const kind = String(selectedType.kind || "").toUpperCase();
    const custom = kind === "CUSTOM";
    if (taskRemoveButton) {
      taskRemoveButton.disabled = !custom;
    }
    if (loadSourceButton) {
      loadSourceButton.disabled = !custom;
    }
    if (saveSourceButton) {
      saveSourceButton.disabled = !custom;
    }
    setTaskFormFeedback(`Loaded task type '${taskTypeKey}'.`, "success");
  }

  function syncCatalogJsonEditor() {
    catalogEditor.setValue(toPrettyJson(latestCatalog));
  }

  function parseCatalogFromEditor() {
    const parsed = parseJsonObject(catalogEditor.getValue(), "Automatic task catalog");
    const merged = {
      ...deepClone(DEFAULT_CATALOG),
      ...deepClone(parsed),
    };
    if (!Array.isArray(merged.taskTypes)) {
      merged.taskTypes = [];
    }
    if (!merged.libraries || typeof merged.libraries !== "object" || Array.isArray(merged.libraries)) {
      merged.libraries = { maven: [], npm: [] };
    }
    if (!Array.isArray(merged.libraries.maven)) {
      merged.libraries.maven = [];
    }
    if (!Array.isArray(merged.libraries.npm)) {
      merged.libraries.npm = [];
    }
    merged.schemaVersion = 1;
    return merged;
  }

  function applyTaskTypeFormChanges() {
    const normalizedKey = normalizeTaskTypeKey(taskKeyInput?.value || "");
    if (!normalizedKey) {
      throw new Error("Task type key is required.");
    }

    latestCatalog = parseCatalogFromEditor();
    const rows = Array.isArray(latestCatalog.taskTypes) ? latestCatalog.taskTypes.slice() : [];
    const existingIndex = rows.findIndex((entry) => entry.taskTypeKey === selectedTaskTypeKey());

    const configurationSchema = parseJsonObject(taskConfigSchemaInput?.value || "{}", "Configuration schema");
    const kind = String(taskKindSelect?.value || "CUSTOM").toUpperCase() === "BUILTIN" ? "BUILTIN" : "CUSTOM";
    const dependencies = parseCsv(taskDependenciesInput?.value || "", (entry) => entry.toLowerCase());
    const allowedSourceTypes = parseCsv(taskInputSourcesInput?.value || "", (entry) => entry.toUpperCase())
      .filter((entry) => INPUT_SOURCE_TYPES.includes(entry));
    const minSources = Math.max(0, Number.parseInt(String(taskMinSourcesInput?.value || "0"), 10) || 0);
    const outputStorage = String(taskOutputStorageInput?.value || "INSTANCE").toUpperCase();

    const previous = existingIndex >= 0 ? rows[existingIndex] : null;
    const nextEntry = {
      ...deepClone(previous || {}),
      taskTypeKey: normalizedKey,
      kind,
      category: String(taskCategoryInput?.value || "").trim() || "custom",
      displayName: String(taskDisplayInput?.value || "").trim() || normalizedKey,
      description: String(taskDescriptionInput?.value || "").trim() || "",
      runtimeBehavior: kind === "CUSTOM" ? "CUSTOM_SOURCE" : "BUILTIN",
      configurationSchema,
      inputContract: {
        allowedSourceTypes: allowedSourceTypes.length > 0 ? allowedSourceTypes : ["PROCESS_CONTEXT"],
        minSources,
      },
      outputContract: {
        defaultStorage: outputStorage || "INSTANCE",
        mappingHints: Array.isArray(previous?.outputContract?.mappingHints) ? previous.outputContract.mappingHints : [],
      },
      dependencies,
      enabled: taskEnabledCheckbox?.checked !== false,
    };

    if (existingIndex >= 0) {
      rows.splice(existingIndex, 1, nextEntry);
    } else {
      rows.push(nextEntry);
    }

    latestCatalog.taskTypes = rows.sort((left, right) => String(left.taskTypeKey || "").localeCompare(String(right.taskTypeKey || "")));
    syncCatalogJsonEditor();
    updateTaskTypeSelector(latestCatalog, normalizedKey);
    renderTaskTypeDetails(normalizedKey);
    setTaskFormFeedback(`Task type '${normalizedKey}' updated locally. Save catalog to persist.`, "success");
  }

  function removeSelectedTaskType() {
    const taskTypeKey = selectedTaskTypeKey();
    if (!taskTypeKey) {
      throw new Error("Select a task type first.");
    }

    latestCatalog = parseCatalogFromEditor();
    const selectedType = (latestCatalog.taskTypes || []).find((entry) => entry.taskTypeKey === taskTypeKey) || null;
    if (!selectedType) {
      throw new Error(`Task type '${taskTypeKey}' is not present.`);
    }
    if (String(selectedType.kind || "").toUpperCase() === "BUILTIN") {
      throw new Error("Built-in task types cannot be removed.");
    }

    latestCatalog.taskTypes = (latestCatalog.taskTypes || []).filter((entry) => entry.taskTypeKey !== taskTypeKey);
    syncCatalogJsonEditor();
    updateTaskTypeSelector(latestCatalog, "");
    renderTaskTypeDetails(selectedTaskTypeKey());
    setTaskFormFeedback(`Task type '${taskTypeKey}' removed locally. Save catalog to persist.`, "success");
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
    latestCatalog = {
      ...deepClone(DEFAULT_CATALOG),
      ...deepClone(catalog),
    };
    if (!Array.isArray(latestCatalog.taskTypes)) {
      latestCatalog.taskTypes = [];
    }
    syncCatalogJsonEditor();
    updateTaskTypeSelector(latestCatalog);
    renderTaskTypeDetails(selectedTaskTypeKey());
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
    latestCatalog = parseCatalogFromEditor();
    const result = await api.saveAutomaticTaskCatalog(latestCatalog);
    latestCatalog = result?.catalog || latestCatalog;
    syncCatalogJsonEditor();
    updateTaskTypeSelector(latestCatalog, selectedTaskTypeKey());
    renderTaskTypeDetails(selectedTaskTypeKey());
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

  if (taskTypeSelector) {
    taskTypeSelector.addEventListener("change", () => {
      const selected = selectedTaskTypeKey();
      if (!selected || selected !== latestSourceTaskTypeKey) {
        updateSourcePathLabel("");
      }
      renderTaskTypeDetails(selected);
    });
  }

  if (taskNewButton) {
    taskNewButton.addEventListener("click", () => {
      if (taskTypeSelector) {
        taskTypeSelector.value = "";
      }
      renderTaskTypeDetails("");
    });
  }

  if (taskApplyButton) {
    taskApplyButton.addEventListener("click", () => {
      try {
        applyTaskTypeFormChanges();
      } catch (error) {
        setTaskFormFeedback(error.message || "Failed to apply task type changes.", "error");
      }
    });
  }

  if (taskRemoveButton) {
    taskRemoveButton.addEventListener("click", () => {
      try {
        removeSelectedTaskType();
      } catch (error) {
        setTaskFormFeedback(error.message || "Failed to remove task type.", "error");
      }
    });
  }

  if (toggleCatalogJsonButton && catalogEditorShell) {
    toggleCatalogJsonButton.addEventListener("click", () => {
      const hidden = catalogEditorShell.classList.toggle("hidden");
      toggleCatalogJsonButton.textContent = hidden ? "Show catalog JSON" : "Hide catalog JSON";
      if (!hidden) {
        catalogEditor.layout();
      }
    });
    toggleCatalogJsonButton.textContent = catalogEditorShell.classList.contains("hidden")
      ? "Show catalog JSON"
      : "Hide catalog JSON";
  }

  if (taskKindSelect) {
    fillSelectOptions(taskKindSelect, [
      { value: "CUSTOM", label: "CUSTOM" },
      { value: "BUILTIN", label: "BUILTIN" },
    ], "CUSTOM");
  }
  if (taskOutputStorageInput) {
    fillSelectOptions(taskOutputStorageInput, [
      { value: "INSTANCE", label: "INSTANCE" },
      { value: "SHARED", label: "SHARED" },
      { value: "BOTH", label: "BOTH" },
    ], "INSTANCE");
  }

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
    getTaskTypes() {
      return Array.isArray(latestCatalog?.taskTypes) ? latestCatalog.taskTypes.slice() : [];
    },
  };
}
