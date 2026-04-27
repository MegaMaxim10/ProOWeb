function buildLiquibaseMasterChangelogYaml() {
  return `databaseChangeLog:
  - include:
      file: changesets/001-baseline-schema.yaml
      relativeToChangelogFile: true
  - include:
      file: changesets/010-reference-data.yaml
      relativeToChangelogFile: true
`;
}

module.exports = {
  buildLiquibaseMasterChangelogYaml,
};

