function buildFrontendGeneratedProcessDataLineageCatalogJs() {
  return `export const generatedProcessDataLineageCatalog = Object.freeze([]);

export function listDataLineageForProcess(modelKey, versionNumber) {
  const key = String(modelKey || "").trim();
  const version = Number.parseInt(String(versionNumber || ""), 10);
  return generatedProcessDataLineageCatalog.filter(
    (entry) => entry.modelKey === key && entry.versionNumber === version,
  );
}
`;
}

module.exports = {
  buildFrontendGeneratedProcessDataLineageCatalogJs,
};

