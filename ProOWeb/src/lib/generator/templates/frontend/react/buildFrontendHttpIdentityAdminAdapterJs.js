function buildFrontendHttpIdentityAdminAdapterJs() {
  return `function toAuthorizationHeader(auth) {
  if (!auth?.username || !auth?.password) {
    throw new Error("Identity admin credentials are required");
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
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": toAuthorizationHeader(auth),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || "Identity API call failed: " + response.status;
    throw new Error(message);
  }

  return payload;
}

export function createHttpIdentityAdminAdapter({ baseUrl = "" } = {}) {
  return {
    async loadUsers({ auth, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/identity/users", { auth, signal });
      return payload.users || [];
    },

    async createUser({ auth, user, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/identity/users", {
        method: "POST",
        auth,
        signal,
        body: user,
      });
      return payload.user;
    },

    async loadRoles({ auth, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/identity/roles", { auth, signal });
      return payload.roles || [];
    },

    async createRole({ auth, role, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/identity/roles", {
        method: "POST",
        auth,
        signal,
        body: role,
      });
      return payload.role;
    },

    async assignRole({ auth, username, roleCode, signal } = {}) {
      const safeUsername = encodeURIComponent(username || "");
      const safeRoleCode = encodeURIComponent(roleCode || "");
      const payload = await requestJson(
        baseUrl + "/api/admin/identity/users/" + safeUsername + "/roles/" + safeRoleCode,
        {
          method: "POST",
          auth,
          signal,
        },
      );
      return payload.user;
    },
  };
}
`;
}

module.exports = {
  buildFrontendHttpIdentityAdminAdapterJs,
};
