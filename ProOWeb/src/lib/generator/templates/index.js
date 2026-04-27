const { buildBackendRootPomXml } = require("./backend/springboot/buildBackendRootPomXml");
const { buildBackendKernelPomXml } = require("./backend/springboot/buildBackendKernelPomXml");
const { buildBackendKernelDomainPomXml } = require("./backend/springboot/buildBackendKernelDomainPomXml");
const { buildBackendKernelApplicationPomXml } = require("./backend/springboot/buildBackendKernelApplicationPomXml");
const { buildBackendKernelInfrastructurePomXml } = require("./backend/springboot/buildBackendKernelInfrastructurePomXml");
const { buildBackendCommonPomXml } = require("./backend/springboot/buildBackendCommonPomXml");
const { buildBackendCommonDomainPomXml } = require("./backend/springboot/buildBackendCommonDomainPomXml");
const { buildBackendCommonApplicationPomXml } = require("./backend/springboot/buildBackendCommonApplicationPomXml");
const { buildBackendCommonInfrastructurePomXml } = require("./backend/springboot/buildBackendCommonInfrastructurePomXml");
const { buildBackendGatewayPomXml } = require("./backend/springboot/buildBackendGatewayPomXml");
const { buildBackendSystemPomXml } = require("./backend/springboot/buildBackendSystemPomXml");
const { buildBackendSystemDomainPomXml } = require("./backend/springboot/buildBackendSystemDomainPomXml");
const { buildBackendSystemApplicationPomXml } = require("./backend/springboot/buildBackendSystemApplicationPomXml");
const { buildBackendSystemInfrastructurePomXml } = require("./backend/springboot/buildBackendSystemInfrastructurePomXml");
const { buildBackendIdentityPomXml } = require("./backend/springboot/buildBackendIdentityPomXml");
const { buildBackendIdentityDomainPomXml } = require("./backend/springboot/buildBackendIdentityDomainPomXml");
const { buildBackendIdentityApplicationPomXml } = require("./backend/springboot/buildBackendIdentityApplicationPomXml");
const { buildBackendIdentityInfrastructurePomXml } = require("./backend/springboot/buildBackendIdentityInfrastructurePomXml");
const { buildBackendOrganizationPomXml } = require("./backend/springboot/buildBackendOrganizationPomXml");
const { buildBackendOrganizationDomainPomXml } = require("./backend/springboot/buildBackendOrganizationDomainPomXml");
const { buildBackendOrganizationApplicationPomXml } = require("./backend/springboot/buildBackendOrganizationApplicationPomXml");
const { buildBackendOrganizationInfrastructurePomXml } = require("./backend/springboot/buildBackendOrganizationInfrastructurePomXml");
const { buildBackendApplicationModulePomXml } = require("./backend/springboot/buildBackendApplicationModulePomXml");
const { buildBackendTestsPomXml } = require("./backend/springboot/buildBackendTestsPomXml");
const { buildBackendCoveragePomXml } = require("./backend/springboot/buildBackendCoveragePomXml");
const { buildBackendTestSupportPomXml } = require("./backend/springboot/buildBackendTestSupportPomXml");
const { buildBackendVanillaUnitTestsPomXml } = require("./backend/springboot/buildBackendVanillaUnitTestsPomXml");
const { buildBackendSystemApplicationUtPomXml } = require("./backend/springboot/buildBackendSystemApplicationUtPomXml");
const { buildBackendSystemInfrastructureItPomXml } = require("./backend/springboot/buildBackendSystemInfrastructureItPomXml");
const { buildBackendApplicationJava } = require("./backend/springboot/buildBackendApplicationJava");
const { buildBackendApplicationYaml } = require("./backend/springboot/buildBackendApplicationYaml");
const { buildBackendSwaggerProfileYaml } = require("./backend/springboot/buildBackendSwaggerProfileYaml");
const { buildBackendDockerfile } = require("./backend/springboot/buildBackendDockerfile");
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
const { buildHexSystemModuleConfigJava } = require("./backend/springboot/buildHexSystemModuleConfigJava");
const { buildHexAppPropertiesSystemMetadataAdapterJava } = require("./backend/springboot/buildHexAppPropertiesSystemMetadataAdapterJava");
const { buildHexStaticSystemHealthAdapterJava } = require("./backend/springboot/buildHexStaticSystemHealthAdapterJava");
const { buildGatewaySystemQueryControllerJava } = require("./backend/springboot/buildGatewaySystemQueryControllerJava");
const { buildGatewayIdentityAdminControllerJava } = require("./backend/springboot/buildGatewayIdentityAdminControllerJava");
const { buildGatewayAuthenticationFlowControllerJava } = require("./backend/springboot/buildGatewayAuthenticationFlowControllerJava");
const { buildGatewayExternalAuthenticationControllerJava } = require("./backend/springboot/buildGatewayExternalAuthenticationControllerJava");
const { buildGatewaySessionSecurityControllerJava } = require("./backend/springboot/buildGatewaySessionSecurityControllerJava");
const { buildGatewayOrganizationHierarchyControllerJava } = require("./backend/springboot/buildGatewayOrganizationHierarchyControllerJava");
const { buildGatewaySecurityConfigJava } = require("./backend/springboot/buildGatewaySecurityConfigJava");
const { buildGatewayPbkdf2WorkspacePasswordEncoderJava } = require("./backend/springboot/buildGatewayPbkdf2WorkspacePasswordEncoderJava");
const { buildKernelDomainMarkerJava } = require("./backend/springboot/buildKernelDomainMarkerJava");
const { buildKernelApplicationMarkerJava } = require("./backend/springboot/buildKernelApplicationMarkerJava");
const { buildKernelInfrastructureMarkerJava } = require("./backend/springboot/buildKernelInfrastructureMarkerJava");
const { buildKernelCorsConfigJava } = require("./backend/springboot/buildKernelCorsConfigJava");
const { buildCommonEmailNotificationJava } = require("./backend/springboot/buildCommonEmailNotificationJava");
const { buildCommonSendEmailNotificationPortJava } = require("./backend/springboot/buildCommonSendEmailNotificationPortJava");
const { buildCommonNotifyByEmailUseCaseJava } = require("./backend/springboot/buildCommonNotifyByEmailUseCaseJava");
const { buildCommonNotifyByEmailServiceJava } = require("./backend/springboot/buildCommonNotifyByEmailServiceJava");
const { buildCommonModuleConfigJava } = require("./backend/springboot/buildCommonModuleConfigJava");
const { buildCommonMailSenderEmailNotificationAdapterJava } = require("./backend/springboot/buildCommonMailSenderEmailNotificationAdapterJava");
const { buildIdentityDomainMarkerJava } = require("./backend/springboot/buildIdentityDomainMarkerJava");
const { buildIdentityApplicationMarkerJava } = require("./backend/springboot/buildIdentityApplicationMarkerJava");
const { buildIdentityInfrastructureMarkerJava } = require("./backend/springboot/buildIdentityInfrastructureMarkerJava");
const { buildIdentityPermissionModelJava } = require("./backend/springboot/buildIdentityPermissionModelJava");
const { buildIdentityRoleModelJava } = require("./backend/springboot/buildIdentityRoleModelJava");
const { buildIdentityUserAccountModelJava } = require("./backend/springboot/buildIdentityUserAccountModelJava");
const { buildIdentityUserCredentialsModelJava } = require("./backend/springboot/buildIdentityUserCredentialsModelJava");
const { buildIdentityAuthenticationFlowResultJava } = require("./backend/springboot/buildIdentityAuthenticationFlowResultJava");
const { buildIdentityExternalAuthenticationResultJava } = require("./backend/springboot/buildIdentityExternalAuthenticationResultJava");
const { buildIdentityCreateUserCommandJava } = require("./backend/springboot/buildIdentityCreateUserCommandJava");
const { buildIdentityCreateRoleCommandJava } = require("./backend/springboot/buildIdentityCreateRoleCommandJava");
const { buildIdentityLoadUsersPortJava } = require("./backend/springboot/buildIdentityLoadUsersPortJava");
const { buildIdentityCreateUserPortJava } = require("./backend/springboot/buildIdentityCreateUserPortJava");
const { buildIdentityAssignRoleToUserPortJava } = require("./backend/springboot/buildIdentityAssignRoleToUserPortJava");
const { buildIdentityLoadRolesPortJava } = require("./backend/springboot/buildIdentityLoadRolesPortJava");
const { buildIdentityCreateRolePortJava } = require("./backend/springboot/buildIdentityCreateRolePortJava");
const { buildIdentityLoadUserCredentialsPortJava } = require("./backend/springboot/buildIdentityLoadUserCredentialsPortJava");
const { buildIdentityRunAuthenticationFlowPortJava } = require("./backend/springboot/buildIdentityRunAuthenticationFlowPortJava");
const { buildIdentityAuthenticateExternalIdentityPortJava } = require("./backend/springboot/buildIdentityAuthenticateExternalIdentityPortJava");
const { buildIdentityObserveUserSessionPortJava } = require("./backend/springboot/buildIdentityObserveUserSessionPortJava");
const { buildIdentityReadUsersUseCaseJava } = require("./backend/springboot/buildIdentityReadUsersUseCaseJava");
const { buildIdentityCreateUserUseCaseJava } = require("./backend/springboot/buildIdentityCreateUserUseCaseJava");
const { buildIdentityAssignRoleToUserUseCaseJava } = require("./backend/springboot/buildIdentityAssignRoleToUserUseCaseJava");
const { buildIdentityReadRolesUseCaseJava } = require("./backend/springboot/buildIdentityReadRolesUseCaseJava");
const { buildIdentityCreateRoleUseCaseJava } = require("./backend/springboot/buildIdentityCreateRoleUseCaseJava");
const { buildIdentityReadUserCredentialsUseCaseJava } = require("./backend/springboot/buildIdentityReadUserCredentialsUseCaseJava");
const { buildIdentityRunAuthenticationFlowUseCaseJava } = require("./backend/springboot/buildIdentityRunAuthenticationFlowUseCaseJava");
const { buildIdentityAuthenticateExternalIdentityUseCaseJava } = require("./backend/springboot/buildIdentityAuthenticateExternalIdentityUseCaseJava");
const { buildIdentityObserveUserSessionUseCaseJava } = require("./backend/springboot/buildIdentityObserveUserSessionUseCaseJava");
const { buildIdentityReadUsersServiceJava } = require("./backend/springboot/buildIdentityReadUsersServiceJava");
const { buildIdentityCreateUserServiceJava } = require("./backend/springboot/buildIdentityCreateUserServiceJava");
const { buildIdentityAssignRoleToUserServiceJava } = require("./backend/springboot/buildIdentityAssignRoleToUserServiceJava");
const { buildIdentityReadRolesServiceJava } = require("./backend/springboot/buildIdentityReadRolesServiceJava");
const { buildIdentityCreateRoleServiceJava } = require("./backend/springboot/buildIdentityCreateRoleServiceJava");
const { buildIdentityReadUserCredentialsServiceJava } = require("./backend/springboot/buildIdentityReadUserCredentialsServiceJava");
const { buildIdentityAuthenticationFlowServiceJava } = require("./backend/springboot/buildIdentityAuthenticationFlowServiceJava");
const { buildIdentityExternalAuthenticationServiceJava } = require("./backend/springboot/buildIdentityExternalAuthenticationServiceJava");
const { buildIdentityObserveUserSessionServiceJava } = require("./backend/springboot/buildIdentityObserveUserSessionServiceJava");
const { buildIdentityModuleConfigJava } = require("./backend/springboot/buildIdentityModuleConfigJava");
const { buildIdentityBootstrapPropertiesJava } = require("./backend/springboot/buildIdentityBootstrapPropertiesJava");
const { buildIdentityExternalIamPropertiesJava } = require("./backend/springboot/buildIdentityExternalIamPropertiesJava");
const { buildIdentitySessionSecurityPropertiesJava } = require("./backend/springboot/buildIdentitySessionSecurityPropertiesJava");
const { buildIdentityBootstrapSeederJava } = require("./backend/springboot/buildIdentityBootstrapSeederJava");
const { buildIdentityRoleEntityJava } = require("./backend/springboot/buildIdentityRoleEntityJava");
const { buildIdentityUserAccountEntityJava } = require("./backend/springboot/buildIdentityUserAccountEntityJava");
const { buildIdentityRoleJpaRepositoryJava } = require("./backend/springboot/buildIdentityRoleJpaRepositoryJava");
const { buildIdentityUserJpaRepositoryJava } = require("./backend/springboot/buildIdentityUserJpaRepositoryJava");
const { buildIdentityJpaIdentityRepositoryAdapterJava } = require("./backend/springboot/buildIdentityJpaIdentityRepositoryAdapterJava");
const { buildIdentityJpaAuthenticationFlowAdapterJava } = require("./backend/springboot/buildIdentityJpaAuthenticationFlowAdapterJava");
const { buildIdentityHs256ExternalIamAuthenticationAdapterJava } = require("./backend/springboot/buildIdentityHs256ExternalIamAuthenticationAdapterJava");
const { buildIdentityInMemorySessionObservationAdapterJava } = require("./backend/springboot/buildIdentityInMemorySessionObservationAdapterJava");
const { buildOrganizationDomainMarkerJava } = require("./backend/springboot/buildOrganizationDomainMarkerJava");
const { buildOrganizationUnitModelJava } = require("./backend/springboot/buildOrganizationUnitModelJava");
const { buildOrganizationHierarchyRepositoryPortJava } = require("./backend/springboot/buildOrganizationHierarchyRepositoryPortJava");
const { buildOrganizationApplicationMarkerJava } = require("./backend/springboot/buildOrganizationApplicationMarkerJava");
const { buildReadOrganizationHierarchyUseCaseJava } = require("./backend/springboot/buildReadOrganizationHierarchyUseCaseJava");
const { buildManageOrganizationHierarchyUseCaseJava } = require("./backend/springboot/buildManageOrganizationHierarchyUseCaseJava");
const { buildResolveHierarchyAssignmentUseCaseJava } = require("./backend/springboot/buildResolveHierarchyAssignmentUseCaseJava");
const { buildOrganizationHierarchyServiceJava } = require("./backend/springboot/buildOrganizationHierarchyServiceJava");
const { buildOrganizationInfrastructureMarkerJava } = require("./backend/springboot/buildOrganizationInfrastructureMarkerJava");
const { buildOrganizationHierarchyPropertiesJava } = require("./backend/springboot/buildOrganizationHierarchyPropertiesJava");
const { buildOrganizationModuleConfigJava } = require("./backend/springboot/buildOrganizationModuleConfigJava");
const { buildOrganizationInMemoryHierarchyRepositoryAdapterJava } = require("./backend/springboot/buildOrganizationInMemoryHierarchyRepositoryAdapterJava");
const { buildTestSupportMarkerJava } = require("./backend/springboot/buildTestSupportMarkerJava");
const { buildSystemApplicationUtJava } = require("./backend/springboot/buildSystemApplicationUtJava");
const { buildSystemInfrastructureItJava } = require("./backend/springboot/buildSystemInfrastructureItJava");
const { buildAuthenticationFlowsItJava } = require("./backend/springboot/buildAuthenticationFlowsItJava");
const { buildExternalIamAuthenticationItJava } = require("./backend/springboot/buildExternalIamAuthenticationItJava");
const { buildSessionDeviceSecurityItJava } = require("./backend/springboot/buildSessionDeviceSecurityItJava");
const { buildOrganizationHierarchyItJava } = require("./backend/springboot/buildOrganizationHierarchyItJava");
const { buildIdentityUserSessionObservationJava } = require("./backend/springboot/buildIdentityUserSessionObservationJava");
const { buildFrontendPackageJson } = require("./frontend/react/buildFrontendPackageJson");
const { buildFrontendIndexHtml } = require("./frontend/react/buildFrontendIndexHtml");
const { buildFrontendMainJsx } = require("./frontend/react/buildFrontendMainJsx");
const { buildFrontendSystemSnapshotModelJs } = require("./frontend/react/buildFrontendSystemSnapshotModelJs");
const { buildFrontendLoadSystemSnapshotPortJs } = require("./frontend/react/buildFrontendLoadSystemSnapshotPortJs");
const { buildFrontendReadSystemSnapshotUseCaseJs } = require("./frontend/react/buildFrontendReadSystemSnapshotUseCaseJs");
const { buildFrontendHttpSystemSnapshotAdapterJs } = require("./frontend/react/buildFrontendHttpSystemSnapshotAdapterJs");
const { buildFrontendUseSystemSnapshotHookJs } = require("./frontend/react/buildFrontendUseSystemSnapshotHookJs");
const { buildFrontendShellAppJsx } = require("./frontend/react/buildFrontendShellAppJsx");
const { buildFrontendIdentityUserModelJs } = require("./frontend/react/buildFrontendIdentityUserModelJs");
const { buildFrontendIdentityRoleModelJs } = require("./frontend/react/buildFrontendIdentityRoleModelJs");
const { buildFrontendLoadIdentityUsersPortJs } = require("./frontend/react/buildFrontendLoadIdentityUsersPortJs");
const { buildFrontendCreateIdentityUserPortJs } = require("./frontend/react/buildFrontendCreateIdentityUserPortJs");
const { buildFrontendLoadIdentityRolesPortJs } = require("./frontend/react/buildFrontendLoadIdentityRolesPortJs");
const { buildFrontendCreateIdentityRolePortJs } = require("./frontend/react/buildFrontendCreateIdentityRolePortJs");
const { buildFrontendAssignIdentityRolePortJs } = require("./frontend/react/buildFrontendAssignIdentityRolePortJs");
const { buildFrontendReadIdentityUsersUseCaseJs } = require("./frontend/react/buildFrontendReadIdentityUsersUseCaseJs");
const { buildFrontendCreateIdentityUserUseCaseJs } = require("./frontend/react/buildFrontendCreateIdentityUserUseCaseJs");
const { buildFrontendReadIdentityRolesUseCaseJs } = require("./frontend/react/buildFrontendReadIdentityRolesUseCaseJs");
const { buildFrontendCreateIdentityRoleUseCaseJs } = require("./frontend/react/buildFrontendCreateIdentityRoleUseCaseJs");
const { buildFrontendAssignIdentityRoleUseCaseJs } = require("./frontend/react/buildFrontendAssignIdentityRoleUseCaseJs");
const { buildFrontendHttpIdentityAdminAdapterJs } = require("./frontend/react/buildFrontendHttpIdentityAdminAdapterJs");
const { buildFrontendUseIdentityAdminHookJs } = require("./frontend/react/buildFrontendUseIdentityAdminHookJs");
const { buildFrontendIdentityAdminPanelJsx } = require("./frontend/react/buildFrontendIdentityAdminPanelJsx");
const { buildFrontendHttpAuthFlowsAdapterJs } = require("./frontend/react/buildFrontendHttpAuthFlowsAdapterJs");
const { buildFrontendUseAuthFlowsHookJs } = require("./frontend/react/buildFrontendUseAuthFlowsHookJs");
const { buildFrontendAuthenticationWorkbenchJsx } = require("./frontend/react/buildFrontendAuthenticationWorkbenchJsx");
const { buildFrontendHttpSessionSecurityAdapterJs } = require("./frontend/react/buildFrontendHttpSessionSecurityAdapterJs");
const { buildFrontendUseSessionSecurityHookJs } = require("./frontend/react/buildFrontendUseSessionSecurityHookJs");
const { buildFrontendSessionSecurityPanelJsx } = require("./frontend/react/buildFrontendSessionSecurityPanelJsx");
const { buildFrontendOrganizationUnitModelJs } = require("./frontend/react/buildFrontendOrganizationUnitModelJs");
const { buildFrontendReadOrganizationUnitsUseCaseJs } = require("./frontend/react/buildFrontendReadOrganizationUnitsUseCaseJs");
const { buildFrontendCreateOrganizationUnitUseCaseJs } = require("./frontend/react/buildFrontendCreateOrganizationUnitUseCaseJs");
const { buildFrontendAssignOrganizationSupervisorUseCaseJs } = require("./frontend/react/buildFrontendAssignOrganizationSupervisorUseCaseJs");
const { buildFrontendAssignOrganizationMemberUseCaseJs } = require("./frontend/react/buildFrontendAssignOrganizationMemberUseCaseJs");
const { buildFrontendResolveOrganizationAssignmentUseCaseJs } = require("./frontend/react/buildFrontendResolveOrganizationAssignmentUseCaseJs");
const { buildFrontendHttpOrganizationHierarchyAdapterJs } = require("./frontend/react/buildFrontendHttpOrganizationHierarchyAdapterJs");
const { buildFrontendUseOrganizationHierarchyHookJs } = require("./frontend/react/buildFrontendUseOrganizationHierarchyHookJs");
const { buildFrontendOrganizationHierarchyPanelJsx } = require("./frontend/react/buildFrontendOrganizationHierarchyPanelJsx");
const { buildFrontendCss } = require("./frontend/react/buildFrontendCss");
const { buildFrontendViteConfig } = require("./frontend/react/buildFrontendViteConfig");
const { buildComposeFile } = require("./deployment/docker/buildComposeFile");
const { buildFrontendDockerfile } = require("./frontend/react/buildFrontendDockerfile");
const { buildNginxConf } = require("./deployment/docker/buildNginxConf");
const { buildBuildAllPs1 } = require("./deployment/scripts/buildBuildAllPs1");
const { buildTestAllPs1 } = require("./deployment/scripts/buildTestAllPs1");
const { buildVerifyAllPs1 } = require("./deployment/scripts/buildVerifyAllPs1");
const { buildStartProfilePs1 } = require("./deployment/scripts/buildStartProfilePs1");
const { buildBuildAllSh } = require("./deployment/scripts/buildBuildAllSh");
const { buildTestAllSh } = require("./deployment/scripts/buildTestAllSh");
const { buildVerifyAllSh } = require("./deployment/scripts/buildVerifyAllSh");
const { buildStartProfileSh } = require("./deployment/scripts/buildStartProfileSh");
const { resolveProjectRoot } = require("./workspace/resolveProjectRoot");
const { buildWorkspaceReadme } = require("./workspace/buildWorkspaceReadme");
const { buildManagedManifest } = require("./workspace/buildManagedManifest");

module.exports = {
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
  buildBackendOrganizationPomXml,
  buildBackendOrganizationDomainPomXml,
  buildBackendOrganizationApplicationPomXml,
  buildBackendOrganizationInfrastructurePomXml,
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
  buildBackendDockerfile,
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
  buildGatewayOrganizationHierarchyControllerJava,
  buildGatewaySecurityConfigJava,
  buildGatewayPbkdf2WorkspacePasswordEncoderJava,
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
  buildOrganizationDomainMarkerJava,
  buildOrganizationUnitModelJava,
  buildOrganizationHierarchyRepositoryPortJava,
  buildOrganizationApplicationMarkerJava,
  buildReadOrganizationHierarchyUseCaseJava,
  buildManageOrganizationHierarchyUseCaseJava,
  buildResolveHierarchyAssignmentUseCaseJava,
  buildOrganizationHierarchyServiceJava,
  buildOrganizationInfrastructureMarkerJava,
  buildOrganizationHierarchyPropertiesJava,
  buildOrganizationModuleConfigJava,
  buildOrganizationInMemoryHierarchyRepositoryAdapterJava,
  buildTestSupportMarkerJava,
  buildSystemApplicationUtJava,
  buildSystemInfrastructureItJava,
  buildAuthenticationFlowsItJava,
  buildExternalIamAuthenticationItJava,
  buildSessionDeviceSecurityItJava,
  buildOrganizationHierarchyItJava,
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
  buildFrontendOrganizationUnitModelJs,
  buildFrontendReadOrganizationUnitsUseCaseJs,
  buildFrontendCreateOrganizationUnitUseCaseJs,
  buildFrontendAssignOrganizationSupervisorUseCaseJs,
  buildFrontendAssignOrganizationMemberUseCaseJs,
  buildFrontendResolveOrganizationAssignmentUseCaseJs,
  buildFrontendHttpOrganizationHierarchyAdapterJs,
  buildFrontendUseOrganizationHierarchyHookJs,
  buildFrontendOrganizationHierarchyPanelJsx,
  buildFrontendCss,
  buildFrontendViteConfig,
  buildComposeFile,
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
};
