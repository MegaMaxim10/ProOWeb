async function loadStatus() {
  const response = await fetch("/api/status");
  if (!response.ok) {
    throw new Error("Impossible de charger les metadonnees du workspace.");
  }
  return response.json();
}

function setFeedback(element, message, type) {
  element.textContent = message;
  element.className = `feedback ${type}`;
}

async function runMigration(feedback) {
  setFeedback(feedback, "Migration en cours...", "");

  const response = await fetch("/api/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "dashboard-action" }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Echec de la migration");
  }

  return data;
}

function renderWorkspace(status) {
  if (!status.initialized || !status.workspace) {
    window.location.replace("/");
    return;
  }

  const { workspace, management } = status;

  document.getElementById("project-title").textContent = workspace.project.title;
  document.getElementById(
    "stack-line",
  ).textContent = `Backend ${workspace.stack.backendTech} | Frontend web ${workspace.stack.frontendWebTech} | DB ${workspace.stack.databaseTech}`;

  const adminBlock = document.getElementById("admin-block");
  adminBlock.innerHTML = `
    <strong>Super administrateur:</strong><br />
    ${workspace.superAdmin.name} (${workspace.superAdmin.email})<br />
    Username: ${workspace.superAdmin.username}
  `;

  const swaggerConfig = workspace.backendOptions?.swaggerUi;
  const projectOptions = document.getElementById("project-options");
  projectOptions.innerHTML = `
    <strong>Options projet:</strong><br />
    Git remote: ${workspace.project.gitRepositoryUrl || "(aucun, .git supprime)"}<br />
    Swagger UI: ${swaggerConfig?.enabled ? "active" : "desactive"}<br />
    Profils Swagger: ${swaggerConfig?.profiles?.join(", ") || "aucun"}
  `;

  const managementLine = document.getElementById("management-line");
  managementLine.textContent = `Projet manag\u00e9 dans ${management.generatedRoot} | Version projet ${management.projectEditorVersion || management.editorVersion} | Version editeur ${management.editorVersion} | Fichiers suivis ${management.managedFilesCount}`;

  const migrateButton = document.getElementById("migrate-button");
  const migrateFeedback = document.getElementById("migrate-feedback");

  if (management.migrationRequired) {
    migrateButton.classList.remove("hidden");
    setFeedback(
      migrateFeedback,
      "Une migration est disponible pour aligner le projet avec la version courante de l'editeur.",
      "",
    );
  } else {
    migrateButton.classList.add("hidden");
    setFeedback(migrateFeedback, "Projet deja aligne avec la version editeur courante.", "success");
  }

  migrateButton.onclick = async () => {
    migrateButton.disabled = true;

    try {
      await runMigration(migrateFeedback);
      setFeedback(migrateFeedback, "Migration terminee avec succes. Rechargement...", "success");
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      setFeedback(migrateFeedback, error.message || "Erreur de migration.", "error");
      migrateButton.disabled = false;
    }
  };
}

loadStatus()
  .then(renderWorkspace)
  .catch((error) => {
    document.getElementById("project-title").textContent = "Erreur de chargement";
    document.getElementById("stack-line").textContent = error.message;
  });
