function buildFrontendHttpOrganizationHierarchyAdapterJs() {
  return `function toAuthorizationHeader(auth) {
  if (!auth?.username || !auth?.password) {
    throw new Error("Organization admin credentials are required");
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
    const message = payload?.message || "Organization API call failed: " + response.status;
    throw new Error(message);
  }

  return payload;
}

export function createHttpOrganizationHierarchyAdapter({ baseUrl = "" } = {}) {
  return {
    async loadUnits({ auth, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/organization/units", { auth, signal });
      return payload.units || [];
    },

    async createUnit({ auth, unit, signal } = {}) {
      const payload = await requestJson(baseUrl + "/api/admin/organization/units", {
        method: "POST",
        auth,
        signal,
        body: unit,
      });
      return payload.unit;
    },

    async assignSupervisor({ auth, unitCode, username, signal } = {}) {
      const safeUnitCode = encodeURIComponent(unitCode || "");
      const safeUsername = encodeURIComponent(username || "");
      const payload = await requestJson(
        baseUrl + "/api/admin/organization/units/" + safeUnitCode + "/supervisor/" + safeUsername,
        {
          method: "POST",
          auth,
          signal,
        },
      );
      return payload.unit;
    },

    async assignMember({ auth, unitCode, username, signal } = {}) {
      const safeUnitCode = encodeURIComponent(unitCode || "");
      const safeUsername = encodeURIComponent(username || "");
      const payload = await requestJson(
        baseUrl + "/api/admin/organization/units/" + safeUnitCode + "/members/" + safeUsername,
        {
          method: "POST",
          auth,
          signal,
        },
      );
      return payload.unit;
    },

    async resolveAssignment({ auth, unitCode, strategy, signal } = {}) {
      const safeUnitCode = encodeURIComponent(unitCode || "");
      const safeStrategy = encodeURIComponent(strategy || "");
      const query = safeStrategy
        ? "?unitCode=" + safeUnitCode + "&strategy=" + safeStrategy
        : "?unitCode=" + safeUnitCode;
      return requestJson(baseUrl + "/api/admin/organization/assignment/resolve" + query, {
        auth,
        signal,
      });
    },
  };
}
`;
}

module.exports = {
  buildFrontendHttpOrganizationHierarchyAdapterJs,
};

