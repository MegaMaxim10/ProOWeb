function buildFrontendHttpSystemSnapshotAdapterJs() {
  return `export function createHttpSystemSnapshotAdapter({ baseUrl = "" } = {}) {
  return async function loadSystemSnapshot({ signal } = {}) {
    const [metaResponse, healthResponse] = await Promise.all([
      fetch(baseUrl + "/api/meta", { signal }),
      fetch(baseUrl + "/api/system-health", { signal }),
    ]);

    if (!metaResponse.ok) {
      throw new Error("Failed to load /api/meta");
    }

    const meta = await metaResponse.json();

    let health = { status: "unknown" };
    if (healthResponse.ok) {
      health = await healthResponse.json();
    }

    return { meta, health };
  };
}
`;
}

module.exports = {
  buildFrontendHttpSystemSnapshotAdapterJs,
};
