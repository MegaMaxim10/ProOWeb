import { fetchWorkspaceStatus, runWorkspaceMigration } from "./api.js";
import { renderWorkspaceStatus } from "./render.js";

export async function bootstrapDashboardPage({ documentRef = document } = {}) {
  const status = await fetchWorkspaceStatus();

  renderWorkspaceStatus({
    status,
    onMigrate: runWorkspaceMigration,
    documentRef,
  });
}
