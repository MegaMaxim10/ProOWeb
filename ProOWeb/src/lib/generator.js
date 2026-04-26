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

  return function writeManagedFile(targetPath, content, metadata = {}) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf8");

    const relativePath = toPosixPath(path.relative(resolvedRoot, targetPath));
    const owners = Array.isArray(metadata.owners)
      ? Array.from(new Set(metadata.owners.map((owner) => String(owner).trim()).filter(Boolean)))
      : [];
    registry.push({
      path: relativePath,
      sha256: hashContent(content),
      owners,
      category: metadata.category || null,
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
const { resolveFeaturePackSelection } = require("./feature-packs");

function writeFiles(baseDir, definitions, writeManagedFile, options = {}) {
  const defaultOwners = Array.isArray(options.owners) ? options.owners : [];
  const defaultCategory = options.category || null;

  for (const { relativePath, content } of definitions) {
    writeManagedFile(path.join(baseDir, relativePath), content, {
      owners: defaultOwners,
      category: defaultCategory,
    });
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
    {
      owners: ["backend-platform"],
      category: "backend",
    },
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
    {
      owners: ["backend-platform"],
      category: "backend",
    },
  );

  writeManagedFile(
    path.join(backendRoot, "prooweb-application/src/main/resources/application.yml"),
    buildBackendApplicationYaml(config),
    {
      owners: ["backend-platform"],
      category: "backend",
    },
  );

  for (const swaggerProfile of config.backendOptions.swaggerUi.profiles) {
    writeManagedFile(
      path.join(backendRoot, `prooweb-application/src/main/resources/application-${swaggerProfile}.yml`),
      buildBackendSwaggerProfileYaml(),
      {
        owners: ["backend-platform"],
        category: "backend",
      },
    );
  }
}

function generateFrontendScaffold(frontendRoot, config, writeManagedFile) {
  const metadata = {
    owners: ["frontend-web-react"],
    category: "frontend",
  };

  writeManagedFile(path.join(frontendRoot, "package.json"), buildFrontendPackageJson(config.project.slug), metadata);
  writeManagedFile(path.join(frontendRoot, "index.html"), buildFrontendIndexHtml(), metadata);
  writeManagedFile(path.join(frontendRoot, "src/main.jsx"), buildFrontendMainJsx(), metadata);
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/domain/model/SystemSnapshot.js"),
    buildFrontendSystemSnapshotModelJs(config.project.title),
    metadata,
  );
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/domain/port/out/LoadSystemSnapshotPort.js"),
    buildFrontendLoadSystemSnapshotPortJs(),
    metadata,
  );
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/application/usecase/ReadSystemSnapshot.js"),
    buildFrontendReadSystemSnapshotUseCaseJs(),
    metadata,
  );
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/infrastructure/adapter/out/http/HttpSystemSnapshotAdapter.js"),
    buildFrontendHttpSystemSnapshotAdapterJs(),
    metadata,
  );
  writeManagedFile(path.join(frontendRoot, "src/modules/system/ui/useSystemSnapshot.js"), buildFrontendUseSystemSnapshotHookJs(), metadata);
  writeManagedFile(path.join(frontendRoot, "src/modules/system/ui/ShellApp.jsx"), buildFrontendShellAppJsx(), metadata);
  writeManagedFile(path.join(frontendRoot, "src/shared/ui/app-shell.css"), buildFrontendCss(), metadata);
  writeManagedFile(path.join(frontendRoot, "vite.config.js"), buildFrontendViteConfig(), metadata);
}

function generateMobilePlaceholder(mobileRoot, writeManagedFile) {
  writeManagedFile(
    path.join(mobileRoot, "README.md"),
    "Mobile frontend generation is not enabled yet in this ProOWeb MVP.\n",
    {
      owners: ["mobile-placeholder"],
      category: "frontend-mobile",
    },
  );
}

function generateApplicationScaffold(projectRoot, config, writeManagedFile, generationPlan) {
  const backendRoot = path.join(projectRoot, "src/backend/springboot");
  const frontendRoot = path.join(projectRoot, "src/frontend/web/react");
  const mobileRoot = path.join(projectRoot, "src/frontend/mobile");

  if (generationPlan.isEnabled("backend-platform")) {
    generateBackendScaffold(backendRoot, config, writeManagedFile);
  }

  if (generationPlan.isEnabled("frontend-web-react")) {
    generateFrontendScaffold(frontendRoot, config, writeManagedFile);
  }

  if (generationPlan.isEnabled("mobile-placeholder")) {
    generateMobilePlaceholder(mobileRoot, writeManagedFile);
  }
}

function generateInfrastructure(projectRoot, config, generatedRoot, writeManagedFile, generationPlan) {
  const dockerRoot = path.join(projectRoot, "deployment/docker");

  if (generationPlan.isEnabled("deployment-docker")) {
    const metadata = {
      owners: ["deployment-docker"],
      category: "deployment",
    };

    writeManagedFile(path.join(dockerRoot, "backend.Dockerfile"), buildBackendDockerfile(config.project.slug), metadata);
    writeManagedFile(path.join(dockerRoot, "frontend.Dockerfile"), buildFrontendDockerfile(), metadata);
    writeManagedFile(path.join(dockerRoot, "nginx.conf"), buildNginxConf(), metadata);

    for (const [profile, ports] of Object.entries(PROFILE_PORTS)) {
      writeManagedFile(
        path.join(dockerRoot, `docker-compose.${profile}.yml`),
        buildComposeFile(config, profile, ports),
        metadata,
      );
    }
  }

  if (generationPlan.isEnabled("workspace-scripts")) {
    const metadata = {
      owners: ["workspace-scripts"],
      category: "scripts",
    };

    const buildPs1 = path.join(projectRoot, "build-all.ps1");
    const testPs1 = path.join(projectRoot, "test-all.ps1");
    const startPs1 = path.join(projectRoot, "start-profile.ps1");

    const buildSh = path.join(projectRoot, "build-all.sh");
    const testSh = path.join(projectRoot, "test-all.sh");
    const startSh = path.join(projectRoot, "start-profile.sh");

    writeManagedFile(buildPs1, buildBuildAllPs1(), metadata);
    writeManagedFile(testPs1, buildTestAllPs1(), metadata);
    writeManagedFile(startPs1, buildStartProfilePs1(), metadata);

    writeManagedFile(buildSh, buildBuildAllSh(), metadata);
    writeManagedFile(testSh, buildTestAllSh(), metadata);
    writeManagedFile(startSh, buildStartProfileSh(), metadata);

    ensureExecutable(buildSh);
    ensureExecutable(testSh);
    ensureExecutable(startSh);
  }

  if (generationPlan.isEnabled("workspace-readme")) {
    writeManagedFile(
      path.join(projectRoot, "GENERATED_WORKSPACE.md"),
      buildWorkspaceReadme(config, generatedRoot),
      {
        owners: ["workspace-readme"],
        category: "docs",
      },
    );
  }
}

function generateWorkspace(rootDir, config, options = {}) {
  const mode = options.mode === "infra" ? "infra" : "full";
  const generationPlan = resolveFeaturePackSelection(config, { mode });
  const effectiveConfig = {
    ...config,
    featurePacks: generationPlan.normalizedFeaturePacks,
  };
  const generatedRoot = effectiveConfig.managedBy?.generatedRoot || "root";
  const projectRoot = resolveProjectRoot(rootDir, generatedRoot);
  const managedFiles = [];
  const writeManagedFile = makeWriter(rootDir, managedFiles);

  fs.mkdirSync(projectRoot, { recursive: true });

  if (mode === "full") {
    generateApplicationScaffold(projectRoot, effectiveConfig, writeManagedFile, generationPlan);
  }

  generateInfrastructure(projectRoot, effectiveConfig, generatedRoot, writeManagedFile, generationPlan);

  writeManagedFile(
    path.join(projectRoot, ".prooweb-managed.json"),
    buildManagedManifest(effectiveConfig, generatedRoot, managedFiles, mode),
    {
      owners: ["workspace-readme"],
      category: "management",
    },
  );

  return {
    generatedRoot,
    mode,
    featurePacks: {
      mode: generationPlan.mode,
      requested: generationPlan.requestedPackIds,
      active: generationPlan.activePackIds,
    },
    writtenFiles: managedFiles,
  };
}

module.exports = {
  generateWorkspace,
};

