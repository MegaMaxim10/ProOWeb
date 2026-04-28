function buildFrontendGeneratedProcessFormCatalogJs() {
  return `export const generatedProcessFormCatalog = Object.freeze([]);

export function listProcessFormDefinitions(modelKey, versionNumber) {
  const normalizedModelKey = String(modelKey || "").trim();
  const normalizedVersion = Number.parseInt(String(versionNumber || ""), 10);
  return generatedProcessFormCatalog.filter(
    (entry) => entry.modelKey === normalizedModelKey && entry.versionNumber === normalizedVersion,
  );
}

export function findProcessActivityFormDefinition(modelKey, versionNumber, activityId) {
  const normalizedActivityId = String(activityId || "").trim();
  return listProcessFormDefinitions(modelKey, versionNumber).find(
    (entry) => entry.activityId === normalizedActivityId,
  ) || null;
}
`;
}

module.exports = {
  buildFrontendGeneratedProcessFormCatalogJs,
};

