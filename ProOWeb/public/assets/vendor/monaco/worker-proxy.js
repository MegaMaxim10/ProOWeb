(function bootstrapMonacoWorker() {
  function normalizeBaseUrl(value) {
    const normalized = String(value || "").replace(/\/+$/, "");
    return normalized.endsWith("/vs") ? normalized.slice(0, -3) : normalized;
  }

  function resolveBaseUrl() {
    try {
      const href = typeof self.location?.href === "string" ? self.location.href : "";
      const parsed = new URL(href);
      const fromQuery = parsed.searchParams.get("baseUrl");
      if (fromQuery) {
        return normalizeBaseUrl(fromQuery);
      }
    } catch (_) {
      // ignore and use fallback
    }

    return "/assets/vendor/monaco/min";
  }

  const baseUrl = resolveBaseUrl();
  self.MonacoEnvironment = Object.assign({}, self.MonacoEnvironment || {}, { baseUrl });
  self.importScripts(baseUrl + "/vs/base/worker/workerMain.js");
})();
