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
  buildBackendRootPomXml,
  buildBackendKernelPomXml,
  buildBackendKernelDomainPomXml,
  buildBackendKernelApplicationPomXml,
  buildBackendKernelInfrastructurePomXml,
  buildBackendCommonPomXml,
  buildBackendCommonDomainPomXml,
  buildBackendCommonApplicationPomXml,
  buildBackendCommonInfrastructurePomXml,
  buildBackendGatewayPomXml,
  buildBackendSystemPomXml,
  buildBackendSystemDomainPomXml,
  buildBackendSystemApplicationPomXml,
  buildBackendSystemInfrastructurePomXml,
  buildBackendApplicationModulePomXml,
  buildBackendTestsPomXml,
  buildBackendCoveragePomXml,
  buildBackendTestSupportPomXml,
  buildBackendVanillaUnitTestsPomXml,
  buildBackendSystemApplicationUtPomXml,
  buildBackendSystemInfrastructureItPomXml,
  buildBackendApplicationJava,
  buildBackendApplicationYaml,
  buildBackendSwaggerProfileYaml,
  buildKernelDomainMarkerJava,
  buildKernelApplicationMarkerJava,
  buildKernelInfrastructureMarkerJava,
  buildKernelCorsConfigJava,
  buildCommonEmailNotificationJava,
  buildCommonSendEmailNotificationPortJava,
  buildCommonNotifyByEmailUseCaseJava,
  buildCommonNotifyByEmailServiceJava,
  buildCommonModuleConfigJava,
  buildCommonMailSenderEmailNotificationAdapterJava,
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
  buildHexSystemModuleConfigJava,
  buildHexAppPropertiesSystemMetadataAdapterJava,
  buildHexStaticSystemHealthAdapterJava,
  buildGatewaySystemQueryControllerJava,
  buildTestSupportMarkerJava,
  buildSystemApplicationUtJava,
  buildSystemInfrastructureItJava,
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

function writeFiles(baseDir, definitions, writeManagedFile) {
  for (const { relativePath, content } of definitions) {
    writeManagedFile(path.join(baseDir, relativePath), content);
  }
}

function generateBackendScaffold(backendRoot, config, writeManagedFile) {
  const projectSlug = config.project.slug;
  const projectTitle = config.project.title;
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;

  writeFiles(
    backendRoot,
    [
      { relativePath: "pom.xml", content: buildBackendRootPomXml(projectTitle, projectSlug) },
      { relativePath: "kernel/pom.xml", content: buildBackendKernelPomXml(projectSlug) },
      { relativePath: "kernel/kernel-domain/pom.xml", content: buildBackendKernelDomainPomXml() },
      { relativePath: "kernel/kernel-application/pom.xml", content: buildBackendKernelApplicationPomXml() },
      { relativePath: "kernel/kernel-infrastructure/pom.xml", content: buildBackendKernelInfrastructurePomXml() },
      { relativePath: "common/pom.xml", content: buildBackendCommonPomXml(projectSlug) },
      { relativePath: "common/common-domain/pom.xml", content: buildBackendCommonDomainPomXml() },
      { relativePath: "common/common-application/pom.xml", content: buildBackendCommonApplicationPomXml() },
      { relativePath: "common/common-infrastructure/pom.xml", content: buildBackendCommonInfrastructurePomXml() },
      { relativePath: "gateway/pom.xml", content: buildBackendGatewayPomXml(projectSlug) },
      { relativePath: "system/pom.xml", content: buildBackendSystemPomXml(projectSlug) },
      { relativePath: "system/system-domain/pom.xml", content: buildBackendSystemDomainPomXml() },
      { relativePath: "system/system-application/pom.xml", content: buildBackendSystemApplicationPomXml() },
      { relativePath: "system/system-infrastructure/pom.xml", content: buildBackendSystemInfrastructurePomXml() },
      {
        relativePath: "prooweb-application/pom.xml",
        content: buildBackendApplicationModulePomXml(projectSlug, swaggerEnabled),
      },
      { relativePath: "tests/pom.xml", content: buildBackendTestsPomXml(projectSlug) },
      { relativePath: "tests/test-support/pom.xml", content: buildBackendTestSupportPomXml() },
      { relativePath: "tests/vanilla-unit-tests/pom.xml", content: buildBackendVanillaUnitTestsPomXml() },
      {
        relativePath: "tests/vanilla-unit-tests/system-application-ut/pom.xml",
        content: buildBackendSystemApplicationUtPomXml(),
      },
      {
        relativePath: "tests/system-infrastructure-it/pom.xml",
        content: buildBackendSystemInfrastructureItPomXml(projectSlug),
      },
      { relativePath: "tests/coverage/pom.xml", content: buildBackendCoveragePomXml(projectSlug) },
    ],
    writeManagedFile,
  );

  writeFiles(
    backendRoot,
    [
      {
        relativePath: "kernel/kernel-domain/src/main/java/com/prooweb/generated/kernel/domain/KernelDomainMarker.java",
        content: buildKernelDomainMarkerJava(),
      },
      {
        relativePath:
          "kernel/kernel-application/src/main/java/com/prooweb/generated/kernel/application/KernelApplicationMarker.java",
        content: buildKernelApplicationMarkerJava(),
      },
      {
        relativePath:
          "kernel/kernel-infrastructure/src/main/java/com/prooweb/generated/kernel/infrastructure/KernelInfrastructureMarker.java",
        content: buildKernelInfrastructureMarkerJava(),
      },
      {
        relativePath:
          "kernel/kernel-infrastructure/src/main/java/com/prooweb/generated/kernel/infrastructure/web/KernelCorsConfig.java",
        content: buildKernelCorsConfigJava(),
      },
      {
        relativePath:
          "common/common-domain/src/main/java/com/prooweb/generated/common/domain/notification/model/EmailNotification.java",
        content: buildCommonEmailNotificationJava(),
      },
      {
        relativePath:
          "common/common-domain/src/main/java/com/prooweb/generated/common/domain/notification/port/out/SendEmailNotificationPort.java",
        content: buildCommonSendEmailNotificationPortJava(),
      },
      {
        relativePath:
          "common/common-application/src/main/java/com/prooweb/generated/common/application/notification/port/in/NotifyByEmailUseCase.java",
        content: buildCommonNotifyByEmailUseCaseJava(),
      },
      {
        relativePath:
          "common/common-application/src/main/java/com/prooweb/generated/common/application/notification/service/NotifyByEmailService.java",
        content: buildCommonNotifyByEmailServiceJava(),
      },
      {
        relativePath:
          "common/common-infrastructure/src/main/java/com/prooweb/generated/common/infrastructure/config/CommonModuleConfig.java",
        content: buildCommonModuleConfigJava(),
      },
      {
        relativePath:
          "common/common-infrastructure/src/main/java/com/prooweb/generated/common/infrastructure/notification/MailSenderEmailNotificationAdapter.java",
        content: buildCommonMailSenderEmailNotificationAdapterJava(),
      },
      {
        relativePath: "system/system-domain/src/main/java/com/prooweb/generated/system/domain/SystemDomainMarker.java",
        content: buildHexSystemDomainMarkerJava(),
      },
      {
        relativePath: "system/system-domain/src/main/java/com/prooweb/generated/system/domain/model/SystemMetadata.java",
        content: buildHexSystemMetadataModelJava(),
      },
      {
        relativePath: "system/system-domain/src/main/java/com/prooweb/generated/system/domain/model/SystemHealth.java",
        content: buildHexSystemHealthModelJava(),
      },
      {
        relativePath:
          "system/system-domain/src/main/java/com/prooweb/generated/system/domain/port/out/LoadSystemMetadataPort.java",
        content: buildHexLoadSystemMetadataPortJava(),
      },
      {
        relativePath:
          "system/system-domain/src/main/java/com/prooweb/generated/system/domain/port/out/LoadSystemHealthPort.java",
        content: buildHexLoadSystemHealthPortJava(),
      },
      {
        relativePath:
          "system/system-application/src/main/java/com/prooweb/generated/system/application/SystemApplicationMarker.java",
        content: buildHexSystemApplicationMarkerJava(),
      },
      {
        relativePath:
          "system/system-application/src/main/java/com/prooweb/generated/system/application/port/in/ReadSystemMetadataUseCase.java",
        content: buildHexReadSystemMetadataUseCaseJava(),
      },
      {
        relativePath:
          "system/system-application/src/main/java/com/prooweb/generated/system/application/port/in/ReadSystemHealthUseCase.java",
        content: buildHexReadSystemHealthUseCaseJava(),
      },
      {
        relativePath:
          "system/system-application/src/main/java/com/prooweb/generated/system/application/service/ReadSystemMetadataService.java",
        content: buildHexReadSystemMetadataServiceJava(),
      },
      {
        relativePath:
          "system/system-application/src/main/java/com/prooweb/generated/system/application/service/ReadSystemHealthService.java",
        content: buildHexReadSystemHealthServiceJava(),
      },
      {
        relativePath:
          "system/system-infrastructure/src/main/java/com/prooweb/generated/system/infrastructure/SystemInfrastructureMarker.java",
        content: buildHexSystemInfrastructureMarkerJava(),
      },
      {
        relativePath:
          "system/system-infrastructure/src/main/java/com/prooweb/generated/system/infrastructure/config/SystemModuleConfig.java",
        content: buildHexSystemModuleConfigJava(),
      },
      {
        relativePath:
          "system/system-infrastructure/src/main/java/com/prooweb/generated/system/infrastructure/adapter/out/config/AppPropertiesSystemMetadataAdapter.java",
        content: buildHexAppPropertiesSystemMetadataAdapterJava(),
      },
      {
        relativePath:
          "system/system-infrastructure/src/main/java/com/prooweb/generated/system/infrastructure/adapter/out/health/StaticSystemHealthAdapter.java",
        content: buildHexStaticSystemHealthAdapterJava(),
      },
      {
        relativePath: "gateway/src/main/java/com/prooweb/generated/gateway/api/SystemQueryController.java",
        content: buildGatewaySystemQueryControllerJava(),
      },
      {
        relativePath: "prooweb-application/src/main/java/com/prooweb/generated/app/ProowebApplication.java",
        content: buildBackendApplicationJava(),
      },
      {
        relativePath:
          "tests/test-support/src/main/java/com/prooweb/generated/tests/support/TestSupportMarker.java",
        content: buildTestSupportMarkerJava(),
      },
      {
        relativePath:
          "tests/vanilla-unit-tests/system-application-ut/src/test/java/com/prooweb/generated/tests/unit/SystemApplicationUT.java",
        content: buildSystemApplicationUtJava(),
      },
      {
        relativePath:
          "tests/system-infrastructure-it/src/test/java/com/prooweb/generated/tests/system/SystemInfrastructureIT.java",
        content: buildSystemInfrastructureItJava(),
      },
    ],
    writeManagedFile,
  );

  writeManagedFile(
    path.join(backendRoot, "prooweb-application/src/main/resources/application.yml"),
    buildBackendApplicationYaml(config),
  );

  for (const swaggerProfile of config.backendOptions.swaggerUi.profiles) {
    writeManagedFile(
      path.join(backendRoot, `prooweb-application/src/main/resources/application-${swaggerProfile}.yml`),
      buildBackendSwaggerProfileYaml(),
    );
  }
}

function generateFrontendScaffold(frontendRoot, config, writeManagedFile) {
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
}

function generateMobilePlaceholder(mobileRoot, writeManagedFile) {
  writeManagedFile(
    path.join(mobileRoot, "README.md"),
    "Mobile frontend generation is not enabled yet in this ProOWeb MVP.\n",
  );
}

function generateApplicationScaffold(projectRoot, config, writeManagedFile) {
  const backendRoot = path.join(projectRoot, "src/backend/springboot");
  const frontendRoot = path.join(projectRoot, "src/frontend/web/react");
  const mobileRoot = path.join(projectRoot, "src/frontend/mobile");

  generateBackendScaffold(backendRoot, config, writeManagedFile);
  generateFrontendScaffold(frontendRoot, config, writeManagedFile);
  generateMobilePlaceholder(mobileRoot, writeManagedFile);
}

function generateInfrastructure(projectRoot, config, generatedRoot, writeManagedFile) {
  const dockerRoot = path.join(projectRoot, "deployment/docker");

  writeManagedFile(path.join(dockerRoot, "backend.Dockerfile"), buildBackendDockerfile(config.project.slug));
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

