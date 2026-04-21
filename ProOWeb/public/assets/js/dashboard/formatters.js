export function describeGeneratedRoot(generatedRoot) {
  return generatedRoot === "root" ? "racine du depot" : generatedRoot;
}

export function buildMigrationSummary(migration) {
  if (!migration || !migration.summary) {
    return "Migration terminee.";
  }

  const summary = migration.summary;

  return [
    "Migration " + migration.mode + " terminee",
    "crees " + summary.created,
    "maj " + summary.updated,
    "inchanges " + summary.unchanged,
    "conflits resolus " + summary.conflictsResolved,
    "collisions resolues " + summary.collisionsResolved,
    "backups " + summary.backupsCreated,
  ].join(" | ");
}
