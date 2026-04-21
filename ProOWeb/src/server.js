const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const {
  ROOT_DIR,
  isWorkspaceInitialized,
  readWorkspaceConfig,
  toPublicWorkspaceConfig,
  buildWorkspaceConfig,
  writeWorkspaceConfig,
  getManagementStatus,
  markWorkspaceMigrated,
} = require("./lib/workspace");
const { generateWorkspace } = require("./lib/generator");
const { applyGitRepositoryPolicy } = require("./lib/git");
const { runSmartMigration } = require("./lib/migration");

const PORT = Number(process.env.PROOWEB_PORT || 1755);
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

function sendFile(response, absoluteFilePath) {
  if (!absoluteFilePath.startsWith(PUBLIC_DIR)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.readFile(absoluteFilePath, (error, buffer) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendText(response, 404, "Not found");
        return;
      }
      sendText(response, 500, "Unable to read file");
      return;
    }

    const extension = path.extname(absoluteFilePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
    });
    response.end(buffer);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

async function handleInitializeWorkspace(request, response) {
  if (isWorkspaceInitialized()) {
    sendJson(response, 409, {
      error: "Workspace deja initialise.",
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  try {
    const config = buildWorkspaceConfig(payload);
    const generationReport = generateWorkspace(ROOT_DIR, config, { mode: "full" });
    const gitPolicy = applyGitRepositoryPolicy(ROOT_DIR, config.project.gitRepositoryUrl);

    writeWorkspaceConfig(config);

    sendJson(response, 201, {
      message: "Workspace initialise avec succes.",
      workspace: toPublicWorkspaceConfig(config),
      management: getManagementStatus(config),
      generation: generationReport,
      gitPolicy,
    });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

function handleStatus(response) {
  const initialized = isWorkspaceInitialized();
  const config = initialized ? readWorkspaceConfig() : null;

  sendJson(response, 200, {
    initialized,
    workspace: toPublicWorkspaceConfig(config),
    management: getManagementStatus(config),
  });
}

async function handleMigrateWorkspace(request, response) {
  if (!isWorkspaceInitialized()) {
    sendJson(response, 409, { error: "Workspace non initialise." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  const mode = payload?.mode === "full" ? "full" : "infra";

  try {
    const currentConfig = readWorkspaceConfig();
    const migratedConfig = markWorkspaceMigrated(currentConfig);

    const migrationReport = runSmartMigration({
      rootDir: ROOT_DIR,
      currentConfig,
      targetConfig: migratedConfig,
      mode,
    });

    writeWorkspaceConfig(migratedConfig);

    sendJson(response, 200, {
      message: "Migration intelligente appliquee avec succes.",
      workspace: toPublicWorkspaceConfig(migratedConfig),
      management: getManagementStatus(migratedConfig),
      migration: migrationReport,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Erreur de migration." });
  }
}

function resolvePublicPath(urlPathname) {
  const cleaned = decodeURIComponent(urlPathname).replace(/^\/+/, "");
  const normalized = cleaned || "index.html";
  return path.resolve(PUBLIC_DIR, normalized);
}

function routeRequest(request, response) {
  const method = request.method || "GET";
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (method === "GET" && url.pathname === "/api/status") {
    handleStatus(response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/init") {
    handleInitializeWorkspace(request, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/migrate") {
    handleMigrateWorkspace(request, response);
    return;
  }

  if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const fileName = isWorkspaceInitialized() ? "dashboard.html" : "wizard.html";
    sendFile(response, path.join(PUBLIC_DIR, fileName));
    return;
  }

  if (method === "GET" && url.pathname === "/wizard") {
    sendFile(response, path.join(PUBLIC_DIR, "wizard.html"));
    return;
  }

  if (method === "GET" && url.pathname === "/dashboard") {
    sendFile(response, path.join(PUBLIC_DIR, "dashboard.html"));
    return;
  }

  if (method === "GET") {
    sendFile(response, resolvePublicPath(url.pathname));
    return;
  }

  sendText(response, 404, "Not found");
}

const server = http.createServer((request, response) => {
  routeRequest(request, response);
});

server.listen(PORT, () => {
  console.log(`ProOWeb editor is running on http://localhost:${PORT}`);
  console.log(`Workspace root: ${ROOT_DIR}`);
});
