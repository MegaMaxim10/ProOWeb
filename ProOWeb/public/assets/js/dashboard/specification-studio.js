import { setFeedback } from "../shared/feedback.js";

const MONACO_LOADER_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js";
const MONACO_BASE_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";

const DEFAULT_SPECIFICATION_JSON = JSON.stringify(
  {
    schemaVersion: 1,
    start: {
      startableByRoles: ["PROCESS_USER"],
      startActivities: [],
      allowAutoStartWhenNoManualEntry: true,
    },
    monitors: {
      monitorRoles: ["PROCESS_MONITOR"],
    },
    activities: {},
  },
  null,
  2,
);

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
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
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

  const previousValue = selectedValue || selectElement.value || "";
  selectElement.innerHTML = "";

  if (!Array.isArray(options) || options.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-";
    selectElement.appendChild(emptyOption);
    selectElement.value = "";
    return;
  }

  for (const optionData of options) {
    const optionElement = document.createElement("option");
    optionElement.value = String(optionData.value);
    optionElement.textContent = String(optionData.label);
    selectElement.appendChild(optionElement);
  }

  const available = new Set(options.map((entry) => String(entry.value)));
  selectElement.value = available.has(String(previousValue))
    ? String(previousValue)
    : String(options[0].value);
}

function parseSpecificationFromEditor(editor) {
  try {
    const parsed = JSON.parse(String(editor.getValue() || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Specification JSON must be an object.");
    }

    return {
      ok: true,
      value: parsed,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error,
    };
  }
}

function createDisabledStudio(feedbackElement, reason) {
  setFeedback(feedbackElement, `Specification studio unavailable: ${reason}`, "error");

  return {
    ready: false,
    setCatalog() {
      return null;
    },
    async loadSpecification() {
      return null;
    },
    async validateSpecification() {
      return null;
    },
    async saveSpecification() {
      return null;
    },
  };
}

function toValidationFeedback(validation) {
  if (!validation) {
    return {
      level: "error",
      message: "No validation details returned by API.",
    };
  }

  const errorCount = Array.isArray(validation.errors) ? validation.errors.length : 0;
  const warningCount = Array.isArray(validation.warnings) ? validation.warnings.length : 0;
  if (errorCount > 0) {
    return {
      level: "error",
      message: `Specification validation failed: ${errorCount} error(s), ${warningCount} warning(s).`,
    };
  }
  if (warningCount > 0) {
    return {
      level: "info",
      message: `Specification validation passed with ${warningCount} warning(s).`,
    };
  }

  return {
    level: "success",
    message: "Specification validation passed (0 errors, 0 warnings).",
  };
}

export async function initializeSpecificationStudio({
  documentRef = document,
  api = {},
  onReport = null,
} = {}) {
  const editorElement = documentRef.getElementById("process-spec-editor");
  const feedbackElement = documentRef.getElementById("process-spec-feedback");
  const modelSelector = documentRef.getElementById("process-spec-model");
  const versionSelector = documentRef.getElementById("process-spec-version");
  const loadButton = documentRef.getElementById("process-spec-load");
  const validateButton = documentRef.getElementById("process-spec-validate");
  const saveButton = documentRef.getElementById("process-spec-save");

  if (
    !editorElement
    || !feedbackElement
    || !modelSelector
    || !versionSelector
    || !loadButton
    || !validateButton
    || !saveButton
  ) {
    return createDisabledStudio(feedbackElement, "Specification studio DOM nodes are missing.");
  }

  let monaco;
  try {
    monaco = await loadMonacoEditor();
  } catch (error) {
    return createDisabledStudio(feedbackElement, error.message || "Monaco editor could not be loaded.");
  }

  const editor = monaco.editor.create(editorElement, {
    value: DEFAULT_SPECIFICATION_JSON,
    language: "json",
    theme: "vs",
    automaticLayout: true,
    minimap: {
      enabled: false,
    },
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });

  let catalogModels = [];

  function getSelection() {
    return {
      modelKey: String(modelSelector.value || ""),
      versionNumber: String(versionSelector.value || ""),
    };
  }

  function refreshVersionSelector() {
    const selectedModelKey = String(modelSelector.value || "");
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

    fillSelectOptions(versionSelector, versionOptions, versionSelector.value);
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

    fillSelectOptions(modelSelector, modelOptions, modelSelector.value);
    refreshVersionSelector();
  }

  if (modelSelector) {
    modelSelector.addEventListener("change", () => {
      refreshVersionSelector();
    });
  }

  async function loadSpecification() {
    if (typeof api.fetchProcessModelSpecification !== "function") {
      throw new Error("Load specification API is not available.");
    }

    const { modelKey, versionNumber } = getSelection();
    if (!modelKey || !versionNumber) {
      throw new Error("Select both model and version.");
    }

    const payload = await api.fetchProcessModelSpecification(modelKey, versionNumber);
    const specification = payload?.specification;
    if (!specification || typeof specification !== "object" || Array.isArray(specification)) {
      throw new Error("Specification payload is missing or invalid.");
    }

    editor.setValue(`${JSON.stringify(specification, null, 2)}\n`);
    setFeedback(feedbackElement, `Specification loaded for ${modelKey} v${versionNumber}.`, "success");
    if (typeof onReport === "function") {
      onReport("load", payload);
    }
    return payload;
  }

  async function validateSpecification() {
    if (typeof api.validateProcessModelSpecification !== "function") {
      throw new Error("Validate specification API is not available.");
    }

    const parsed = parseSpecificationFromEditor(editor);
    if (!parsed.ok) {
      throw new Error(parsed.error?.message || "Specification JSON is invalid.");
    }

    const { modelKey, versionNumber } = getSelection();
    if (!modelKey || !versionNumber) {
      throw new Error("Select both model and version.");
    }

    const payload = await api.validateProcessModelSpecification(modelKey, versionNumber, {
      specification: parsed.value,
    });

    const feedback = toValidationFeedback(payload?.validation);
    setFeedback(feedbackElement, feedback.message, feedback.level === "error" ? "error" : (feedback.level === "success" ? "success" : undefined));
    if (typeof onReport === "function") {
      onReport("validate", payload);
    }
    return payload;
  }

  async function saveSpecification() {
    if (typeof api.saveProcessModelSpecification !== "function") {
      throw new Error("Save specification API is not available.");
    }

    const parsed = parseSpecificationFromEditor(editor);
    if (!parsed.ok) {
      throw new Error(parsed.error?.message || "Specification JSON is invalid.");
    }

    const { modelKey, versionNumber } = getSelection();
    if (!modelKey || !versionNumber) {
      throw new Error("Select both model and version.");
    }

    const payload = await api.saveProcessModelSpecification(modelKey, versionNumber, {
      specification: parsed.value,
    });

    const specification = payload?.specification || parsed.value;
    editor.setValue(`${JSON.stringify(specification, null, 2)}\n`);
    setFeedback(feedbackElement, `Specification saved for ${modelKey} v${versionNumber}.`, "success");
    if (typeof onReport === "function") {
      onReport("save", payload);
    }
    return payload;
  }

  loadButton.addEventListener("click", async () => {
    try {
      await loadSpecification();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to load specification.", "error");
    }
  });

  validateButton.addEventListener("click", async () => {
    try {
      await validateSpecification();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to validate specification.", "error");
    }
  });

  saveButton.addEventListener("click", async () => {
    try {
      await saveSpecification();
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Failed to save specification.", "error");
    }
  });

  setFeedback(feedbackElement, "Specification studio ready.", "success");

  return {
    ready: true,
    setCatalog,
    loadSpecification,
    validateSpecification,
    saveSpecification,
  };
}
