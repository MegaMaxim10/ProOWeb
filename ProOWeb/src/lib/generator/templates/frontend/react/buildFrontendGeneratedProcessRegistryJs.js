function buildFrontendGeneratedProcessRegistryJs() {
  return `export const generatedProcessRegistry = Object.freeze([]);

export function findProcessByModelKey(modelKey) {
  const key = String(modelKey || "").trim();
  return generatedProcessRegistry.find((entry) => entry.modelKey === key) || null;
}

export function findStartableProcessesByRole(roleCode) {
  const normalizedRole = String(roleCode || "").trim();
  return generatedProcessRegistry.filter((entry) =>
    Array.isArray(entry.startableByRoles) && entry.startableByRoles.includes(normalizedRole));
}
`;
}

module.exports = {
  buildFrontendGeneratedProcessRegistryJs,
};

