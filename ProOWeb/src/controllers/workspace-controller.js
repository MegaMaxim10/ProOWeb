const { getServiceErrorStatusCode } = require("../errors/service-error");

function createWorkspaceController({ workspaceService, readJsonBody, sendJson }) {
  async function handleInitializeWorkspace(request, response) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = workspaceService.initializeWorkspace(payload);
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 400);
      sendJson(response, statusCode, { error: error.message });
    }
  }

  function handleStatus(_request, response) {
    const result = workspaceService.getWorkspaceStatus();
    sendJson(response, 200, result);
  }

  async function handleMigrateWorkspace(request, response) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = workspaceService.migrateWorkspace(payload);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, {
        error: error.message || "Erreur de migration.",
      });
    }
  }

  return {
    handleInitializeWorkspace,
    handleStatus,
    handleMigrateWorkspace,
  };
}

module.exports = {
  createWorkspaceController,
};
