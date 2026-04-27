function buildLiquibaseReadmeMd() {
  return `# Liquibase Conventions

This folder is generated and managed by ProOWeb.

## Structure
- \`db.changelog-master.yaml\`: master changelog entry point.
- \`changesets/001-baseline-schema.yaml\`: baseline schema changes.
- \`changesets/010-reference-data.yaml\`: bootstrap reference data.

## Guidelines
1. Add new changesets using incremental prefixes (for example \`020-...\`).
2. Keep one concern per changeset file to simplify rollback analysis.
3. Use contexts to separate baseline schema from reference data.
4. Do not edit already executed changesets in production environments.
`;
}

module.exports = {
  buildLiquibaseReadmeMd,
};

