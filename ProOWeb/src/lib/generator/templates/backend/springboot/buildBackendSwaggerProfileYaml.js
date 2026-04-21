function buildBackendSwaggerProfileYaml() {
  return `springdoc:
  api-docs:
    enabled: true
    path: /v3/api-docs
  swagger-ui:
    enabled: true
    path: /swagger-ui.html
`;
}

module.exports = {
  buildBackendSwaggerProfileYaml,
};
