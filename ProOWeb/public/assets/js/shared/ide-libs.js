const LOCAL_MONACO_BASE_URL = "/assets/vendor/monaco/min/vs";
const LOCAL_MONACO_LOADER_URL = `${LOCAL_MONACO_BASE_URL}/loader.js`;
const FALLBACK_MONACO_BASE_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";
const FALLBACK_MONACO_LOADER_URL = `${FALLBACK_MONACO_BASE_URL}/loader.js`;

const LOCAL_BPMN_MODELER_URL = "/assets/vendor/bpmn/bpmn-modeler.production.min.js";
const FALLBACK_BPMN_MODELER_URL = "https://unpkg.com/bpmn-js@17.9.2/dist/bpmn-modeler.production.min.js";

function getIdeRegistry() {
  if (!window.__proowebIdeRegistry) {
    window.__proowebIdeRegistry = {
      scripts: new Map(),
      monacoPromise: null,
      monacoBaseUrl: LOCAL_MONACO_BASE_URL,
      bpmnPromise: null,
    };
  }

  return window.__proowebIdeRegistry;
}

function waitForScript(script, key) {
  return new Promise((resolve, reject) => {
    if (script.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (script.dataset.failed === "true") {
      reject(new Error(`Failed to load script: ${key}`));
      return;
    }

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      script.dataset.failed = "true";
      reject(new Error(`Failed to load script: ${key}`));
    }, { once: true });
  });
}

function loadScriptOnce(scriptUrl, scriptKey = scriptUrl) {
  const registry = getIdeRegistry();
  if (registry.scripts.has(scriptKey)) {
    return registry.scripts.get(scriptKey);
  }

  const existing = document.querySelector(`script[data-prooweb-lib="${scriptKey}"]`);
  if (existing) {
    const existingPromise = waitForScript(existing, scriptKey);
    registry.scripts.set(scriptKey, existingPromise);
    return existingPromise;
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.proowebLib = scriptKey;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      script.dataset.failed = "true";
      script.remove();
      registry.scripts.delete(scriptKey);
      reject(new Error(`Failed to load script: ${scriptUrl}`));
    }, { once: true });
    document.head.appendChild(script);
  });

  registry.scripts.set(scriptKey, promise);
  return promise;
}

function createMonacoWorkerUrl(baseUrl) {
  const workerSource =
    `self.MonacoEnvironment={baseUrl:'${baseUrl}'};` +
    `importScripts('${baseUrl}/base/worker/workerMain.js');`;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`;
}

async function resolveMonacoLoader() {
  const registry = getIdeRegistry();
  const candidates = [
    { loaderUrl: LOCAL_MONACO_LOADER_URL, baseUrl: LOCAL_MONACO_BASE_URL },
    { loaderUrl: FALLBACK_MONACO_LOADER_URL, baseUrl: FALLBACK_MONACO_BASE_URL },
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      await loadScriptOnce(candidate.loaderUrl, "monaco-loader");
      registry.monacoBaseUrl = candidate.baseUrl;
      return candidate.baseUrl;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Monaco loader could not be loaded.");
}

export function loadMonacoEditor() {
  if (window.monaco?.editor) {
    return Promise.resolve(window.monaco);
  }

  const registry = getIdeRegistry();
  if (!registry.monacoPromise) {
    registry.monacoPromise = (async () => {
      const baseUrl = await resolveMonacoLoader();
      const amdRequire = window.require;
      if (!amdRequire) {
        throw new Error("Monaco AMD loader is not available.");
      }

      amdRequire.config({ paths: { vs: baseUrl } });
      window.MonacoEnvironment = {
        getWorkerUrl() {
          return createMonacoWorkerUrl(baseUrl);
        },
      };

      await new Promise((resolve, reject) => {
        if (window.monaco?.editor) {
          resolve();
          return;
        }

        amdRequire(["vs/editor/editor.main"], () => resolve(), reject);
      });

      if (!window.monaco?.editor) {
        throw new Error("Monaco editor did not initialize.");
      }

      return window.monaco;
    })();
  }

  return registry.monacoPromise;
}

export function loadBpmnModelerConstructor() {
  if (window.BpmnJS) {
    return Promise.resolve(window.BpmnJS);
  }

  const registry = getIdeRegistry();
  if (!registry.bpmnPromise) {
    registry.bpmnPromise = (async () => {
      const candidates = [LOCAL_BPMN_MODELER_URL, FALLBACK_BPMN_MODELER_URL];
      let lastError = null;

      for (const candidate of candidates) {
        try {
          await loadScriptOnce(candidate, "bpmn-modeler");
          if (window.BpmnJS) {
            return window.BpmnJS;
          }
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("BPMN modeler library did not initialize.");
    })();
  }

  return registry.bpmnPromise;
}
