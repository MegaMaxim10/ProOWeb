const { escapeYamlDoubleQuotes } = require("../../_shared/escape");

function buildBackendApplicationYaml(config, options = {}) {
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;
  const swaggerProfiles = config.backendOptions.swaggerUi.profiles.join(",");
  const externalIamConfig = config.backendOptions?.externalIam || {};
  const externalIamEnabled = Boolean(options.externalIamEnabled && externalIamConfig.enabled);
  const externalIamProviders = Array.isArray(externalIamConfig.providers)
    ? externalIamConfig.providers
    : [];
  const externalIamProvidersYaml = externalIamProviders.length > 0
    ? externalIamProviders.map((provider) => `        - id: "${escapeYamlDoubleQuotes(provider.id || "default-oidc")}"
          issuer-uri: "${escapeYamlDoubleQuotes(provider.issuerUri || "")}"
          client-id: "${escapeYamlDoubleQuotes(provider.clientId || "")}"
          client-secret: "${escapeYamlDoubleQuotes(provider.clientSecret || "")}"
          shared-secret: "${escapeYamlDoubleQuotes(provider.sharedSecret || "")}"
          username-claim: "${escapeYamlDoubleQuotes(provider.usernameClaim || "preferred_username")}"
          email-claim: "${escapeYamlDoubleQuotes(provider.emailClaim || "email")}"`).join("\n")
    : "        []";
  const externalIamSection = options.externalIamEnabled
    ? `
    external-iam:
      enabled: ${externalIamEnabled}
      providers:
${externalIamProvidersYaml}`
    : "";
  const sessionSecurityConfig = config.backendOptions?.sessionSecurity || {};
  const sessionSecuritySection = options.sessionSecurityEnabled
    ? `
    session-security:
      enabled: ${Boolean(sessionSecurityConfig.enabled)}
      suspicious-window-minutes: ${Number(sessionSecurityConfig.suspiciousWindowMinutes || 60)}
      max-distinct-devices: ${Number(sessionSecurityConfig.maxDistinctDevices || 3)}`
    : "";
  const organizationHierarchyConfig = config.backendOptions?.organizationHierarchy || {};
  const organizationHierarchySection = options.organizationHierarchyEnabled
    ? `
  organization:
    hierarchy:
      enabled: ${organizationHierarchyConfig.enabled === undefined
        ? true
        : Boolean(organizationHierarchyConfig.enabled)}
      default-assignment-strategy: "${escapeYamlDoubleQuotes(
        organizationHierarchyConfig.defaultAssignmentStrategy || "SUPERVISOR_THEN_ANCESTORS",
      )}"
      max-traversal-depth: ${Number(organizationHierarchyConfig.maxTraversalDepth || 8)}`
    : "";
  const notificationsConfig = config.backendOptions?.notifications || {};
  const notificationsSection = options.notificationsEnabled
    ? `
  notifications:
    enabled: ${notificationsConfig.enabled === undefined ? true : Boolean(notificationsConfig.enabled)}
    audit-enabled: ${notificationsConfig.auditEnabled === undefined ? true : Boolean(notificationsConfig.auditEnabled)}
    email:
      from: "${escapeYamlDoubleQuotes(notificationsConfig.senderAddress || "no-reply@prooweb.local")}"`
    : `
  notifications:
    enabled: false
    audit-enabled: false
    email:
      from: "${escapeYamlDoubleQuotes(notificationsConfig.senderAddress || "no-reply@prooweb.local")}"`;
  const databaseMigrationConfig = config.backendOptions?.databaseMigration || {};
  const liquibaseEnabled = options.liquibaseEnabled
    ? (databaseMigrationConfig.liquibaseEnabled === undefined
      ? true
      : Boolean(databaseMigrationConfig.liquibaseEnabled))
    : false;
  const liquibaseChangeLog = escapeYamlDoubleQuotes(
    databaseMigrationConfig.changelogPath || "classpath:db/changelog/db.changelog-master.yaml",
  );
  const liquibaseContexts = escapeYamlDoubleQuotes(
    databaseMigrationConfig.contexts || "baseline,reference-data",
  );
  const authSection = options.authEnabled
    ? `
  auth:
    login:
      mfa-enabled: true
      totp-window-seconds: 30`
    : "";
  const identitySection = options.identityEnabled
    ? `
  identity:
    bootstrap:
      enabled: true
      super-admin:
        name: "${escapeYamlDoubleQuotes(config.superAdmin?.name || "ProOWeb Super Admin")}"
        email: "${escapeYamlDoubleQuotes(config.superAdmin?.email || "admin@prooweb.local")}"
        username: "${escapeYamlDoubleQuotes(config.superAdmin?.username || "superadmin")}"
        password-hash: "${escapeYamlDoubleQuotes(config.superAdmin?.passwordHash || "")}"
        password-salt: "${escapeYamlDoubleQuotes(config.superAdmin?.passwordSalt || "")}"
        role-code: "PLATFORM_SUPER_ADMIN"
        role-description: "Platform super administrator"
        permissions:
          - "IDENTITY_SUPER_ADMIN"
          - "IDENTITY_USER_READ"
          - "IDENTITY_USER_CREATE"
          - "IDENTITY_ROLE_READ"
          - "IDENTITY_ROLE_CREATE"
          - "IDENTITY_ROLE_ASSIGN"${externalIamSection}${sessionSecuritySection}`
    : "";

  return `server:
  port: 8080

spring:
  application:
    name: ${config.project.slug}-backend
  datasource:
    url: \${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/prooweb}
    username: \${SPRING_DATASOURCE_USERNAME:prooweb}
    password: \${SPRING_DATASOURCE_PASSWORD:prooweb}
  jpa:
    hibernate:
      ddl-auto: ${liquibaseEnabled ? "validate" : "update"}
    properties:
      hibernate:
        format_sql: true
  liquibase:
    enabled: ${liquibaseEnabled}
    change-log: "${liquibaseChangeLog}"
    contexts: "${liquibaseContexts}"
  mail:
    host: \${SPRING_MAIL_HOST:localhost}
    port: \${SPRING_MAIL_PORT:1025}
    username: \${SPRING_MAIL_USERNAME:}
    password: \${SPRING_MAIL_PASSWORD:}

management:
  endpoints:
    web:
      exposure:
        include: health,info

springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false

app:
  site-title: "${escapeYamlDoubleQuotes(config.project.title)}"
  stack:
    backend: ${config.stack.backendTech}
    database: ${config.stack.databaseTech}
  backend:
    swagger-ui:
      enabled: ${swaggerEnabled}
      profiles: "${escapeYamlDoubleQuotes(swaggerProfiles)}"
${authSection}
${identitySection}
${organizationHierarchySection}
${notificationsSection}
`;
}

module.exports = {
  buildBackendApplicationYaml,
};
