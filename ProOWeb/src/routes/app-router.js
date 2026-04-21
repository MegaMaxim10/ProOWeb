const path = require("node:path");
const { URL } = require("node:url");

function createAppRouter({
  workspaceController,
  publicFileHandler,
  isWorkspaceInitialized,
  sendText,
}) {
  return function routeRequest(request, response) {
    const method = request.method || "GET";
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (method === "GET" && url.pathname === "/api/status") {
      workspaceController.handleStatus(request, response);
      return;
    }

    if (method === "POST" && url.pathname === "/api/init") {
      workspaceController.handleInitializeWorkspace(request, response);
      return;
    }

    if (method === "POST" && url.pathname === "/api/migrate") {
      workspaceController.handleMigrateWorkspace(request, response);
      return;
    }

    if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const fileName = isWorkspaceInitialized() ? "dashboard.html" : "wizard.html";
      publicFileHandler.sendFile(response, path.join(publicFileHandler.resolvedPublicDir, fileName));
      return;
    }

    if (method === "GET" && url.pathname === "/wizard") {
      publicFileHandler.sendFile(response, path.join(publicFileHandler.resolvedPublicDir, "wizard.html"));
      return;
    }

    if (method === "GET" && url.pathname === "/dashboard") {
      publicFileHandler.sendFile(response, path.join(publicFileHandler.resolvedPublicDir, "dashboard.html"));
      return;
    }

    if (method === "GET") {
      publicFileHandler.sendFile(response, publicFileHandler.resolvePublicPath(url.pathname));
      return;
    }

    sendText(response, 404, "Not found");
  };
}

module.exports = {
  createAppRouter,
};
