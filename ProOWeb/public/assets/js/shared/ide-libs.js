const LOCAL_MONACO_ROOT_URL = "/assets/vendor/monaco/min";
const LOCAL_MONACO_VS_URL = `${LOCAL_MONACO_ROOT_URL}/vs`;
const LOCAL_MONACO_LOADER_URL = `${LOCAL_MONACO_VS_URL}/loader.js`;
const LOCAL_MONACO_WORKER_PROXY_URL = "/assets/vendor/monaco/worker-proxy.js";
const FALLBACK_MONACO_ROOT_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min";
const FALLBACK_MONACO_VS_URL = `${FALLBACK_MONACO_ROOT_URL}/vs`;
const FALLBACK_MONACO_LOADER_URL = `${FALLBACK_MONACO_VS_URL}/loader.js`;

const LOCAL_BPMN_MODELER_URL = "/assets/vendor/bpmn/bpmn-modeler.production.min.js";
const FALLBACK_BPMN_MODELER_URL = "https://unpkg.com/bpmn-js@17.9.2/dist/bpmn-modeler.production.min.js";

function getIdeRegistry() {
  if (!window.__proowebIdeRegistry) {
    window.__proowebIdeRegistry = {
      scripts: new Map(),
      monacoPromise: null,
      monacoRootUrl: LOCAL_MONACO_ROOT_URL,
      monacoVsUrl: LOCAL_MONACO_VS_URL,
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

  const existingSelector = scriptKey === "monaco-loader"
    ? `script[data-prooweb-lib="${scriptKey}"], script[src$="/vs/loader.js"], script[src*="monaco-editor"][src*="/vs/loader.js"]`
    : `script[data-prooweb-lib="${scriptKey}"]`;
  const existing = document.querySelector(existingSelector);
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

function toAbsoluteUrl(url) {
  const source = String(url || "").trim();
  if (!source) {
    return "";
  }

  try {
    return new URL(source, window.location.origin).toString().replace(/\/+$/, "");
  } catch (_) {
    return source.replace(/\/+$/, "");
  }
}

function createMonacoWorkerProxyUrl(rootUrl) {
  const absoluteRootUrl = toAbsoluteUrl(rootUrl);
  const absoluteProxyUrl = toAbsoluteUrl(LOCAL_MONACO_WORKER_PROXY_URL);
  const search = `baseUrl=${encodeURIComponent(absoluteRootUrl)}`;
  return `${absoluteProxyUrl}?${search}`;
}

function resolveBpmnConstructor() {
  return window.BpmnJS || window.BpmnModeler || globalThis.BpmnJS || globalThis.BpmnModeler || null;
}

async function resolveMonacoLoader() {
  const registry = getIdeRegistry();
  if (window.require && typeof window.require.config === "function" && window.define?.amd) {
    registry.monacoRootUrl = LOCAL_MONACO_ROOT_URL;
    registry.monacoVsUrl = LOCAL_MONACO_VS_URL;
    return {
      rootUrl: LOCAL_MONACO_ROOT_URL,
      vsUrl: LOCAL_MONACO_VS_URL,
    };
  }

  const candidates = [
    {
      loaderUrl: LOCAL_MONACO_LOADER_URL,
      rootUrl: LOCAL_MONACO_ROOT_URL,
      vsUrl: LOCAL_MONACO_VS_URL,
    },
    {
      loaderUrl: FALLBACK_MONACO_LOADER_URL,
      rootUrl: FALLBACK_MONACO_ROOT_URL,
      vsUrl: FALLBACK_MONACO_VS_URL,
    },
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      await loadScriptOnce(candidate.loaderUrl, "monaco-loader");
      registry.monacoRootUrl = candidate.rootUrl;
      registry.monacoVsUrl = candidate.vsUrl;
      return {
        rootUrl: candidate.rootUrl,
        vsUrl: candidate.vsUrl,
      };
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
      const resolvedUrls = await resolveMonacoLoader();
      const absoluteRootUrl = toAbsoluteUrl(resolvedUrls.rootUrl);
      const absoluteVsUrl = toAbsoluteUrl(resolvedUrls.vsUrl);
      const amdRequire = window.require;
      if (!amdRequire) {
        throw new Error("Monaco AMD loader is not available.");
      }

      amdRequire.config({
        paths: { vs: absoluteVsUrl },
        ignoreDuplicateModules: ["vs/editor/editor.main"],
      });
      window.MonacoEnvironment = {
        baseUrl: absoluteRootUrl,
        getWorkerUrl(moduleId, label) {
          return createMonacoWorkerProxyUrl(absoluteRootUrl);
        },
      };

      await new Promise((resolve, reject) => {
        if (window.monaco?.editor) {
          resolve();
          return;
        }

        if (typeof amdRequire.defined === "function" && amdRequire.defined("vs/editor/editor.main")) {
          resolve();
          return;
        }

        amdRequire(["vs/editor/editor.main"], () => resolve(), reject);
      });

      if (!window.monaco?.editor) {
        throw new Error("Monaco editor did not initialize.");
      }

      return window.monaco;
    })().catch((error) => {
      registry.monacoPromise = null;
      throw error;
    });
  }

  return registry.monacoPromise;
}

export function loadBpmnModelerConstructor() {
  const existing = resolveBpmnConstructor();
  if (existing) {
    return Promise.resolve(existing);
  }

  const registry = getIdeRegistry();
  if (!registry.bpmnPromise) {
    registry.bpmnPromise = (async () => {
      const candidates = [LOCAL_BPMN_MODELER_URL, FALLBACK_BPMN_MODELER_URL];
      let lastError = null;

      for (const candidate of candidates) {
        try {
          await loadScriptOnce(candidate, "bpmn-modeler");
          const constructor = resolveBpmnConstructor();
          if (constructor) {
            return constructor;
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
