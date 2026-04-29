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
    "fichiers customises " + Number(summary.filesWithOverrides || 0),
    "overrides appliques " + Number(summary.overrideApplications || 0),
  ].join(" | ");
}

function appendPaths(lines, label, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  lines.push("");
  lines.push(label + ":");
  for (const entry of entries) {
    if (!entry?.path) {
      continue;
    }

    const action = entry.action ? " (" + entry.action + ")" : "";
    lines.push("- " + entry.path + action);
  }
}

export function buildDetailedMigrationReport(migration) {
  if (!migration || !migration.summary) {
    return "No migration details available.";
  }

  const summary = migration.summary;
  const lines = [
    "Migration ID: " + (migration.migrationId || "-"),
    "Mode: " + (migration.mode || "-"),
    "Backup root: " + (migration.backupRoot || "-"),
    "",
    "Summary:",
    "- generated: " + Number(summary.filesGenerated || 0),
    "- created: " + Number(summary.created || 0),
    "- updated: " + Number(summary.updated || 0),
    "- unchanged: " + Number(summary.unchanged || 0),
    "- conflicts resolved: " + Number(summary.conflictsResolved || 0),
    "- collisions resolved: " + Number(summary.collisionsResolved || 0),
    "- backups created: " + Number(summary.backupsCreated || 0),
    "- stale managed files: " + Number(summary.staleManagedFiles || 0),
    "- files with template overrides: " + Number(summary.filesWithOverrides || 0),
    "- template overrides applied: " + Number(summary.overrideApplications || 0),
    "- template overrides skipped: " + Number(summary.overrideSkips || 0),
  ];

  const featurePacks = migration.featurePacks || {};
  lines.push("");
  lines.push("Feature packs:");
  lines.push("- added: " + ((featurePacks.added || []).join(", ") || "(none)"));
  lines.push("- removed: " + ((featurePacks.removed || []).join(", ") || "(none)"));
  lines.push("- unchanged: " + ((featurePacks.unchanged || []).join(", ") || "(none)"));

  const details = migration.details || {};
  appendPaths(lines, "Created files", details.created);
  appendPaths(lines, "Updated files", details.updated);
  appendPaths(lines, "Conflicts resolved", details.conflictsResolved);
  appendPaths(lines, "Collisions resolved", details.collisionsResolved);
  appendPaths(lines, "Stale managed files", details.staleManagedFiles);
  appendPaths(lines, "Backup files", details.backups);

  if (Array.isArray(details.overrideSkips) && details.overrideSkips.length > 0) {
    lines.push("");
    lines.push("Template override skips:");
    for (const entry of details.overrideSkips) {
      const pathLabel = entry?.path ? `- ${entry.path}` : "- (unknown path)";
      lines.push(pathLabel);
      const skips = Array.isArray(entry?.skips) ? entry.skips : [];
      for (const skip of skips) {
        lines.push("  * " + (skip.id || "unknown") + " -> " + (skip.reason || "skipped"));
      }
    }
  }

  return lines.join("\n");
}
