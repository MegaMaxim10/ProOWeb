import { bootstrapDashboardPage } from "./bootstrap.js";

bootstrapDashboardPage().catch((error) => {
  const title = document.getElementById("project-title");
  const stackLine = document.getElementById("stack-line");

  if (title) {
    title.textContent = "Erreur de chargement";
  }

  if (stackLine) {
    stackLine.textContent = error.message || "Impossible de charger le dashboard.";
  }
});
