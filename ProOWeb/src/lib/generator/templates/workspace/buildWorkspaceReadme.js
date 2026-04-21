function buildWorkspaceReadme(config, generatedRoot) {
  const displayedRoot = generatedRoot === "root" ? "." : generatedRoot;

  return `# Generated Workspace

This workspace was generated and managed by ProOWeb.

## Project
- Title: ${config.project.title}
- Slug: ${config.project.slug}
- Generated root: ${displayedRoot}

## Stack
- Backend: ${config.stack.backendTech}
- Frontend (web): ${config.stack.frontendWebTech}
- Frontend (mobile): ${config.stack.frontendMobileTech}
- Database: ${config.stack.databaseTech}

## Generated architecture
- Backend: modular hexagonal architecture (system/domain, system/application, system/infrastructure).
- Frontend: feature module system split into domain, application, infrastructure, ui.

## Backend options
- Swagger UI: ${config.backendOptions.swaggerUi.enabled ? "enabled" : "disabled"}
- Swagger profiles: ${config.backendOptions.swaggerUi.profiles.join(", ") || "none"}

## Workspace helper scripts (inside ${displayedRoot})
- Windows: build-all.ps1, test-all.ps1, start-profile.ps1
- Linux: build-all.sh, test-all.sh, start-profile.sh

## NPM shortcuts (from repository root)
- npm run compile
- npm test
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
