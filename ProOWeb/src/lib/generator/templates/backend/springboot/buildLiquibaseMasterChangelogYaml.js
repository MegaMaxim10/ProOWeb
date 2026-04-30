function buildLiquibaseMasterChangelogYaml() {
  return `databaseChangeLog:
  - include:
      file: changesets/001-baseline-schema.yaml
      relativeToChangelogFile: true
  - include:
      file: changesets/010-reference-data.yaml
      relativeToChangelogFile: true
  - include:
      file: changesets/900-process-shared-data.generated.yaml
      relativeToChangelogFile: true
`;
}

module.exports = {
  buildLiquibaseMasterChangelogYaml,
};
