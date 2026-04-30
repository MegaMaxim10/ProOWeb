export const WORKSPACE_PAGE_VIEWS = Object.freeze({
  "project-dashboard": ["workspace-dashboard"],
  "project-platform-info": ["workspace-platform-info"],
  "project-platform-settings": ["reconfigure"],
  "project-migration-center": ["management"],
  "data-new-shared-entity": ["process-model"],
  "data-shared-entities": ["process-model"],
  "processes-new-process-model": ["process-model"],
  "processes-process-models": ["process-model"],
  "templates-home": ["template-governance"],
  "help-project-layout": ["deployment"],
  "help-build-run": ["codegen"],
  "help-check-updates": ["help-check-updates"],
  "help-about": ["help-about"],
});

export const WORKSPACE_PATH_TO_PAGE = Object.freeze({
  "/dashboard": "project-dashboard",
  "/project/dashboard": "project-dashboard",
  "/project/platform-info": "project-platform-info",
  "/project/platform-settings": "project-platform-settings",
  "/project/migration-center": "project-migration-center",
  "/data/new-shared-entity": "data-new-shared-entity",
  "/data/shared-entities": "data-shared-entities",
  "/processes/new-process-model": "processes-new-process-model",
  "/processes/process-models": "processes-process-models",
  "/templates": "templates-home",
  "/help/project-layout": "help-project-layout",
  "/help/build-run": "help-build-run",
  "/help/check-updates": "help-check-updates",
  "/help/about": "help-about",
});

export function normalizeWorkspacePath(pathname) {
  return String(pathname || "").toLowerCase().replace(/\/+$/, "") || "/";
}

export function resolveWorkspacePageByPath(pathname) {
  const normalizedPath = normalizeWorkspacePath(pathname);
  return WORKSPACE_PATH_TO_PAGE[normalizedPath] || "project-dashboard";
}
