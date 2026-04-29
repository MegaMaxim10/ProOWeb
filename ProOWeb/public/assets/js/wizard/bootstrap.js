import { setFeedback } from "../shared/feedback.js";
import { fetchWorkspaceStatus, initializeWorkspace } from "./api.js";
import { createWizardAutosave } from "./autosave.js";
import { createWizardBreadcrumbs } from "./breadcrumbs.js";
import { extractWizardFormPayload } from "./form-payload.js";
import { wireExternalIamControls } from "./external-iam-controls.js";
import { wireLiquibaseControls } from "./liquibase-controls.js";
import { wireNotificationsControls } from "./notifications-controls.js";
import { wireOrganizationHierarchyControls } from "./organization-hierarchy-controls.js";
import { wireProcessModelingControls } from "./process-modeling-controls.js";
import { wireSessionSecurityControls } from "./session-security-controls.js";
import { wireSwaggerControls } from "./swagger-controls.js";
import { createWizardStepper } from "./stepper.js";

export async function bootstrapWizardPage({ documentRef = document, windowRef = window } = {}) {
  const status = await fetchWorkspaceStatus();

  if (status.initialized) {
    windowRef.location.replace("/");
    return;
  }

  const form = documentRef.getElementById("init-form");
  const feedback = documentRef.getElementById("feedback");
  const submitButton = documentRef.getElementById("submit-button");
  const trackElement = documentRef.getElementById("wizard-step-track");
  const breadcrumbs = createWizardBreadcrumbs({
    container: documentRef.getElementById("wizard-breadcrumbs"),
  });
  const autosave = createWizardAutosave({
    form,
    trackElement,
    indicatorElement: documentRef.getElementById("wizard-autosave-indicator"),
    windowRef,
  });
  const stepper = createWizardStepper({
    form,
    trackElement,
    progressLabel: documentRef.getElementById("wizard-progress-label"),
    previousButton: documentRef.getElementById("previous-step-button"),
    nextButton: documentRef.getElementById("next-step-button"),
    submitButton,
    onStepChange: (stepState) => {
      breadcrumbs.render(stepState);
      autosave.setCurrentStep(stepState.currentStepIndex);
    },
  });

  wireSwaggerControls(form);
  wireExternalIamControls(form);
  wireSessionSecurityControls(form);
  wireOrganizationHierarchyControls(form);
  wireNotificationsControls(form);
  wireLiquibaseControls(form);
  wireProcessModelingControls(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!stepper.validateAllSteps()) {
      return;
    }
    autosave.flush();

    submitButton.disabled = true;
    setFeedback(feedback, "Initializing workspace...");

    try {
      const payload = extractWizardFormPayload(form);
      await initializeWorkspace(payload);
      autosave.clear();

      setFeedback(feedback, "Workspace initialized. Redirecting to studio...", "success");
      windowRef.setTimeout(() => {
        windowRef.location.replace("/");
      }, 900);
    } catch (error) {
      setFeedback(feedback, error.message || "Unexpected initialization error.", "error");
      submitButton.disabled = false;
    }
  });
}
