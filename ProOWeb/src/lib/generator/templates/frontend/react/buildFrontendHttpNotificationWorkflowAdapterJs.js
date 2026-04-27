function buildFrontendHttpNotificationWorkflowAdapterJs() {
  return `function toAuthorizationHeader(auth) {
  if (!auth?.username || !auth?.password) {
    throw new Error("Notification workflow credentials are required");
  }

  const raw = auth.username + ":" + auth.password;
  if (typeof globalThis.btoa === "function") {
    return "Basic " + globalThis.btoa(raw);
  }

  throw new Error("Browser runtime does not support Base64 encoding.");
}

async function requestJson(url, { method = "GET", auth, body, signal } = {}) {
  const response = await fetch(url, {
    method,
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: toAuthorizationHeader(auth),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || "Notification workflow API call failed: " + response.status;
    throw new Error(message);
  }

  return payload;
}

export function createHttpNotificationWorkflowAdapter({ baseUrl = "" } = {}) {
  return {
    async loadTemplates({ auth, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/notifications/templates", { auth, signal });
      return payload.templates || [];
    },

    async dispatch({ auth, templateCode, recipient, variables, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/notifications/dispatch", {
        method: "POST",
        auth,
        signal,
        body: {
          templateCode,
          recipient,
          variables,
        },
      });
      return payload.auditEntry || null;
    },

    async loadAudit({ auth, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/notifications/audit", { auth, signal });
      return payload.entries || [];
    },
  };
}
`;
}

module.exports = {
  buildFrontendHttpNotificationWorkflowAdapterJs,
};

