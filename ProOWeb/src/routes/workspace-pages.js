const WORKSPACE_PAGE_ROUTES = Object.freeze([
  "/dashboard",
  "/project/dashboard",
  "/project/platform-info",
  "/project/platform-settings",
  "/project/migration-center",
  "/data/new-shared-entity",
  "/data/shared-entities",
  "/processes/new-process-model",
  "/processes/process-models",
  "/templates",
  "/help/project-layout",
  "/help/build-run",
  "/help/check-updates",
  "/help/about",
]);

const LEGACY_REDIRECTS = Object.freeze({
  "/dashboard/overview": "/project/dashboard",
  "/dashboard/migration": "/project/migration-center",
  "/dashboard/platform": "/project/platform-settings",
  "/dashboard/templates": "/templates",
  "/dashboard/project-layout": "/help/project-layout",
  "/dashboard/process": "/processes/new-process-model",
  "/dashboard/process-design": "/processes/new-process-model",
  "/dashboard/process-operations": "/processes/process-models",
  "/dashboard/developer": "/help/build-run",
  "/dashboard/developer-commands": "/help/build-run",
});

function normalizeWorkspacePath(pathname) {
  return String(pathname || "").replace(/\/+$/, "") || "/";
}

const WORKSPACE_PAGE_ROUTE_SET = new Set(WORKSPACE_PAGE_ROUTES.map(normalizeWorkspacePath));

function isWorkspacePageRoute(pathname) {
  return WORKSPACE_PAGE_ROUTE_SET.has(normalizeWorkspacePath(pathname));
}

function resolveLegacyWorkspaceRedirect(pathname) {
  return LEGACY_REDIRECTS[normalizeWorkspacePath(pathname)] || "";
}

module.exports = {
  WORKSPACE_PAGE_ROUTES,
  LEGACY_REDIRECTS,
  normalizeWorkspacePath,
  isWorkspacePageRoute,
  resolveLegacyWorkspaceRedirect,
};
