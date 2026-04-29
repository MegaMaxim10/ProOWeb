import { bootstrapDashboardPage } from "./bootstrap.js";

bootstrapDashboardPage().catch((error) => {
  const title = document.getElementById("project-title");
  const stackLine = document.getElementById("stack-line");

  if (title) {
    title.textContent = "Workspace loading error";
  }

  if (stackLine) {
    stackLine.textContent = error.message || "Unable to load ProOWeb Studio.";
  }
});
