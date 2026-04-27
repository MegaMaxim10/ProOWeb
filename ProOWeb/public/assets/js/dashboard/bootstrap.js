import { fetchWorkspaceStatus, runWorkspaceMigration, runWorkspaceReconfiguration } from "./api.js";
import { wireReconfigureForm } from "./reconfigure-form.js";
import { renderWorkspaceStatus } from "./render.js";

export async function bootstrapDashboardPage({ documentRef = document } = {}) {
  const status = await fetchWorkspaceStatus();

  renderWorkspaceStatus({
    status,
    onMigrate: runWorkspaceMigration,
    documentRef,
  });

  wireReconfigureForm({
    status,
    onReconfigure: runWorkspaceReconfiguration,
    documentRef,
  });
}
