import { setFeedback } from "../shared/feedback.js";
import { bootstrapWizardPage } from "./bootstrap.js";

bootstrapWizardPage().catch((error) => {
  const feedback = document.getElementById("feedback");
  setFeedback(feedback, error.message || "Erreur de chargement.", "error");
});
