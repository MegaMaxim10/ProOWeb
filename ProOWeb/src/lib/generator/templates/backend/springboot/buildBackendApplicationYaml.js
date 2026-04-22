const { escapeYamlDoubleQuotes } = require("../../_shared/escape");

function buildBackendApplicationYaml(config) {
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;
  const swaggerProfiles = config.backendOptions.swaggerUi.profiles.join(",");

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
  notifications:
    email:
      from: "no-reply@prooweb.local"
`;
}

module.exports = {
  buildBackendApplicationYaml,
};
