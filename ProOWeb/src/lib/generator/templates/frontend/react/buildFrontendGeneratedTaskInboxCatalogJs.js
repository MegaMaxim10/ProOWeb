function buildFrontendGeneratedTaskInboxCatalogJs() {
  return `export const generatedManualTaskCatalog = Object.freeze([]);

export function listManualTasksByRole(roleCode) {
  const normalizedRole = String(roleCode || "").trim();
  return generatedManualTaskCatalog.filter((entry) =>
    Array.isArray(entry.candidateRoles) && entry.candidateRoles.includes(normalizedRole));
}
`;
}

module.exports = {
  buildFrontendGeneratedTaskInboxCatalogJs,
};

