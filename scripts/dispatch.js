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
    return "workspace";
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    return config?.managedBy?.generatedRoot || "workspace";
  } catch (_) {
    return "workspace";
  }
}

const generatedRoot = path.join(rootDir, resolveGeneratedRoot());

function resolveCommand() {
  if (action === "build") {
    return isWindows
      ? {
          cmd: "powershell",
          args: ["-ExecutionPolicy", "Bypass", "-File", path.join(generatedRoot, "build-all.ps1")],
          requiredFile: path.join(generatedRoot, "build-all.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(generatedRoot, "build-all.sh")],
          requiredFile: path.join(generatedRoot, "build-all.sh"),
        };
  }

  if (action === "test") {
    return isWindows
      ? {
          cmd: "powershell",
          args: ["-ExecutionPolicy", "Bypass", "-File", path.join(generatedRoot, "test-all.ps1")],
          requiredFile: path.join(generatedRoot, "test-all.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(generatedRoot, "test-all.sh")],
          requiredFile: path.join(generatedRoot, "test-all.sh"),
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
            path.join(generatedRoot, "start-profile.ps1"),
            "-Profile",
            profile,
          ],
          requiredFile: path.join(generatedRoot, "start-profile.ps1"),
        }
      : {
          cmd: "bash",
          args: [path.join(generatedRoot, "start-profile.sh"), profile],
          requiredFile: path.join(generatedRoot, "start-profile.sh"),
        };
  }

  return null;
}

const command = resolveCommand();
if (!command) {
  console.error("Action non supportee. Utiliser: build, test, start <profile>.");
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
