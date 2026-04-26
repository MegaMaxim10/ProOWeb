function buildFrontendHttpAuthFlowsAdapterJs() {
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

async function postJson(url, payload = {}, options = {}) {
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  if (options.basicAuth) {
    headers.Authorization = buildBasicHeader(options.basicAuth.username, options.basicAuth.password);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const data = await safeJsonParse(response);
  if (!response.ok) {
    throw new Error(data.message || "Auth API request failed with status " + response.status);
  }

  return data;
}

export function createHttpAuthFlowsAdapter({ baseUrl = "" } = {}) {
  return {
    registerAccount(payload, options = {}) {
      return postJson(baseUrl + "/api/auth/register", payload, options);
    },
    activateAccount(payload, options = {}) {
      return postJson(baseUrl + "/api/auth/activate", payload, options);
    },
    login(payload, options = {}) {
      return postJson(baseUrl + "/api/auth/login", payload, options);
    },
    requestPasswordReset(payload, options = {}) {
      return postJson(baseUrl + "/api/auth/password-reset/request", payload, options);
    },
    confirmPasswordReset(payload, options = {}) {
      return postJson(baseUrl + "/api/auth/password-reset/confirm", payload, options);
    },
    setupOtpMfa(options = {}) {
      return postJson(baseUrl + "/api/account/mfa/otp/setup", {}, options);
    },
    setupTotpMfa(options = {}) {
      return postJson(baseUrl + "/api/account/mfa/totp/setup", {}, options);
    },
  };
}
`;
}

module.exports = {
  buildFrontendHttpAuthFlowsAdapterJs,
};
