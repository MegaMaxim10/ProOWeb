import { setFeedback } from "../shared/feedback.js";
import { buildMigrationSummary, describeGeneratedRoot } from "./formatters.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDefinitionList(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length === 0) {
    return "<p class=\"muted\">No data available.</p>";
  }

  return [
    "<dl class=\"definition-grid\">",
    ...safeEntries.map((entry) => `<dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd>`),
    "</dl>",
  ].join("");
}

export function renderWorkspaceStatus({ status, onMigrate, windowRef = window, documentRef = document }) {
  if (!status.initialized || !status.workspace) {
    windowRef.location.replace("/");
    return;
  }

  const workspace = status.workspace;
  const management = status.management;
  const templateCustomizationSummary = status.templateCustomization?.summary || {};
  const featurePacks = Array.isArray(management.activeFeaturePacks) ? management.activeFeaturePacks : [];

  documentRef.getElementById("project-title").textContent = workspace.project.title;
  documentRef.getElementById("stack-line").textContent =
    "Backend " + workspace.stack.backendTech +
    " | Web frontend " + workspace.stack.frontendWebTech +
    " | Database " + workspace.stack.databaseTech;

  const adminBlock = documentRef.getElementById("admin-block");
  adminBlock.innerHTML = [
    "<h3>Workspace Administrator</h3>",
    renderDefinitionList([
      { label: "Name", value: workspace.superAdmin.name },
      { label: "Email", value: workspace.superAdmin.email },
      { label: "Username", value: workspace.superAdmin.username },
    ]),
  ].join("");

  const swaggerConfig = workspace.backendOptions?.swaggerUi;
  const externalIamConfig = workspace.backendOptions?.externalIam;
  const sessionSecurityConfig = workspace.backendOptions?.sessionSecurity;
  const organizationHierarchyConfig = workspace.backendOptions?.organizationHierarchy;
  const notificationsConfig = workspace.backendOptions?.notifications;
  const databaseMigrationConfig = workspace.backendOptions?.databaseMigration;
  const processModelingConfig = workspace.backendOptions?.processModeling;
  const testAutomationConfig = workspace.backendOptions?.testAutomation;
  const externalProviderIds = Array.isArray(externalIamConfig?.providers)
    ? externalIamConfig.providers.map((provider) => provider.id).filter(Boolean)
    : [];
  const projectOptions = documentRef.getElementById("project-options");
  projectOptions.innerHTML = [
    "<h3>Project Configuration Snapshot</h3>",
    renderDefinitionList([
      { label: "Base package", value: workspace.project.basePackage || "com.prooweb.generated" },
      { label: "Git remote", value: workspace.project.gitRepositoryUrl || "(none, repository removed)" },
      { label: "Swagger UI", value: swaggerConfig?.enabled ? "enabled" : "disabled" },
      { label: "Swagger profiles", value: swaggerConfig?.profiles?.join(", ") || "-" },
      { label: "External IAM", value: externalIamConfig?.enabled ? "enabled" : "disabled" },
      { label: "IAM providers", value: externalProviderIds.join(", ") || "-" },
      { label: "Session security", value: sessionSecurityConfig?.enabled ? "enabled" : "disabled" },
      { label: "Risk window (min)", value: sessionSecurityConfig?.suspiciousWindowMinutes || "-" },
      { label: "Max devices/window", value: sessionSecurityConfig?.maxDistinctDevices || "-" },
      { label: "Organization hierarchy", value: organizationHierarchyConfig?.enabled ? "enabled" : "disabled" },
      { label: "Default assignment strategy", value: organizationHierarchyConfig?.defaultAssignmentStrategy || "-" },
      { label: "Max hierarchy depth", value: organizationHierarchyConfig?.maxTraversalDepth || "-" },
      { label: "Notifications", value: notificationsConfig?.enabled ? "enabled" : "disabled" },
      { label: "Notification sender", value: notificationsConfig?.senderAddress || "-" },
      { label: "Notification audit", value: notificationsConfig?.auditEnabled ? "enabled" : "disabled" },
      { label: "Liquibase", value: databaseMigrationConfig?.liquibaseEnabled ? "enabled" : "disabled" },
      { label: "Liquibase changelog", value: databaseMigrationConfig?.changelogPath || "-" },
      { label: "Liquibase contexts", value: databaseMigrationConfig?.contexts || "-" },
      { label: "Process catalog", value: processModelingConfig?.enabled ? "enabled" : "disabled" },
      { label: "Process versioning strategy", value: processModelingConfig?.versioningStrategy || "-" },
      { label: "Max versions/model", value: processModelingConfig?.maxVersionsPerModel || "-" },
      { label: "Direct deployment from draft", value: processModelingConfig?.allowDirectDeployment ? "enabled" : "disabled" },
      { label: "Backend BDD (Cucumber)", value: testAutomationConfig?.backendBddCucumberEnabled ? "enabled" : "disabled" },
      { label: "Frontend E2E (Cypress)", value: testAutomationConfig?.frontendE2eCypressEnabled ? "enabled" : "disabled" },
      { label: "Feature packs", value: featurePacks.join(", ") || "-" },
    ]),
  ].join("");

  const managedFilesKpi = documentRef.getElementById("kpi-managed-files");
  const featurePacksKpi = documentRef.getElementById("kpi-feature-packs");
  const templateOverridesKpi = documentRef.getElementById("kpi-template-overrides");
  if (managedFilesKpi) {
    managedFilesKpi.textContent = String(Number(management.managedFilesCount || 0));
  }
  if (featurePacksKpi) {
    featurePacksKpi.textContent = String(Number(management.activeFeaturePackCount || 0));
  }
  if (templateOverridesKpi) {
    templateOverridesKpi.textContent = String(Number(templateCustomizationSummary.total || 0));
  }

  const managementLine = documentRef.getElementById("management-line");
  managementLine.textContent =
    "Managed root: " + describeGeneratedRoot(management.generatedRoot) +
    " | Project editor version: " + (management.projectEditorVersion || management.editorVersion) +
    " | Current editor version: " + management.editorVersion +
    " | Tracked files: " + management.managedFilesCount +
    " | Template overrides: " + Number(templateCustomizationSummary.total || 0);

  const migrateButton = documentRef.getElementById("migrate-button");
  const migrateFeedback = documentRef.getElementById("migrate-feedback");

  if (management.migrationRequired) {
    migrateButton.classList.remove("hidden");
    setFeedback(
      migrateFeedback,
      "A smart migration is available to align this workspace with the current editor version.",
    );
  } else {
    migrateButton.classList.add("hidden");
    setFeedback(migrateFeedback, "Workspace is already aligned with the current editor version.", "success");
  }

  migrateButton.onclick = async () => {
    migrateButton.disabled = true;

    try {
      const migrationResponse = await onMigrate();
      const summaryLine = buildMigrationSummary(migrationResponse.migration);
      const backupLine = migrationResponse?.migration?.backupRoot
        ? " | backups: " + migrationResponse.migration.backupRoot
        : "";

      setFeedback(migrateFeedback, summaryLine + backupLine, "success");
      windowRef.setTimeout(() => {
        windowRef.location.reload();
      }, 1100);
    } catch (error) {
      setFeedback(migrateFeedback, error.message || "Migration failed.", "error");
      migrateButton.disabled = false;
    }
  };
}
