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

const DEFAULT_BASE_PACKAGE = "com.prooweb.generated";
const DEFAULT_BASE_PACKAGE_PATH = "com/prooweb/generated";
const DEFAULT_BASE_PACKAGE_PATH_PATTERN = /com[\\/]+prooweb[\\/]+generated/g;

function normalizeBasePackage(value) {
  const normalized = String(value || DEFAULT_BASE_PACKAGE).trim().toLowerCase();
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(normalized)) {
    return DEFAULT_BASE_PACKAGE;
  }

  return normalized;
}

function createPackageTransform(config) {
  const basePackage = normalizeBasePackage(config?.project?.basePackage);
  const basePackagePath = basePackage.replace(/\./g, "/");

  return {
    basePackage,
    basePackagePath,
    enabled: basePackage !== DEFAULT_BASE_PACKAGE,
  };
}

function applyPackageTransform(targetPath, content, packageTransform) {
  if (!packageTransform?.enabled) {
    return {
      targetPath,
      content,
    };
  }

  const packagePathForPlatform = packageTransform.basePackagePath.split("/").join(path.sep);
  const transformedPath = targetPath.replace(DEFAULT_BASE_PACKAGE_PATH_PATTERN, packagePathForPlatform);
  const transformedContent = typeof content === "string"
    ? content.split(DEFAULT_BASE_PACKAGE).join(packageTransform.basePackage)
    : content;

  return {
    targetPath: transformedPath,
    content: transformedContent,
  };
}

function makeWriter(rootDir, registry, options = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const packageTransform = options.packageTransform || null;

  return function writeManagedFile(targetPath, content, metadata = {}) {
    const transformed = applyPackageTransform(targetPath, content, packageTransform);

    fs.mkdirSync(path.dirname(transformed.targetPath), { recursive: true });
    fs.writeFileSync(transformed.targetPath, transformed.content, "utf8");

    const relativePath = toPosixPath(path.relative(resolvedRoot, transformed.targetPath));
    const owners = Array.isArray(metadata.owners)
      ? Array.from(new Set(metadata.owners.map((owner) => String(owner).trim()).filter(Boolean)))
      : [];
    registry.push({
      path: relativePath,
      sha256: hashContent(transformed.content),
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
  buildBackendIdentityPomXml,
  buildBackendIdentityDomainPomXml,
  buildBackendIdentityApplicationPomXml,
  buildBackendIdentityInfrastructurePomXml,
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
  buildGatewayIdentityAdminControllerJava,
  buildGatewayAuthenticationFlowControllerJava,
  buildGatewayExternalAuthenticationControllerJava,
  buildGatewaySessionSecurityControllerJava,
  buildGatewaySecurityConfigJava,
  buildGatewayPbkdf2WorkspacePasswordEncoderJava,
  buildTestSupportMarkerJava,
  buildSystemApplicationUtJava,
  buildSystemInfrastructureItJava,
  buildAuthenticationFlowsItJava,
  buildExternalIamAuthenticationItJava,
  buildSessionDeviceSecurityItJava,
  buildIdentityDomainMarkerJava,
  buildIdentityApplicationMarkerJava,
  buildIdentityInfrastructureMarkerJava,
  buildIdentityPermissionModelJava,
  buildIdentityRoleModelJava,
  buildIdentityUserAccountModelJava,
  buildIdentityUserCredentialsModelJava,
  buildIdentityUserSessionObservationJava,
  buildIdentityAuthenticationFlowResultJava,
  buildIdentityExternalAuthenticationResultJava,
  buildIdentityCreateUserCommandJava,
  buildIdentityCreateRoleCommandJava,
  buildIdentityLoadUsersPortJava,
  buildIdentityCreateUserPortJava,
  buildIdentityAssignRoleToUserPortJava,
  buildIdentityLoadRolesPortJava,
  buildIdentityCreateRolePortJava,
  buildIdentityLoadUserCredentialsPortJava,
  buildIdentityRunAuthenticationFlowPortJava,
  buildIdentityAuthenticateExternalIdentityPortJava,
  buildIdentityObserveUserSessionPortJava,
  buildIdentityReadUsersUseCaseJava,
  buildIdentityCreateUserUseCaseJava,
  buildIdentityAssignRoleToUserUseCaseJava,
  buildIdentityReadRolesUseCaseJava,
  buildIdentityCreateRoleUseCaseJava,
  buildIdentityReadUserCredentialsUseCaseJava,
  buildIdentityRunAuthenticationFlowUseCaseJava,
  buildIdentityAuthenticateExternalIdentityUseCaseJava,
  buildIdentityObserveUserSessionUseCaseJava,
  buildIdentityReadUsersServiceJava,
  buildIdentityCreateUserServiceJava,
  buildIdentityAssignRoleToUserServiceJava,
  buildIdentityReadRolesServiceJava,
  buildIdentityCreateRoleServiceJava,
  buildIdentityReadUserCredentialsServiceJava,
  buildIdentityAuthenticationFlowServiceJava,
  buildIdentityExternalAuthenticationServiceJava,
  buildIdentityObserveUserSessionServiceJava,
  buildIdentityModuleConfigJava,
  buildIdentityBootstrapPropertiesJava,
  buildIdentityExternalIamPropertiesJava,
  buildIdentitySessionSecurityPropertiesJava,
  buildIdentityBootstrapSeederJava,
  buildIdentityRoleEntityJava,
  buildIdentityUserAccountEntityJava,
  buildIdentityRoleJpaRepositoryJava,
  buildIdentityUserJpaRepositoryJava,
  buildIdentityJpaIdentityRepositoryAdapterJava,
  buildIdentityJpaAuthenticationFlowAdapterJava,
  buildIdentityHs256ExternalIamAuthenticationAdapterJava,
  buildIdentityInMemorySessionObservationAdapterJava,
  buildFrontendPackageJson,
  buildFrontendIndexHtml,
  buildFrontendMainJsx,
  buildFrontendSystemSnapshotModelJs,
  buildFrontendLoadSystemSnapshotPortJs,
  buildFrontendReadSystemSnapshotUseCaseJs,
  buildFrontendHttpSystemSnapshotAdapterJs,
  buildFrontendUseSystemSnapshotHookJs,
  buildFrontendShellAppJsx,
  buildFrontendIdentityUserModelJs,
  buildFrontendIdentityRoleModelJs,
  buildFrontendLoadIdentityUsersPortJs,
  buildFrontendCreateIdentityUserPortJs,
  buildFrontendLoadIdentityRolesPortJs,
  buildFrontendCreateIdentityRolePortJs,
  buildFrontendAssignIdentityRolePortJs,
  buildFrontendReadIdentityUsersUseCaseJs,
  buildFrontendCreateIdentityUserUseCaseJs,
  buildFrontendReadIdentityRolesUseCaseJs,
  buildFrontendCreateIdentityRoleUseCaseJs,
  buildFrontendAssignIdentityRoleUseCaseJs,
  buildFrontendHttpIdentityAdminAdapterJs,
  buildFrontendUseIdentityAdminHookJs,
  buildFrontendIdentityAdminPanelJsx,
  buildFrontendHttpAuthFlowsAdapterJs,
  buildFrontendUseAuthFlowsHookJs,
  buildFrontendAuthenticationWorkbenchJsx,
  buildFrontendHttpSessionSecurityAdapterJs,
  buildFrontendUseSessionSecurityHookJs,
  buildFrontendSessionSecurityPanelJsx,
  buildFrontendCss,
  buildFrontendViteConfig,
  buildComposeFile,
  buildBackendDockerfile,
  buildFrontendDockerfile,
  buildNginxConf,
  buildBuildAllPs1,
  buildTestAllPs1,
  buildVerifyAllPs1,
  buildStartProfilePs1,
  buildBuildAllSh,
  buildTestAllSh,
  buildVerifyAllSh,
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

function generateBackendScaffold(backendRoot, config, writeManagedFile, generationPlan) {
  const projectSlug = config.project.slug;
  const projectTitle = config.project.title;
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;
  const identityEnabled = generationPlan.isEnabled("identity-rbac");
  const authEnabled = generationPlan.isEnabled("auth-flows");
  const externalIamEnabled = generationPlan.isEnabled("external-iam-auth");
  const sessionSecurityEnabled = generationPlan.isEnabled("session-device-security");

  writeFiles(
    backendRoot,
    [
      {
        relativePath: "pom.xml",
        content: buildBackendRootPomXml(projectTitle, projectSlug, { identityEnabled }),
      },
      { relativePath: "kernel/pom.xml", content: buildBackendKernelPomXml(projectSlug) },
      { relativePath: "kernel/kernel-domain/pom.xml", content: buildBackendKernelDomainPomXml() },
      { relativePath: "kernel/kernel-application/pom.xml", content: buildBackendKernelApplicationPomXml() },
      { relativePath: "kernel/kernel-infrastructure/pom.xml", content: buildBackendKernelInfrastructurePomXml() },
      { relativePath: "common/pom.xml", content: buildBackendCommonPomXml(projectSlug) },
      { relativePath: "common/common-domain/pom.xml", content: buildBackendCommonDomainPomXml() },
      { relativePath: "common/common-application/pom.xml", content: buildBackendCommonApplicationPomXml() },
      { relativePath: "common/common-infrastructure/pom.xml", content: buildBackendCommonInfrastructurePomXml() },
      { relativePath: "gateway/pom.xml", content: buildBackendGatewayPomXml(projectSlug, { identityEnabled }) },
      { relativePath: "system/pom.xml", content: buildBackendSystemPomXml(projectSlug) },
      { relativePath: "system/system-domain/pom.xml", content: buildBackendSystemDomainPomXml() },
      { relativePath: "system/system-application/pom.xml", content: buildBackendSystemApplicationPomXml() },
      { relativePath: "system/system-infrastructure/pom.xml", content: buildBackendSystemInfrastructurePomXml() },
      {
        relativePath: "prooweb-application/pom.xml",
        content: buildBackendApplicationModulePomXml(projectSlug, swaggerEnabled, { identityEnabled }),
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
        content: buildBackendSystemInfrastructureItPomXml(projectSlug, { identityEnabled }),
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
      ...(identityEnabled
        ? [
            {
              relativePath: "gateway/src/main/java/com/prooweb/generated/gateway/api/IdentityAdminController.java",
              content: buildGatewayIdentityAdminControllerJava(),
            },
            ...(authEnabled
                ? [
                  {
                    relativePath: "gateway/src/main/java/com/prooweb/generated/gateway/api/AuthenticationFlowController.java",
                    content: buildGatewayAuthenticationFlowControllerJava({ sessionSecurityEnabled }),
                  },
                  ...(externalIamEnabled
                    ? [
                        {
                          relativePath:
                            "gateway/src/main/java/com/prooweb/generated/gateway/api/ExternalAuthenticationController.java",
                          content: buildGatewayExternalAuthenticationControllerJava({ sessionSecurityEnabled }),
                        },
                      ]
                    : []),
                  ...(sessionSecurityEnabled
                    ? [
                        {
                          relativePath:
                            "gateway/src/main/java/com/prooweb/generated/gateway/api/SessionSecurityController.java",
                          content: buildGatewaySessionSecurityControllerJava(),
                        },
                      ]
                    : []),
                ]
              : []),
            {
              relativePath: "gateway/src/main/java/com/prooweb/generated/gateway/security/GatewaySecurityConfig.java",
              content: buildGatewaySecurityConfigJava(),
            },
            {
              relativePath:
                "gateway/src/main/java/com/prooweb/generated/gateway/security/Pbkdf2WorkspacePasswordEncoder.java",
              content: buildGatewayPbkdf2WorkspacePasswordEncoderJava(),
            },
          ]
        : []),
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
        content: buildSystemInfrastructureItJava({ identityEnabled }),
      },
    ],
    writeManagedFile,
    {
      owners: ["backend-platform"],
      category: "backend",
    },
  );

  if (authEnabled) {
    writeManagedFile(
      path.join(
        backendRoot,
        "tests/system-infrastructure-it/src/test/java/com/prooweb/generated/tests/system/AuthenticationFlowsIT.java",
      ),
      buildAuthenticationFlowsItJava(),
      {
        owners: ["auth-flows"],
        category: "backend-tests",
      },
    );
  }

  if (externalIamEnabled) {
    writeManagedFile(
      path.join(
        backendRoot,
        "tests/system-infrastructure-it/src/test/java/com/prooweb/generated/tests/system/ExternalIamAuthenticationIT.java",
      ),
      buildExternalIamAuthenticationItJava(),
      {
        owners: ["external-iam-auth"],
        category: "backend-tests",
      },
    );
  }

  if (sessionSecurityEnabled) {
    writeManagedFile(
      path.join(
        backendRoot,
        "tests/system-infrastructure-it/src/test/java/com/prooweb/generated/tests/system/SessionDeviceSecurityIT.java",
      ),
      buildSessionDeviceSecurityItJava(),
      {
        owners: ["session-device-security"],
        category: "backend-tests",
      },
    );
  }

  if (identityEnabled) {
    writeFiles(
      backendRoot,
      [
        { relativePath: "identity/pom.xml", content: buildBackendIdentityPomXml(projectSlug) },
        { relativePath: "identity/identity-domain/pom.xml", content: buildBackendIdentityDomainPomXml() },
        {
          relativePath: "identity/identity-application/pom.xml",
          content: buildBackendIdentityApplicationPomXml(),
        },
        {
          relativePath: "identity/identity-infrastructure/pom.xml",
          content: buildBackendIdentityInfrastructurePomXml(),
        },
        {
          relativePath: "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/IdentityDomainMarker.java",
          content: buildIdentityDomainMarkerJava(),
        },
        {
          relativePath: "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/Permission.java",
          content: buildIdentityPermissionModelJava(),
        },
        {
          relativePath: "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/Role.java",
          content: buildIdentityRoleModelJava(),
        },
        {
          relativePath: "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/UserAccount.java",
          content: buildIdentityUserAccountModelJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/UserCredentials.java",
          content: buildIdentityUserCredentialsModelJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/CreateUserCommand.java",
          content: buildIdentityCreateUserCommandJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/CreateRoleCommand.java",
          content: buildIdentityCreateRoleCommandJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/LoadUsersPort.java",
          content: buildIdentityLoadUsersPortJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/CreateUserPort.java",
          content: buildIdentityCreateUserPortJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/AssignRoleToUserPort.java",
          content: buildIdentityAssignRoleToUserPortJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/LoadRolesPort.java",
          content: buildIdentityLoadRolesPortJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/CreateRolePort.java",
          content: buildIdentityCreateRolePortJava(),
        },
        {
          relativePath:
            "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/LoadUserCredentialsPort.java",
          content: buildIdentityLoadUserCredentialsPortJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/IdentityApplicationMarker.java",
          content: buildIdentityApplicationMarkerJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/ReadIdentityUsersUseCase.java",
          content: buildIdentityReadUsersUseCaseJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/CreateIdentityUserUseCase.java",
          content: buildIdentityCreateUserUseCaseJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/AssignRoleToIdentityUserUseCase.java",
          content: buildIdentityAssignRoleToUserUseCaseJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/ReadIdentityRolesUseCase.java",
          content: buildIdentityReadRolesUseCaseJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/CreateIdentityRoleUseCase.java",
          content: buildIdentityCreateRoleUseCaseJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/ReadIdentityUserCredentialsUseCase.java",
          content: buildIdentityReadUserCredentialsUseCaseJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/ReadIdentityUsersService.java",
          content: buildIdentityReadUsersServiceJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/CreateIdentityUserService.java",
          content: buildIdentityCreateUserServiceJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/AssignRoleToIdentityUserService.java",
          content: buildIdentityAssignRoleToUserServiceJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/ReadIdentityRolesService.java",
          content: buildIdentityReadRolesServiceJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/CreateIdentityRoleService.java",
          content: buildIdentityCreateRoleServiceJava(),
        },
        {
          relativePath:
            "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/ReadIdentityUserCredentialsService.java",
          content: buildIdentityReadUserCredentialsServiceJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/IdentityInfrastructureMarker.java",
          content: buildIdentityInfrastructureMarkerJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/config/IdentityModuleConfig.java",
          content: buildIdentityModuleConfigJava({ authEnabled, externalIamEnabled, sessionSecurityEnabled }),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/config/IdentityBootstrapProperties.java",
          content: buildIdentityBootstrapPropertiesJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/bootstrap/IdentityBootstrapSeeder.java",
          content: buildIdentityBootstrapSeederJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/persistence/entity/RoleEntity.java",
          content: buildIdentityRoleEntityJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/persistence/entity/UserAccountEntity.java",
          content: buildIdentityUserAccountEntityJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/persistence/IdentityRoleJpaRepository.java",
          content: buildIdentityRoleJpaRepositoryJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/persistence/IdentityUserJpaRepository.java",
          content: buildIdentityUserJpaRepositoryJava(),
        },
        {
          relativePath:
            "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/adapter/out/persistence/JpaIdentityRepositoryAdapter.java",
          content: buildIdentityJpaIdentityRepositoryAdapterJava(),
        },
      ],
      writeManagedFile,
      {
        owners: ["identity-rbac"],
        category: "backend",
      },
    );

    if (authEnabled) {
      writeFiles(
        backendRoot,
        [
          {
            relativePath:
              "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/AuthenticationFlowResult.java",
            content: buildIdentityAuthenticationFlowResultJava(),
          },
          {
            relativePath:
              "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/RunAuthenticationFlowPort.java",
            content: buildIdentityRunAuthenticationFlowPortJava(),
          },
          {
            relativePath:
              "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/RunAuthenticationFlowUseCase.java",
            content: buildIdentityRunAuthenticationFlowUseCaseJava(),
          },
          {
            relativePath:
              "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/AuthenticationFlowService.java",
            content: buildIdentityAuthenticationFlowServiceJava(),
          },
          {
            relativePath:
              "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/adapter/out/persistence/JpaAuthenticationFlowAdapter.java",
            content: buildIdentityJpaAuthenticationFlowAdapterJava(),
          },
        ],
        writeManagedFile,
        {
          owners: ["auth-flows"],
          category: "backend",
        },
      );
    }

    if (externalIamEnabled) {
      writeFiles(
        backendRoot,
        [
          {
            relativePath:
              "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/ExternalAuthenticationResult.java",
            content: buildIdentityExternalAuthenticationResultJava(),
          },
          {
            relativePath:
              "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/AuthenticateExternalIdentityPort.java",
            content: buildIdentityAuthenticateExternalIdentityPortJava(),
          },
          {
            relativePath:
              "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/AuthenticateExternalIdentityUseCase.java",
            content: buildIdentityAuthenticateExternalIdentityUseCaseJava(),
          },
          {
            relativePath:
              "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/ExternalAuthenticationService.java",
            content: buildIdentityExternalAuthenticationServiceJava(),
          },
          {
            relativePath:
              "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/config/ExternalIamProperties.java",
            content: buildIdentityExternalIamPropertiesJava(),
          },
          {
            relativePath:
              "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/adapter/out/iam/Hs256ExternalIamAuthenticationAdapter.java",
            content: buildIdentityHs256ExternalIamAuthenticationAdapterJava(),
          },
        ],
        writeManagedFile,
        {
          owners: ["external-iam-auth"],
          category: "backend",
        },
      );
    }

    if (sessionSecurityEnabled) {
      writeFiles(
        backendRoot,
        [
          {
            relativePath:
              "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/model/UserSessionObservation.java",
            content: buildIdentityUserSessionObservationJava(),
          },
          {
            relativePath:
              "identity/identity-domain/src/main/java/com/prooweb/generated/identity/domain/port/out/ObserveUserSessionPort.java",
            content: buildIdentityObserveUserSessionPortJava(),
          },
          {
            relativePath:
              "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/port/in/ObserveUserSessionUseCase.java",
            content: buildIdentityObserveUserSessionUseCaseJava(),
          },
          {
            relativePath:
              "identity/identity-application/src/main/java/com/prooweb/generated/identity/application/service/ObserveUserSessionService.java",
            content: buildIdentityObserveUserSessionServiceJava(),
          },
          {
            relativePath:
              "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/config/SessionSecurityProperties.java",
            content: buildIdentitySessionSecurityPropertiesJava(),
          },
          {
            relativePath:
              "identity/identity-infrastructure/src/main/java/com/prooweb/generated/identity/infrastructure/adapter/out/session/InMemorySessionObservationAdapter.java",
            content: buildIdentityInMemorySessionObservationAdapterJava(),
          },
        ],
        writeManagedFile,
        {
          owners: ["session-device-security"],
          category: "backend",
        },
      );
    }
  }

  writeManagedFile(
    path.join(backendRoot, "prooweb-application/src/main/resources/application.yml"),
    buildBackendApplicationYaml(config, {
      identityEnabled,
      authEnabled,
      externalIamEnabled,
      sessionSecurityEnabled,
    }),
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

function generateFrontendScaffold(frontendRoot, config, writeManagedFile, generationPlan) {
  const identityEnabled = generationPlan.isEnabled("identity-rbac");
  const authEnabled = generationPlan.isEnabled("auth-flows");
  const externalIamEnabled = generationPlan.isEnabled("external-iam-auth");
  const sessionSecurityEnabled = generationPlan.isEnabled("session-device-security");
  const defaultExternalIamProviderId = Array.isArray(config?.backendOptions?.externalIam?.providers)
    && config.backendOptions.externalIam.providers.length > 0
    ? config.backendOptions.externalIam.providers[0].id
    : "corporate-oidc";
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
  writeManagedFile(
    path.join(frontendRoot, "src/modules/system/ui/ShellApp.jsx"),
    buildFrontendShellAppJsx({ identityEnabled, authEnabled, sessionSecurityEnabled }),
    metadata,
  );

  if (identityEnabled) {
    const identityMetadata = {
      owners: ["identity-rbac"],
      category: "frontend",
    };

    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/model/IdentityUser.js"),
      buildFrontendIdentityUserModelJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/model/IdentityRole.js"),
      buildFrontendIdentityRoleModelJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/port/out/LoadIdentityUsersPort.js"),
      buildFrontendLoadIdentityUsersPortJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/port/out/CreateIdentityUserPort.js"),
      buildFrontendCreateIdentityUserPortJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/port/out/LoadIdentityRolesPort.js"),
      buildFrontendLoadIdentityRolesPortJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/port/out/CreateIdentityRolePort.js"),
      buildFrontendCreateIdentityRolePortJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/domain/port/out/AssignIdentityRolePort.js"),
      buildFrontendAssignIdentityRolePortJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/application/usecase/ReadIdentityUsers.js"),
      buildFrontendReadIdentityUsersUseCaseJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/application/usecase/CreateIdentityUser.js"),
      buildFrontendCreateIdentityUserUseCaseJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/application/usecase/ReadIdentityRoles.js"),
      buildFrontendReadIdentityRolesUseCaseJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/application/usecase/CreateIdentityRole.js"),
      buildFrontendCreateIdentityRoleUseCaseJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/application/usecase/AssignIdentityRole.js"),
      buildFrontendAssignIdentityRoleUseCaseJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/infrastructure/adapter/out/http/HttpIdentityAdminAdapter.js"),
      buildFrontendHttpIdentityAdminAdapterJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/ui/useIdentityAdmin.js"),
      buildFrontendUseIdentityAdminHookJs(),
      identityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/identity/ui/IdentityAdminPanel.jsx"),
      buildFrontendIdentityAdminPanelJsx(),
      identityMetadata,
    );
  }

  if (authEnabled) {
    const authMetadata = {
      owners: ["auth-flows"],
      category: "frontend",
    };

    writeManagedFile(
      path.join(frontendRoot, "src/modules/auth/infrastructure/adapter/out/http/HttpAuthFlowsAdapter.js"),
      buildFrontendHttpAuthFlowsAdapterJs(),
      authMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/auth/ui/useAuthFlows.js"),
      buildFrontendUseAuthFlowsHookJs(),
      authMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/auth/ui/AuthenticationWorkbench.jsx"),
      buildFrontendAuthenticationWorkbenchJsx({
        externalIamEnabled,
        externalIamProviderId: defaultExternalIamProviderId,
      }),
      authMetadata,
    );
  }

  if (sessionSecurityEnabled) {
    const sessionSecurityMetadata = {
      owners: ["session-device-security"],
      category: "frontend",
    };

    writeManagedFile(
      path.join(frontendRoot, "src/modules/session-security/infrastructure/adapter/out/http/HttpSessionSecurityAdapter.js"),
      buildFrontendHttpSessionSecurityAdapterJs(),
      sessionSecurityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/session-security/ui/useSessionSecurity.js"),
      buildFrontendUseSessionSecurityHookJs(),
      sessionSecurityMetadata,
    );
    writeManagedFile(
      path.join(frontendRoot, "src/modules/session-security/ui/SessionSecurityPanel.jsx"),
      buildFrontendSessionSecurityPanelJsx(),
      sessionSecurityMetadata,
    );
  }

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
    generateBackendScaffold(backendRoot, config, writeManagedFile, generationPlan);
  }

  if (generationPlan.isEnabled("frontend-web-react")) {
    generateFrontendScaffold(frontendRoot, config, writeManagedFile, generationPlan);
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
    const verifyPs1 = path.join(projectRoot, "verify-all.ps1");
    const startPs1 = path.join(projectRoot, "start-profile.ps1");

    const buildSh = path.join(projectRoot, "build-all.sh");
    const testSh = path.join(projectRoot, "test-all.sh");
    const verifySh = path.join(projectRoot, "verify-all.sh");
    const startSh = path.join(projectRoot, "start-profile.sh");

    writeManagedFile(buildPs1, buildBuildAllPs1(), metadata);
    writeManagedFile(testPs1, buildTestAllPs1(), metadata);
    writeManagedFile(verifyPs1, buildVerifyAllPs1(), metadata);
    writeManagedFile(startPs1, buildStartProfilePs1(), metadata);

    writeManagedFile(buildSh, buildBuildAllSh(), metadata);
    writeManagedFile(testSh, buildTestAllSh(), metadata);
    writeManagedFile(verifySh, buildVerifyAllSh(), metadata);
    writeManagedFile(startSh, buildStartProfileSh(), metadata);

    ensureExecutable(buildSh);
    ensureExecutable(testSh);
    ensureExecutable(verifySh);
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
  const packageTransform = createPackageTransform(effectiveConfig);
  const writeManagedFile = makeWriter(rootDir, managedFiles, { packageTransform });

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

