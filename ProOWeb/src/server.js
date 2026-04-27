const http = require("node:http");
const path = require("node:path");

const { ROOT_DIR, isWorkspaceInitialized } = require("./lib/workspace");
const { sendJson, sendText } = require("./http/responder");
const { readJsonBody } = require("./http/json-body");
const { createPublicFileHandler } = require("./http/public-file-handler");
const { createWorkspaceService } = require("./services/workspace-service");
const { createProcessModelService } = require("./services/process-model-service");
const { createWorkspaceController } = require("./controllers/workspace-controller");
const { createProcessModelController } = require("./controllers/process-model-controller");
const { createAppRouter } = require("./routes/app-router");

const PORT = Number(process.env.PROOWEB_PORT || 1755);
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const workspaceService = createWorkspaceService();
const processModelService = createProcessModelService();
const workspaceController = createWorkspaceController({
  workspaceService,
  readJsonBody,
  sendJson,
});
const processModelController = createProcessModelController({
  processModelService,
  readJsonBody,
  sendJson,
});
const publicFileHandler = createPublicFileHandler({
  publicDir: PUBLIC_DIR,
  sendText,
});

const routeRequest = createAppRouter({
  workspaceController,
  processModelController,
  publicFileHandler,
  isWorkspaceInitialized,
  sendText,
});

const server = http.createServer((request, response) => {
  routeRequest(request, response);
});

server.listen(PORT, () => {
  console.log(`ProOWeb editor is running on http://localhost:${PORT}`);
  console.log(`Workspace root: ${ROOT_DIR}`);
});
