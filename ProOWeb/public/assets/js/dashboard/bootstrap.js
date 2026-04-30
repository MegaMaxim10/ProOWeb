import {
  fetchWorkspaceStatus,
  runWorkspaceMigration,
  runWorkspaceReconfiguration,
  fetchTemplateOverrides,
  saveTemplateOverride,
  deleteTemplateOverride,
} from "./api.js";
import { applyWorkspaceUxHints } from "../shared/ux-hints.js";
import { initializeTheme } from "../shared/theme.js";
import { wireProcessModelingPanel } from "./process-modeling-panel.js";
import { wireReconfigureForm } from "./reconfigure-form.js";
import { wireTemplateOverridesPanel } from "./template-overrides-panel.js";
import { renderWorkspaceStatus } from "./render.js";
import { resolveWorkspacePage, wireWorkspaceShell } from "./workspace-shell.js";
import { initializeWorkspacePageModules } from "./page-modules.js";

export async function bootstrapDashboardPage({ documentRef = document, windowRef = window } = {}) {
  initializeTheme({ documentRef, windowRef });
  applyWorkspaceUxHints({ documentRef });
  wireWorkspaceShell({ documentRef, windowRef });
  const page = resolveWorkspacePage(windowRef);

  const status = await fetchWorkspaceStatus();

  renderWorkspaceStatus({
    status,
    onMigrate: runWorkspaceMigration,
    documentRef,
  });

  await initializeWorkspacePageModules({
    page,
    status,
    documentRef,
    windowRef,
    dependencies: {
      wireReconfigureForm,
      wireTemplateOverridesPanel,
      wireProcessModelingPanel,
      runWorkspaceReconfiguration,
      fetchTemplateOverrides,
      saveTemplateOverride,
      deleteTemplateOverride,
    },
  });
}
