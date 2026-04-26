const { escapeYamlDoubleQuotes } = require("../../_shared/escape");

function buildBackendApplicationYaml(config, options = {}) {
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;
  const swaggerProfiles = config.backendOptions.swaggerUi.profiles.join(",");
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
          - "IDENTITY_ROLE_ASSIGN"`
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
      ddl-auto: update
    properties:
      hibernate:
        format_sql: true
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
${identitySection}
  notifications:
    email:
      from: "no-reply@prooweb.local"
`;
}

module.exports = {
  buildBackendApplicationYaml,
};
