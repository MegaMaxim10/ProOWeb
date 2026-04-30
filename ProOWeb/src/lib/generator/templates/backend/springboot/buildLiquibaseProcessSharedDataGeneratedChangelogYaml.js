function buildLiquibaseProcessSharedDataGeneratedChangelogYaml() {
  return `databaseChangeLog:
  - changeSet:
      id: 900-process-shared-data-schema
      author: prooweb
      changes:
        - sql:
            splitStatements: false
            sql: "-- Managed by ProOWeb process deployment compiler."
`;
}

module.exports = {
  buildLiquibaseProcessSharedDataGeneratedChangelogYaml,
};
