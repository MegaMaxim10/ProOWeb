const { escapeYamlDoubleQuotes } = require("../../_shared/escape");

function buildBackendApplicationYaml(config) {
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;
  const swaggerProfiles = config.backendOptions.swaggerUi.profiles.join(",");

  return `server:
  port: 8080

spring:
  application:
    name: ${config.project.slug}-backend

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
`;
}

module.exports = {
  buildBackendApplicationYaml,
};
