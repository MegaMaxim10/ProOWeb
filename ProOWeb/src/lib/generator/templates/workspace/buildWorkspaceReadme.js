function buildWorkspaceReadme(config, generatedRoot) {
  const displayedRoot = generatedRoot === "root" ? "." : generatedRoot;
  const activeFeaturePacks = Array.isArray(config?.featurePacks?.enabled)
    ? config.featurePacks.enabled
    : [];

  return `# Generated Workspace

This workspace was generated and managed by ProOWeb.

## Project
- Title: ${config.project.title}
- Slug: ${config.project.slug}
- Base package: ${config.project.basePackage || "com.prooweb.generated"}
- Generated root: ${displayedRoot}

## Stack
- Backend: ${config.stack.backendTech}
- Frontend (web): ${config.stack.frontendWebTech}
- Frontend (mobile): ${config.stack.frontendMobileTech}
- Database: ${config.stack.databaseTech}

## Generated architecture
- Backend: strict modular architecture inspired by Njangui:
  - gateway (request orchestration),
  - kernel (kernel-domain, kernel-application, kernel-infrastructure),
  - common (common-domain, common-application, common-infrastructure),
  - system (system-domain, system-application, system-infrastructure),
  - composition module (${config.project.slug}-application),
  - tests (test-support, vanilla-unit-tests/*-ut, *-it).
- Frontend: feature module system split into domain, application, infrastructure, ui.

## Backend options
- Swagger UI: ${config.backendOptions.swaggerUi.enabled ? "enabled" : "disabled"}
- Swagger profiles: ${config.backendOptions.swaggerUi.profiles.join(", ") || "none"}
- External IAM auth: ${config.backendOptions.externalIam?.enabled ? "enabled" : "disabled"}
- External IAM providers: ${Array.isArray(config.backendOptions.externalIam?.providers) && config.backendOptions.externalIam.providers.length > 0
    ? config.backendOptions.externalIam.providers.map((provider) => provider.id).join(", ")
    : "none"}
- Session/device security: ${config.backendOptions.sessionSecurity?.enabled ? "enabled" : "disabled"}
- Suspicious window (minutes): ${config.backendOptions.sessionSecurity?.suspiciousWindowMinutes || "60"}
- Max distinct devices in window: ${config.backendOptions.sessionSecurity?.maxDistinctDevices || "3"}
- Organization hierarchy: ${config.backendOptions.organizationHierarchy?.enabled ? "enabled" : "disabled"}
- Default assignment strategy: ${config.backendOptions.organizationHierarchy?.defaultAssignmentStrategy || "SUPERVISOR_THEN_ANCESTORS"}
- Max hierarchy traversal depth: ${config.backendOptions.organizationHierarchy?.maxTraversalDepth || "8"}

## Active feature packs
${activeFeaturePacks.length > 0 ? activeFeaturePacks.map((packId) => `- ${packId}`).join("\n") : "- none"}

## Workspace helper scripts (inside ${displayedRoot})
- Windows: build-all.ps1, test-all.ps1, verify-all.ps1, start-profile.ps1
- Linux: build-all.sh, test-all.sh, verify-all.sh, start-profile.sh

## NPM shortcuts (from repository root)
- npm run compile
- npm test
- npm run verify
- npm run start:dev
- npm run start:demo
- npm run start:test
- npm run start:preprod
- npm run start:prod
`;
}

module.exports = {
  buildWorkspaceReadme,
};
