const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const { generateWorkspace } = require("./generator");

function normalizePath(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function toMigrationId() {
  const iso = new Date().toISOString();
  return iso.replace(/[:.]/g, "-");
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readFileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return sha256Buffer(buffer);
}

function ensureWithinRoot(rootDir, targetPath) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedTarget === resolvedRoot) {
    return resolvedTarget;
  }

  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Ecriture refusee hors racine projet: ${resolvedTarget}`);
  }

  return resolvedTarget;
}

function resolveProjectFilePath(rootDir, relativePath) {
  const normalized = normalizePath(relativePath);
  const target = path.resolve(rootDir, normalized);
  return ensureWithinRoot(rootDir, target);
}

function resolveManagedProjectRoot(rootDir, generatedRoot) {
  const normalized = normalizePath(generatedRoot || "") || "root";
  if (normalized === "root") {
    return path.resolve(rootDir);
  }

  return resolveProjectFilePath(rootDir, normalized);
}

function readBaselineManifest(rootDir, currentConfig) {
  const generatedRoot = currentConfig?.managedBy?.generatedRoot || "root";
  const managedProjectRoot = resolveManagedProjectRoot(rootDir, generatedRoot);
  const manifestPath = path.join(managedProjectRoot, ".prooweb-managed.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function backupFile(rootDir, migrationId, relativePath) {
  const sourcePath = resolveProjectFilePath(rootDir, relativePath);
  const backupPath = resolveProjectFilePath(
    rootDir,
    path.join(".prooweb", "backups", migrationId, normalizePath(relativePath)),
  );

  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(sourcePath, backupPath);

  return normalizePath(path.relative(rootDir, backupPath));
}

function buildBaselineMap(rootDir, currentConfig) {
  const baselineManifest = readBaselineManifest(rootDir, currentConfig);
  const baselineMap = new Map();

  for (const entry of baselineManifest?.managedFiles || []) {
    if (!entry || !entry.path) {
      continue;
    }

    baselineMap.set(normalizePath(entry.path), {
      sha256: entry.sha256 || null,
    });
  }

  return {
    baselineManifest,
    baselineMap,
  };
}

function createGenerationSnapshot(targetConfig, mode) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "prooweb-migrate-"));

  try {
    const generation = generateWorkspace(tempRoot, targetConfig, { mode });
    const generatedFiles = generation.writtenFiles.map((entry) => {
      const relPath = normalizePath(entry.path);
      const absPath = resolveProjectFilePath(tempRoot, relPath);
      const content = fs.readFileSync(absPath, "utf8");

      return {
        path: relPath,
        sha256: entry.sha256,
        content,
      };
    });

    return {
      tempRoot,
      generation,
      generatedFiles,
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function runSmartMigration({ rootDir, currentConfig, targetConfig, mode = "infra" }) {
  const migrationId = toMigrationId();
  const { baselineMap } = buildBaselineMap(rootDir, currentConfig);

  const snapshot = createGenerationSnapshot(targetConfig, mode);
  const generatedPaths = new Set(snapshot.generatedFiles.map((file) => file.path));

  const report = {
    migrationId,
    mode,
    backupRoot: normalizePath(path.join(".prooweb", "backups", migrationId)),
    summary: {
      filesGenerated: snapshot.generatedFiles.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      conflictsResolved: 0,
      collisionsResolved: 0,
      backupsCreated: 0,
      staleManagedFiles: 0,
    },
    details: {
      created: [],
      updated: [],
      unchanged: [],
      conflictsResolved: [],
      collisionsResolved: [],
      staleManagedFiles: [],
      backups: [],
    },
  };

  try {
    for (const generatedFile of snapshot.generatedFiles) {
      const relPath = generatedFile.path;
      const projectFilePath = resolveProjectFilePath(rootDir, relPath);
      const exists = fs.existsSync(projectFilePath);

      const previous = baselineMap.get(relPath);
      const previousHash = previous?.sha256 || null;
      const currentHash = exists ? readFileHash(projectFilePath) : null;
      const newHash = generatedFile.sha256;

      if (!exists) {
        fs.mkdirSync(path.dirname(projectFilePath), { recursive: true });
        fs.writeFileSync(projectFilePath, generatedFile.content, "utf8");
        report.summary.created += 1;
        report.details.created.push({ path: relPath, action: "create" });
        continue;
      }

      if (currentHash === newHash) {
        report.summary.unchanged += 1;
        report.details.unchanged.push({ path: relPath, action: "unchanged" });
        continue;
      }

      const manuallyChanged = Boolean(previousHash) && currentHash !== previousHash;
      const collision = !previousHash && relPath !== ".prooweb-managed.json";

      if (manuallyChanged) {
        const backupPath = backupFile(rootDir, migrationId, relPath);
        report.summary.backupsCreated += 1;
        report.details.backups.push({ path: relPath, backupPath });

        fs.writeFileSync(projectFilePath, generatedFile.content, "utf8");

        report.summary.conflictsResolved += 1;
        report.details.conflictsResolved.push({
          path: relPath,
          action: "backup_then_overwrite",
          previousManagedHash: previousHash,
          currentHash,
          newHash,
          backupPath,
        });
        continue;
      }

      if (collision) {
        const backupPath = backupFile(rootDir, migrationId, relPath);
        report.summary.backupsCreated += 1;
        report.details.backups.push({ path: relPath, backupPath });

        fs.writeFileSync(projectFilePath, generatedFile.content, "utf8");

        report.summary.collisionsResolved += 1;
        report.details.collisionsResolved.push({
          path: relPath,
          action: "adopt_path_backup_then_overwrite",
          currentHash,
          newHash,
          backupPath,
        });
        continue;
      }

      fs.writeFileSync(projectFilePath, generatedFile.content, "utf8");
      report.summary.updated += 1;
      report.details.updated.push({
        path: relPath,
        action: "overwrite_managed",
        previousManagedHash: previousHash,
        currentHash,
        newHash,
      });
    }

    for (const [oldPath, baselineEntry] of baselineMap.entries()) {
      if (generatedPaths.has(oldPath)) {
        continue;
      }

      const projectFilePath = resolveProjectFilePath(rootDir, oldPath);
      if (!fs.existsSync(projectFilePath)) {
        continue;
      }

      const currentHash = readFileHash(projectFilePath);
      const manuallyChanged = baselineEntry.sha256 && baselineEntry.sha256 !== currentHash;

      report.summary.staleManagedFiles += 1;
      report.details.staleManagedFiles.push({
        path: oldPath,
        action: "stale_managed_file",
        manuallyChanged,
      });
    }

    return report;
  } finally {
    fs.rmSync(snapshot.tempRoot, { recursive: true, force: true });
  }
}

module.exports = {
  runSmartMigration,
};

