function buildFrontendHttpSessionSecurityAdapterJs() {
  return `function safeJsonParse(response) {
  return response.json().catch(() => ({}));
}

function buildBasicHeader(username, password) {
  const raw = String(username || "") + ":" + String(password || "");
  if (typeof globalThis.btoa !== "function") {
    throw new Error("Browser runtime does not support Base64 encoding.");
  }

  return "Basic " + globalThis.btoa(raw);
}

async function requestJson(url, options = {}) {
  const headers = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.basicAuth) {
    headers.Authorization = buildBasicHeader(options.basicAuth.username, options.basicAuth.password);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const data = await safeJsonParse(response);
  if (!response.ok) {
    throw new Error(data.message || "Session security API request failed with status " + response.status);
  }

  return data;
}

export function createHttpSessionSecurityAdapter({ baseUrl = "" } = {}) {
  return {
    readActiveSessions(options = {}) {
      return requestJson(baseUrl + "/api/account/sessions", {
        method: "GET",
        basicAuth: options.basicAuth,
        signal: options.signal,
      });
    },
    revokeSession(payload, options = {}) {
      return requestJson(baseUrl + "/api/account/sessions/revoke", {
        method: "POST",
        body: payload,
        basicAuth: options.basicAuth,
        signal: options.signal,
      });
    },
  };
}
`;
}

module.exports = {
  buildFrontendHttpSessionSecurityAdapterJs,
};

