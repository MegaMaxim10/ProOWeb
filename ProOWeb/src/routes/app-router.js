const path = require("node:path");
const { URL } = require("node:url");

function createAppRouter({
  workspaceController,
  processModelController,
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

    if (method === "POST" && url.pathname === "/api/reconfigure") {
      workspaceController.handleReconfigureWorkspace(request, response);
      return;
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (processModelController) {
      if (method === "GET" && url.pathname === "/api/process-models") {
        processModelController.handleListProcessModels(request, response);
        return;
      }

      if (method === "POST" && url.pathname === "/api/process-models") {
        processModelController.handleCreateProcessModel(request, response);
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 4
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        processModelController.handleCreateProcessModelVersion(request, response, modelKey);
        return;
      }

      if (
        method === "GET"
        && pathSegments.length === 5
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleReadProcessModelVersion(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "GET"
        && pathSegments.length === 6
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "runtime-contract"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleReadProcessModelVersionRuntimeContract(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "GET"
        && pathSegments.length === 6
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "data-contract"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleReadProcessModelVersionDataContract(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "GET"
        && pathSegments.length === 6
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "specification"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleReadProcessModelVersionSpecification(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 7
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "specification"
        && pathSegments[6] === "validate"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleValidateProcessModelVersionSpecification(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "PUT"
        && pathSegments.length === 6
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "specification"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleSaveProcessModelVersionSpecification(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "GET"
        && pathSegments.length === 4
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "diff"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        processModelController.handleCompareProcessModelVersions(request, response, modelKey, url.searchParams);
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 6
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "transition"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleTransitionProcessModelVersion(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 6
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "versions"
        && pathSegments[5] === "deploy"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        const versionNumber = decodeURIComponent(pathSegments[4]);
        processModelController.handleDeployProcessModelVersion(
          request,
          response,
          modelKey,
          versionNumber,
        );
        return;
      }

      if (
        method === "GET"
        && pathSegments.length === 4
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "history"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        processModelController.handleReadProcessModelHistory(request, response, modelKey);
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 5
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "history"
        && pathSegments[4] === "snapshots"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        processModelController.handleCreateProcessModelSnapshot(request, response, modelKey);
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 5
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "history"
        && pathSegments[4] === "undo"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        processModelController.handleUndoProcessModelSnapshot(request, response, modelKey);
        return;
      }

      if (
        method === "POST"
        && pathSegments.length === 5
        && pathSegments[0] === "api"
        && pathSegments[1] === "process-models"
        && pathSegments[3] === "history"
        && pathSegments[4] === "redo"
      ) {
        const modelKey = decodeURIComponent(pathSegments[2]);
        processModelController.handleRedoProcessModelSnapshot(request, response, modelKey);
        return;
      }
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
