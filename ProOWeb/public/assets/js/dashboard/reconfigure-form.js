import { setFeedback } from "../shared/feedback.js";
import { extractWizardFormPayload } from "../wizard/form-payload.js";
import { wireExternalIamControls } from "../wizard/external-iam-controls.js";
import { wireLiquibaseControls } from "../wizard/liquibase-controls.js";
import { wireNotificationsControls } from "../wizard/notifications-controls.js";
import { wireOrganizationHierarchyControls } from "../wizard/organization-hierarchy-controls.js";
import { wireProcessModelingControls } from "../wizard/process-modeling-controls.js";
import { wireSessionSecurityControls } from "../wizard/session-security-controls.js";
import { wireSwaggerControls } from "../wizard/swagger-controls.js";
import { buildDetailedMigrationReport, buildMigrationSummary } from "./formatters.js";

function setInputValue(form, name, value) {
  const input = form.querySelector(`[name="${name}"]`);
  if (!input) {
    return;
  }

  input.value = value == null ? "" : String(value);
}

function setCheckboxValue(form, name, checked) {
  const input = form.querySelector(`[name="${name}"]`);
  if (!input) {
    return;
  }

  input.checked = Boolean(checked);
}

function setCheckboxGroupValue(form, name, values) {
  const entries = Array.isArray(values) ? values.map((entry) => String(entry).toLowerCase()) : [];
  const checkboxes = form.querySelectorAll(`input[type="checkbox"][name="${name}"]`);

  for (const checkbox of checkboxes) {
    checkbox.checked = entries.includes(String(checkbox.value || "").toLowerCase());
  }
}

function buildReconfigurePayload(form) {
  const payload = extractWizardFormPayload(form);
  const modeValue = String(new FormData(form).get("mode") || "full").toLowerCase();

  return {
    ...payload,
    mode: modeValue === "infra" ? "infra" : "full",
    reason: "dashboard-reconfigure",
  };
}

function initializeFormValues(form, workspace) {
  const backendOptions = workspace?.backendOptions || {};
  const swagger = backendOptions.swaggerUi || {};
  const externalIam = backendOptions.externalIam || {};
  const provider = Array.isArray(externalIam.providers) && externalIam.providers.length > 0
    ? externalIam.providers[0]
    : {};
  const sessionSecurity = backendOptions.sessionSecurity || {};
  const organizationHierarchy = backendOptions.organizationHierarchy || {};
  const notifications = backendOptions.notifications || {};
  const databaseMigration = backendOptions.databaseMigration || {};
  const processModeling = backendOptions.processModeling || {};

  setInputValue(form, "basePackage", workspace?.project?.basePackage || "com.prooweb.generated");
  setInputValue(form, "mode", "full");

  setCheckboxValue(form, "swaggerUiEnabled", swagger.enabled);
  setCheckboxGroupValue(form, "swaggerProfiles", swagger.profiles || []);

  setCheckboxValue(form, "externalIamEnabled", externalIam.enabled);
  setInputValue(form, "externalIamProviderId", provider.id || "corporate-oidc");
  setInputValue(form, "externalIamIssuerUri", provider.issuerUri || "");
  setInputValue(form, "externalIamClientId", provider.clientId || "");
  setInputValue(form, "externalIamClientSecret", "");
  setInputValue(form, "externalIamSharedSecret", "");
  setInputValue(form, "externalIamUsernameClaim", provider.usernameClaim || "preferred_username");
  setInputValue(form, "externalIamEmailClaim", provider.emailClaim || "email");

  setCheckboxValue(form, "sessionSecurityEnabled", sessionSecurity.enabled);
  setInputValue(form, "sessionSecurityWindowMinutes", sessionSecurity.suspiciousWindowMinutes || 60);
  setInputValue(form, "sessionSecurityMaxDistinctDevices", sessionSecurity.maxDistinctDevices || 3);

  setCheckboxValue(form, "organizationHierarchyEnabled", organizationHierarchy.enabled !== false);
  setInputValue(
    form,
    "organizationDefaultAssignmentStrategy",
    organizationHierarchy.defaultAssignmentStrategy || "SUPERVISOR_THEN_ANCESTORS",
  );
  setInputValue(form, "organizationMaxTraversalDepth", organizationHierarchy.maxTraversalDepth || 8);

  setCheckboxValue(form, "notificationsEnabled", notifications.enabled !== false);
  setInputValue(form, "notificationsSenderAddress", notifications.senderAddress || "no-reply@prooweb.local");
  setCheckboxValue(form, "notificationsAuditEnabled", notifications.auditEnabled !== false);

  setCheckboxValue(form, "liquibaseEnabled", databaseMigration.liquibaseEnabled !== false);
  setInputValue(
    form,
    "liquibaseChangelogPath",
    databaseMigration.changelogPath || "classpath:db/changelog/db.changelog-master.yaml",
  );
  setInputValue(form, "liquibaseContexts", databaseMigration.contexts || "baseline,reference-data");

  setCheckboxValue(form, "processModelingEnabled", processModeling.enabled !== false);
  setInputValue(form, "processVersioningStrategy", processModeling.versioningStrategy || "LINEAR");
  setInputValue(form, "processMaxVersionsPerModel", processModeling.maxVersionsPerModel || 50);
  setCheckboxValue(form, "processAllowDirectDeployment", Boolean(processModeling.allowDirectDeployment));
}

function wireControls(form) {
  wireSwaggerControls(form);
  wireExternalIamControls(form);
  wireSessionSecurityControls(form);
  wireOrganizationHierarchyControls(form);
  wireNotificationsControls(form);
  wireLiquibaseControls(form);
  wireProcessModelingControls(form);
}

function renderReport(container, migration) {
  if (!container) {
    return;
  }

  container.textContent = buildDetailedMigrationReport(migration);
}

export function wireReconfigureForm({ status, onReconfigure, documentRef = document, windowRef = window }) {
  if (!status?.initialized || !status?.workspace) {
    return;
  }

  const form = documentRef.getElementById("reconfigure-form");
  const submitButton = documentRef.getElementById("reconfigure-button");
  const feedback = documentRef.getElementById("reconfigure-feedback");
  const report = documentRef.getElementById("reconfigure-report");

  if (!form || !submitButton || !feedback || !report) {
    return;
  }

  initializeFormValues(form, status.workspace);
  wireControls(form);
  renderReport(report, null);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setFeedback(feedback, "Applying reconfiguration and smart migration...");

    try {
      const payload = buildReconfigurePayload(form);
      const result = await onReconfigure(payload);
      setFeedback(feedback, buildMigrationSummary(result.migration), "success");
      renderReport(report, result.migration);

      windowRef.setTimeout(() => {
        windowRef.location.reload();
      }, 1200);
    } catch (error) {
      setFeedback(feedback, error.message || "Reconfiguration failed.", "error");
      submitButton.disabled = false;
    }
  });
}
