function buildManagedManifest(config, generatedRoot, managedFiles, mode) {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      managedProjectVersion: config.managedBy.managedProjectVersion,
      layoutVersion: config.managedBy.layoutVersion,
      editorVersion: config.managedBy.editorVersion,
      generatedRoot,
      generatedAt: new Date().toISOString(),
      lastMigrationAt: config.managedBy.lastMigratedAt,
      mode,
      managedFiles,
    },
    null,
    2,
  )}\n`;
}

module.exports = {
  buildManagedManifest,
};
