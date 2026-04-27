import { setFeedback } from "../shared/feedback.js";
import { fetchWorkspaceStatus, initializeWorkspace } from "./api.js";
import { extractWizardFormPayload } from "./form-payload.js";
import { wireExternalIamControls } from "./external-iam-controls.js";
import { wireOrganizationHierarchyControls } from "./organization-hierarchy-controls.js";
import { wireSessionSecurityControls } from "./session-security-controls.js";
import { wireSwaggerControls } from "./swagger-controls.js";

export async function bootstrapWizardPage({ documentRef = document, windowRef = window } = {}) {
  const status = await fetchWorkspaceStatus();

  if (status.initialized) {
    windowRef.location.replace("/");
    return;
  }

  const form = documentRef.getElementById("init-form");
  const feedback = documentRef.getElementById("feedback");
  const submitButton = documentRef.getElementById("submit-button");

  wireSwaggerControls(form);
  wireExternalIamControls(form);
  wireSessionSecurityControls(form);
  wireOrganizationHierarchyControls(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    setFeedback(feedback, "Initialisation du workspace en cours...");

    try {
      const payload = extractWizardFormPayload(form);
      await initializeWorkspace(payload);

      setFeedback(feedback, "Workspace initialise. Redirection vers le dashboard...", "success");
      windowRef.setTimeout(() => {
        windowRef.location.replace("/");
      }, 900);
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur inattendue.", "error");
      submitButton.disabled = false;
    }
  });
}
