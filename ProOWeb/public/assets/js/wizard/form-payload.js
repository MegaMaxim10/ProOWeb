export function extractWizardFormPayload(form) {
  const formData = new FormData(form);

  return {
    projectTitle: formData.get("projectTitle") || "",
    basePackage: formData.get("basePackage") || "",
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
    externalIamEnabled: formData.get("externalIamEnabled") === "on",
    externalIamProviderId: formData.get("externalIamProviderId") || "",
    externalIamIssuerUri: formData.get("externalIamIssuerUri") || "",
    externalIamClientId: formData.get("externalIamClientId") || "",
    externalIamClientSecret: formData.get("externalIamClientSecret") || "",
    externalIamSharedSecret: formData.get("externalIamSharedSecret") || "",
    externalIamUsernameClaim: formData.get("externalIamUsernameClaim") || "",
    externalIamEmailClaim: formData.get("externalIamEmailClaim") || "",
  };
}
