#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const [, , action, maybeProfile] = process.argv;

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function resolveGeneratedRoot() {
  const configPath = path.join(rootDir, ".prooweb", "workspace.json");
  if (!existsSync(configPath)) {
    return "root";
  }

  try {
    const raw = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    const config = JSON.parse(raw);
    return config?.managedBy?.generatedRoot || "root";
  } catch (_) {
    return "root";
  }
}

function resolveProjectRoot(generatedRoot) {
  return generatedRoot === "root" ? rootDir : path.join(rootDir, generatedRoot);
}

const projectRoot = resolveProjectRoot(resolveGeneratedRoot());

function resolveCommand() {
  if (action === "build") {
    return isWindows
      ? {
          cmd: "powershell",
          args: ["-ExecutionPolicy", "Bypass", "-File", path.join(projectRoot, "build-all.ps1")],
          requiredFile: path.join(projectRoot, "build-all.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(projectRoot, "build-all.sh")],
          requiredFile: path.join(projectRoot, "build-all.sh"),
        };
  }

  if (action === "test") {
    return isWindows
      ? {
          cmd: "powershell",
          args: ["-ExecutionPolicy", "Bypass", "-File", path.join(projectRoot, "test-all.ps1")],
          requiredFile: path.join(projectRoot, "test-all.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(projectRoot, "test-all.sh")],
          requiredFile: path.join(projectRoot, "test-all.sh"),
        };
  }

  if (action === "verify") {
    return isWindows
      ? {
          cmd: "powershell",
          args: ["-ExecutionPolicy", "Bypass", "-File", path.join(projectRoot, "verify-all.ps1")],
          requiredFile: path.join(projectRoot, "verify-all.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(projectRoot, "verify-all.sh")],
          requiredFile: path.join(projectRoot, "verify-all.sh"),
        };
  }

  if (action === "start") {
    const profile = (maybeProfile || "dev").toLowerCase();
    return isWindows
      ? {
          cmd: "powershell",
          args: [
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            path.join(projectRoot, "start-profile.ps1"),
            "-Profile",
            profile,
          ],
          requiredFile: path.join(projectRoot, "start-profile.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(projectRoot, "start-profile.sh"), profile],
          requiredFile: path.join(projectRoot, "start-profile.sh"),
        };
  }

  return null;
}

const command = resolveCommand();
if (!command) {
  console.error("Unsupported action. Use: build, test, verify, start <profile>.");
  process.exit(1);
}

if (!existsSync(command.requiredFile)) {
  console.error(
    "Workspace non initialise: scripts manquants. Lancez d'abord `npm run prooweb` puis terminez le wizard.",
  );
  process.exit(1);
}

const result = spawnSync(command.cmd, command.args, {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
});

process.exit(result.status || 0);
