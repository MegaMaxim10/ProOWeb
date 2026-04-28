import { setFeedback } from "../shared/feedback.js";
import { buildMigrationSummary, describeGeneratedRoot } from "./formatters.js";

export function renderWorkspaceStatus({ status, onMigrate, windowRef = window, documentRef = document }) {
  if (!status.initialized || !status.workspace) {
    windowRef.location.replace("/");
    return;
  }

  const workspace = status.workspace;
  const management = status.management;

  documentRef.getElementById("project-title").textContent = workspace.project.title;
  documentRef.getElementById("stack-line").textContent =
    "Backend " + workspace.stack.backendTech +
    " | Frontend web " + workspace.stack.frontendWebTech +
    " | DB " + workspace.stack.databaseTech;

  const adminBlock = documentRef.getElementById("admin-block");
  adminBlock.innerHTML =
    "<strong>Super administrateur:</strong><br />" +
    workspace.superAdmin.name + " (" + workspace.superAdmin.email + ")<br />" +
    "Username: " + workspace.superAdmin.username;

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
  projectOptions.innerHTML =
    "<strong>Options projet:</strong><br />" +
    "Base package: " + (workspace.project.basePackage || "com.prooweb.generated") + "<br />" +
    "Git remote: " + (workspace.project.gitRepositoryUrl || "(aucun, .git supprime)") + "<br />" +
    "Swagger UI: " + (swaggerConfig?.enabled ? "active" : "desactive") + "<br />" +
    "Profils Swagger: " + (swaggerConfig?.profiles?.join(", ") || "aucun") + "<br />" +
    "External IAM: " + (externalIamConfig?.enabled ? "active" : "desactive") + "<br />" +
    "Providers IAM: " + (externalProviderIds.join(", ") || "aucun") + "<br />" +
    "Session security: " + (sessionSecurityConfig?.enabled ? "active" : "desactive") + "<br />" +
    "Risk window (min): " + (sessionSecurityConfig?.suspiciousWindowMinutes || "-") + "<br />" +
    "Max devices/window: " + (sessionSecurityConfig?.maxDistinctDevices || "-") + "<br />" +
    "Organization hierarchy: " + (organizationHierarchyConfig?.enabled ? "active" : "desactive") + "<br />" +
    "Default assignment strategy: " + (organizationHierarchyConfig?.defaultAssignmentStrategy || "-") + "<br />" +
    "Max hierarchy depth: " + (organizationHierarchyConfig?.maxTraversalDepth || "-") + "<br />" +
    "Notifications: " + (notificationsConfig?.enabled ? "active" : "desactive") + "<br />" +
    "Notification sender: " + (notificationsConfig?.senderAddress || "-") + "<br />" +
    "Notification audit: " + (notificationsConfig?.auditEnabled ? "active" : "desactive") + "<br />" +
    "Liquibase: " + (databaseMigrationConfig?.liquibaseEnabled ? "active" : "desactive") + "<br />" +
    "Liquibase changelog: " + (databaseMigrationConfig?.changelogPath || "-") + "<br />" +
    "Liquibase contexts: " + (databaseMigrationConfig?.contexts || "-") + "<br />" +
    "ProOWeb process catalog: " + (processModelingConfig?.enabled ? "active" : "desactive") + "<br />" +
    "Process versioning strategy: " + (processModelingConfig?.versioningStrategy || "-") + "<br />" +
    "Process max versions/model: " + (processModelingConfig?.maxVersionsPerModel || "-") + "<br />" +
    "Direct deployment from draft: " + (processModelingConfig?.allowDirectDeployment ? "active" : "desactive") + "<br />" +
    "Backend BDD (Cucumber): " + (testAutomationConfig?.backendBddCucumberEnabled ? "active" : "desactive") + "<br />" +
    "Frontend E2E (Cypress): " + (testAutomationConfig?.frontendE2eCypressEnabled ? "active" : "desactive");

  const managementLine = documentRef.getElementById("management-line");
  managementLine.textContent =
    "Projet manage dans " + describeGeneratedRoot(management.generatedRoot) +
    " | Version projet " + (management.projectEditorVersion || management.editorVersion) +
    " | Version editeur " + management.editorVersion +
    " | Fichiers suivis " + management.managedFilesCount;

  const migrateButton = documentRef.getElementById("migrate-button");
  const migrateFeedback = documentRef.getElementById("migrate-feedback");

  if (management.migrationRequired) {
    migrateButton.classList.remove("hidden");
    setFeedback(
      migrateFeedback,
      "Une migration est disponible pour aligner le projet avec la version courante de l'editeur.",
    );
  } else {
    migrateButton.classList.add("hidden");
    setFeedback(migrateFeedback, "Projet deja aligne avec la version editeur courante.", "success");
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
      setFeedback(migrateFeedback, error.message || "Erreur de migration.", "error");
      migrateButton.disabled = false;
    }
  };
}
