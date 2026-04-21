export function extractWizardFormPayload(form) {
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
