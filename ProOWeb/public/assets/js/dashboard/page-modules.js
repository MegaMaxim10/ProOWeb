const PROCESS_STUDIO_PAGES = new Set([
  "processes-new-process-model",
  "processes-process-models",
  "data-new-shared-entity",
  "data-shared-entities",
]);

export async function initializeWorkspacePageModules({
  page,
  status,
  documentRef,
  windowRef,
  dependencies,
}) {
  const {
    wireReconfigureForm,
    wireTemplateOverridesPanel,
    wireProcessModelingPanel,
    runWorkspaceReconfiguration,
    fetchTemplateOverrides,
    saveTemplateOverride,
    deleteTemplateOverride,
  } = dependencies;

  if (page === "project-platform-settings") {
    wireReconfigureForm({
      status,
      onReconfigure: runWorkspaceReconfiguration,
      documentRef,
      windowRef,
    });
  }

  if (page === "project-platform-settings" || page === "templates-home") {
    await wireTemplateOverridesPanel({
      status,
      onFetchTemplateOverrides: fetchTemplateOverrides,
      onSaveTemplateOverride: saveTemplateOverride,
      onDeleteTemplateOverride: deleteTemplateOverride,
      documentRef,
    });
  }

  if (PROCESS_STUDIO_PAGES.has(page)) {
    await wireProcessModelingPanel({
      status,
      documentRef,
    });
  }
}
