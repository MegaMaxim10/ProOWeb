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

  if (page === "platform") {
    wireReconfigureForm({
      status,
      onReconfigure: runWorkspaceReconfiguration,
      documentRef,
      windowRef,
    });

    await wireTemplateOverridesPanel({
      status,
      onFetchTemplateOverrides: fetchTemplateOverrides,
      onSaveTemplateOverride: saveTemplateOverride,
      onDeleteTemplateOverride: deleteTemplateOverride,
      documentRef,
    });
  }

  if (page === "process") {
    await wireProcessModelingPanel({
      status,
      documentRef,
    });
  }
}
