async function fetchStatus() {
  const response = await fetch("/api/status");
  if (!response.ok) {
    throw new Error("Impossible de lire le statut du workspace");
  }
  return response.json();
}

function setFeedback(element, message, type) {
  element.textContent = message;
  element.className = `feedback ${type}`;
}

function extractFormPayload(form) {
  const formData = new FormData(form);

  return {
    projectTitle: formData.get("projectTitle") || "",
    gitRepositoryUrl: formData.get("gitRepositoryUrl") || "",
    backendTech: formData.get("backendTech") || "springboot",
    frontendWebTech: formData.get("frontendWebTech") || "react",
    frontendMobileTech: formData.get("frontendMobileTech") || "none",
    databaseTech: formData.get("databaseTech") || "postgresql",
    superAdminName: formData.get("superAdminName") || "",
    superAdminEmail: formData.get("superAdminEmail") || "",
    superAdminUsername: formData.get("superAdminUsername") || "",
    superAdminPassword: formData.get("superAdminPassword") || "",
    swaggerUiEnabled: formData.get("swaggerUiEnabled") === "on",
    swaggerProfiles: formData.getAll("swaggerProfiles"),
  };
}

function wireSwaggerControls(form) {
  const toggle = form.querySelector("#swagger-toggle");
  const profileInputs = Array.from(form.querySelectorAll('input[name="swaggerProfiles"]'));

  function sync() {
    const enabled = Boolean(toggle?.checked);
    for (const input of profileInputs) {
      input.disabled = !enabled;
      if (!enabled) {
        input.checked = false;
      }
    }
  }

  toggle?.addEventListener("change", sync);
  sync();
}

async function bootstrapWizard() {
  const status = await fetchStatus();
  if (status.initialized) {
    window.location.replace("/");
    return;
  }

  const form = document.getElementById("init-form");
  const feedback = document.getElementById("feedback");
  const submitButton = document.getElementById("submit-button");

  wireSwaggerControls(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    setFeedback(feedback, "Initialisation du workspace en cours...", "");

    const payload = extractFormPayload(form);

    try {
      const response = await fetch("/api/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Echec de l'initialisation.");
      }

      setFeedback(feedback, "Workspace initialise. Redirection vers le dashboard...", "success");
      window.setTimeout(() => {
        window.location.replace("/");
      }, 900);
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur inattendue.", "error");
      submitButton.disabled = false;
    }
  });
}

bootstrapWizard().catch((error) => {
  const feedback = document.getElementById("feedback");
  if (feedback) {
    setFeedback(feedback, error.message || "Erreur de chargement.", "error");
  }
});
