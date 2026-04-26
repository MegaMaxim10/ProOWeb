function buildManagedManifest(config, generatedRoot, managedFiles, mode) {
  const managedFilesByOwner = {};

  for (const entry of managedFiles) {
    const owners = Array.isArray(entry.owners) && entry.owners.length > 0 ? entry.owners : ["unassigned"];
    for (const owner of owners) {
      if (!managedFilesByOwner[owner]) {
        managedFilesByOwner[owner] = 0;
      }
      managedFilesByOwner[owner] += 1;
    }
  }

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
      featurePacks: config.featurePacks || null,
      managedFilesByOwner,
      managedFiles,
    },
    null,
    2,
  )}\n`;
}

module.exports = {
  buildManagedManifest,
};
