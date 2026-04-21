const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PROFILE_PORTS = {
  dev: { backend: 8080, frontend: 3000, database: 5432 },
  demo: { backend: 8180, frontend: 3100, database: 5532 },
  test: { backend: 8280, frontend: 3200, database: 5632 },
  preprod: { backend: 8380, frontend: 3300, database: 5732 },
  prod: { backend: 8480, frontend: 3400, database: 5832 },
};

function ensureExecutable(targetPath) {
  try {
    fs.chmodSync(targetPath, 0o755);
  } catch (_) {
    // noop on environments where chmod is not relevant
  }
}

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function makeWriter(rootDir, registry) {
  const resolvedRoot = path.resolve(rootDir);

  return function writeManagedFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf8");

    const relativePath = toPosixPath(path.relative(resolvedRoot, targetPath));
    registry.push({
      path: relativePath,
      sha256: hashContent(content),
    });
  };
}

const {
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
} = require("./generator/templates");

function generateApplicationScaffold(projectRoot, config, writeManagedFile) {
  const backendRoot = path.join(projectRoot, "src/backend/springboot");
  const frontendRoot = path.join(projectRoot, "src/frontend/web/react");
  const mobileRoot = path.join(projectRoot, "src/frontend/mobile");

  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;

  writeManagedFile(
    path.join(backendRoot, "pom.xml"),
    buildBackendPomXml(config.project.title, config.project.slug, swaggerEnabled),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/ProowebApplication.java"),
    buildBackendApplicationJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/domain/SystemDomainMarker.java"),
    buildHexSystemDomainMarkerJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/domain/model/SystemMetadata.java"),
    buildHexSystemMetadataModelJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/domain/model/SystemHealth.java"),
    buildHexSystemHealthModelJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/domain/port/out/LoadSystemMetadataPort.java"),
    buildHexLoadSystemMetadataPortJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/domain/port/out/LoadSystemHealthPort.java"),
    buildHexLoadSystemHealthPortJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/application/SystemApplicationMarker.java"),
    buildHexSystemApplicationMarkerJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/application/port/in/ReadSystemMetadataUseCase.java"),
    buildHexReadSystemMetadataUseCaseJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/application/port/in/ReadSystemHealthUseCase.java"),
    buildHexReadSystemHealthUseCaseJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/application/service/ReadSystemMetadataService.java"),
    buildHexReadSystemMetadataServiceJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/application/service/ReadSystemHealthService.java"),
    buildHexReadSystemHealthServiceJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/infrastructure/SystemInfrastructureMarker.java"),
    buildHexSystemInfrastructureMarkerJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/infrastructure/config/BackendCorsConfig.java"),
    buildHexBackendCorsConfigJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/system/infrastructure/config/SystemModuleConfig.java"),
    buildHexSystemModuleConfigJava(),
  );
  writeManagedFile(
    path.join(
      backendRoot,
      "src/main/java/com/prooweb/generated/system/infrastructure/adapter/out/config/AppPropertiesSystemMetadataAdapter.java",
    ),
    buildHexAppPropertiesSystemMetadataAdapterJava(),
  );
  writeManagedFile(
    path.join(
      backendRoot,
      "src/main/java/com/prooweb/generated/system/infrastructure/adapter/out/health/StaticSystemHealthAdapter.java",
    ),
    buildHexStaticSystemHealthAdapterJava(),
  );
  writeManagedFile(
    path.join(
      backendRoot,
      "src/main/java/com/prooweb/generated/system/infrastructure/adapter/in/api/SystemMetadataController.java",
    ),
    buildHexSystemMetadataControllerJava(),
  );
  writeManagedFile(path.join(backendRoot, "src/main/resources/application.yml"), buildBackendApplicationYaml(config));

  for (const swaggerProfile of config.backendOptions.swaggerUi.profiles) {
    writeManagedFile(
      path.join(backendRoot, `src/main/resources/application-${swaggerProfile}.yml`),
      buildBackendSwaggerProfileYaml(),
    );
  }

  writeManagedFile(
    path.join(backendRoot, "src/test/java/com/prooweb/generated/ProowebApplicationTests.java"),
    buildBackendTestJava(),
  );

  writeManagedFile(path.join(frontendRoot, "package.json"), buildFrontendPackageJson(config.project.slug));
  writeManagedFile(path.join(frontendRoot, "index.html"), buildFrontendIndexHtml());
  writeManagedFile(path.join(frontendRoot, "src/main.jsx"), buildFrontendMainJsx());
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/domain/model/SystemSnapshot.js"),
    buildFrontendSystemSnapshotModelJs(config.project.title),
  );
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/domain/port/out/LoadSystemSnapshotPort.js"),
    buildFrontendLoadSystemSnapshotPortJs(),
  );
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/application/usecase/ReadSystemSnapshot.js"),
    buildFrontendReadSystemSnapshotUseCaseJs(),
  );
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/infrastructure/adapter/out/http/HttpSystemSnapshotAdapter.js"),
    buildFrontendHttpSystemSnapshotAdapterJs(),
  );
  writeManagedFile(path.join(frontendRoot, "src/modules/system/ui/useSystemSnapshot.js"), buildFrontendUseSystemSnapshotHookJs());
  writeManagedFile(path.join(frontendRoot, "src/modules/system/ui/ShellApp.jsx"), buildFrontendShellAppJsx());
  writeManagedFile(path.join(frontendRoot, "src/shared/ui/app-shell.css"), buildFrontendCss());
  writeManagedFile(path.join(frontendRoot, "vite.config.js"), buildFrontendViteConfig());

  writeManagedFile(
    path.join(mobileRoot, "README.md"),
    "Mobile frontend generation is not enabled yet in this ProOWeb MVP.\n",
  );
}
function generateInfrastructure(projectRoot, config, generatedRoot, writeManagedFile) {
  const dockerRoot = path.join(projectRoot, "deployment/docker");

  writeManagedFile(path.join(dockerRoot, "backend.Dockerfile"), buildBackendDockerfile());
  writeManagedFile(path.join(dockerRoot, "frontend.Dockerfile"), buildFrontendDockerfile());
  writeManagedFile(path.join(dockerRoot, "nginx.conf"), buildNginxConf());

  for (const [profile, ports] of Object.entries(PROFILE_PORTS)) {
    writeManagedFile(
      path.join(dockerRoot, `docker-compose.${profile}.yml`),
      buildComposeFile(config, profile, ports),
    );
  }

  const buildPs1 = path.join(projectRoot, "build-all.ps1");
  const testPs1 = path.join(projectRoot, "test-all.ps1");
  const startPs1 = path.join(projectRoot, "start-profile.ps1");

  const buildSh = path.join(projectRoot, "build-all.sh");
  const testSh = path.join(projectRoot, "test-all.sh");
  const startSh = path.join(projectRoot, "start-profile.sh");

  writeManagedFile(buildPs1, buildBuildAllPs1());
  writeManagedFile(testPs1, buildTestAllPs1());
  writeManagedFile(startPs1, buildStartProfilePs1());

  writeManagedFile(buildSh, buildBuildAllSh());
  writeManagedFile(testSh, buildTestAllSh());
  writeManagedFile(startSh, buildStartProfileSh());

  ensureExecutable(buildSh);
  ensureExecutable(testSh);
  ensureExecutable(startSh);

  writeManagedFile(path.join(projectRoot, "GENERATED_WORKSPACE.md"), buildWorkspaceReadme(config, generatedRoot));
}

function generateWorkspace(rootDir, config, options = {}) {
  const mode = options.mode === "infra" ? "infra" : "full";
  const generatedRoot = config.managedBy?.generatedRoot || "root";
  const projectRoot = resolveProjectRoot(rootDir, generatedRoot);
  const managedFiles = [];
  const writeManagedFile = makeWriter(rootDir, managedFiles);

  fs.mkdirSync(projectRoot, { recursive: true });

  if (mode === "full") {
    generateApplicationScaffold(projectRoot, config, writeManagedFile);
  }

  generateInfrastructure(projectRoot, config, generatedRoot, writeManagedFile);

  writeManagedFile(
    path.join(projectRoot, ".prooweb-managed.json"),
    buildManagedManifest(config, generatedRoot, managedFiles, mode),
  );

  return {
    generatedRoot,
    mode,
    writtenFiles: managedFiles,
  };
}

module.exports = {
  generateWorkspace,
};
