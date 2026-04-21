const { buildBackendPomXml } = require("./backend/springboot/buildBackendPomXml");
const { buildBackendApplicationJava } = require("./backend/springboot/buildBackendApplicationJava");
const { buildBackendTestJava } = require("./backend/springboot/buildBackendTestJava");
const { buildBackendApplicationYaml } = require("./backend/springboot/buildBackendApplicationYaml");
const { buildBackendSwaggerProfileYaml } = require("./backend/springboot/buildBackendSwaggerProfileYaml");
const { buildHexSystemDomainMarkerJava } = require("./backend/springboot/buildHexSystemDomainMarkerJava");
const { buildHexSystemMetadataModelJava } = require("./backend/springboot/buildHexSystemMetadataModelJava");
const { buildHexSystemHealthModelJava } = require("./backend/springboot/buildHexSystemHealthModelJava");
const { buildHexLoadSystemMetadataPortJava } = require("./backend/springboot/buildHexLoadSystemMetadataPortJava");
const { buildHexLoadSystemHealthPortJava } = require("./backend/springboot/buildHexLoadSystemHealthPortJava");
const { buildHexSystemApplicationMarkerJava } = require("./backend/springboot/buildHexSystemApplicationMarkerJava");
const { buildHexReadSystemMetadataUseCaseJava } = require("./backend/springboot/buildHexReadSystemMetadataUseCaseJava");
const { buildHexReadSystemHealthUseCaseJava } = require("./backend/springboot/buildHexReadSystemHealthUseCaseJava");
const { buildHexReadSystemMetadataServiceJava } = require("./backend/springboot/buildHexReadSystemMetadataServiceJava");
const { buildHexReadSystemHealthServiceJava } = require("./backend/springboot/buildHexReadSystemHealthServiceJava");
const { buildHexSystemInfrastructureMarkerJava } = require("./backend/springboot/buildHexSystemInfrastructureMarkerJava");
const { buildHexBackendCorsConfigJava } = require("./backend/springboot/buildHexBackendCorsConfigJava");
const { buildHexSystemModuleConfigJava } = require("./backend/springboot/buildHexSystemModuleConfigJava");
const { buildHexAppPropertiesSystemMetadataAdapterJava } = require("./backend/springboot/buildHexAppPropertiesSystemMetadataAdapterJava");
const { buildHexStaticSystemHealthAdapterJava } = require("./backend/springboot/buildHexStaticSystemHealthAdapterJava");
const { buildHexSystemMetadataControllerJava } = require("./backend/springboot/buildHexSystemMetadataControllerJava");
const { buildFrontendPackageJson } = require("./frontend/react/buildFrontendPackageJson");
const { buildFrontendIndexHtml } = require("./frontend/react/buildFrontendIndexHtml");
const { buildFrontendMainJsx } = require("./frontend/react/buildFrontendMainJsx");
const { buildFrontendSystemSnapshotModelJs } = require("./frontend/react/buildFrontendSystemSnapshotModelJs");
const { buildFrontendLoadSystemSnapshotPortJs } = require("./frontend/react/buildFrontendLoadSystemSnapshotPortJs");
const { buildFrontendReadSystemSnapshotUseCaseJs } = require("./frontend/react/buildFrontendReadSystemSnapshotUseCaseJs");
const { buildFrontendHttpSystemSnapshotAdapterJs } = require("./frontend/react/buildFrontendHttpSystemSnapshotAdapterJs");
const { buildFrontendUseSystemSnapshotHookJs } = require("./frontend/react/buildFrontendUseSystemSnapshotHookJs");
const { buildFrontendShellAppJsx } = require("./frontend/react/buildFrontendShellAppJsx");
const { buildFrontendCss } = require("./frontend/react/buildFrontendCss");
const { buildFrontendViteConfig } = require("./frontend/react/buildFrontendViteConfig");
const { buildComposeFile } = require("./deployment/docker/buildComposeFile");
const { buildBackendDockerfile } = require("./backend/springboot/buildBackendDockerfile");
const { buildFrontendDockerfile } = require("./frontend/react/buildFrontendDockerfile");
const { buildNginxConf } = require("./deployment/docker/buildNginxConf");
const { buildBuildAllPs1 } = require("./deployment/scripts/buildBuildAllPs1");
const { buildTestAllPs1 } = require("./deployment/scripts/buildTestAllPs1");
const { buildStartProfilePs1 } = require("./deployment/scripts/buildStartProfilePs1");
const { buildBuildAllSh } = require("./deployment/scripts/buildBuildAllSh");
const { buildTestAllSh } = require("./deployment/scripts/buildTestAllSh");
const { buildStartProfileSh } = require("./deployment/scripts/buildStartProfileSh");
const { resolveProjectRoot } = require("./workspace/resolveProjectRoot");
const { buildWorkspaceReadme } = require("./workspace/buildWorkspaceReadme");
const { buildManagedManifest } = require("./workspace/buildManagedManifest");

module.exports = {
  buildBackendPomXml,
  buildBackendApplicationJava,
  buildBackendTestJava,
  buildBackendApplicationYaml,
  buildBackendSwaggerProfileYaml,
  buildHexSystemDomainMarkerJava,
  buildHexSystemMetadataModelJava,
  buildHexSystemHealthModelJava,
  buildHexLoadSystemMetadataPortJava,
  buildHexLoadSystemHealthPortJava,
  buildHexSystemApplicationMarkerJava,
  buildHexReadSystemMetadataUseCaseJava,
  buildHexReadSystemHealthUseCaseJava,
  buildHexReadSystemMetadataServiceJava,
  buildHexReadSystemHealthServiceJava,
  buildHexSystemInfrastructureMarkerJava,
  buildHexBackendCorsConfigJava,
  buildHexSystemModuleConfigJava,
  buildHexAppPropertiesSystemMetadataAdapterJava,
  buildHexStaticSystemHealthAdapterJava,
  buildHexSystemMetadataControllerJava,
  buildFrontendPackageJson,
  buildFrontendIndexHtml,
  buildFrontendMainJsx,
  buildFrontendSystemSnapshotModelJs,
  buildFrontendLoadSystemSnapshotPortJs,
  buildFrontendReadSystemSnapshotUseCaseJs,
  buildFrontendHttpSystemSnapshotAdapterJs,
  buildFrontendUseSystemSnapshotHookJs,
  buildFrontendShellAppJsx,
  buildFrontendCss,
  buildFrontendViteConfig,
  buildComposeFile,
  buildBackendDockerfile,
  buildFrontendDockerfile,
  buildNginxConf,
  buildBuildAllPs1,
  buildTestAllPs1,
  buildStartProfilePs1,
  buildBuildAllSh,
  buildTestAllSh,
  buildStartProfileSh,
  resolveProjectRoot,
  buildWorkspaceReadme,
  buildManagedManifest,
};
