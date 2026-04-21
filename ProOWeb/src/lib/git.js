const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function normalizeString(value) {
  return String(value || "").trim();
}

function getGitDir(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const gitDir = path.resolve(resolvedRoot, ".git");

  if (path.dirname(gitDir) !== resolvedRoot) {
    throw new Error("Chemin .git invalide.");
  }

  return gitDir;
}

function removeGitDirectory(rootDir) {
  const gitDir = getGitDir(rootDir);

  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
    return true;
  }

  return false;
}

function runGit(rootDir, args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error("Git n'est pas installe sur cette machine.");
    }

    if (result.error.code === "EPERM") {
      throw new Error("Execution de git bloquee par l'environnement courant.");
    }

    throw new Error(result.error.message || "Erreur inattendue lors de l'execution git.");
  }

  if (result.status !== 0) {
    const details = normalizeString(result.stderr) || normalizeString(result.stdout) || "erreur git inconnue";
    throw new Error(`Echec commande git ${args.join(" ")}: ${details}`);
  }
}

function applyGitRepositoryPolicy(rootDir, gitRepositoryUrl) {
  const normalizedUrl = normalizeString(gitRepositoryUrl);

  if (!normalizedUrl) {
    const removed = removeGitDirectory(rootDir);
    return {
      mode: "remove_git",
      removed,
      repositoryUrl: null,
    };
  }

  removeGitDirectory(rootDir);
  runGit(rootDir, ["init"]);
  runGit(rootDir, ["branch", "-M", "main"]);
  runGit(rootDir, ["remote", "add", "origin", normalizedUrl]);

  return {
    mode: "replace_git",
    removed: true,
    repositoryUrl: normalizedUrl,
  };
}

module.exports = {
  applyGitRepositoryPolicy,
};
