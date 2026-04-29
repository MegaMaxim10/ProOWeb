import {
  fetchWorkspaceStatus,
  runWorkspaceMigration,
  runWorkspaceReconfiguration,
  fetchTemplateOverrides,
  saveTemplateOverride,
  deleteTemplateOverride,
} from "./api.js";
import { wireProcessModelingPanel } from "./process-modeling-panel.js";
import { wireReconfigureForm } from "./reconfigure-form.js";
import { wireTemplateOverridesPanel } from "./template-overrides-panel.js";
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

  await wireTemplateOverridesPanel({
    status,
    onFetchTemplateOverrides: fetchTemplateOverrides,
    onSaveTemplateOverride: saveTemplateOverride,
    onDeleteTemplateOverride: deleteTemplateOverride,
    documentRef,
  });

  await wireProcessModelingPanel({
    status,
    documentRef,
  });
}
