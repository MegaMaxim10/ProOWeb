const { getServiceErrorStatusCode } = require("../errors/service-error");

function createWorkspaceController({ workspaceService, readJsonBody, sendJson }) {
  async function readOptionalJsonBody(request) {
    try {
      return await readJsonBody(request);
    } catch (_) {
      return {};
    }
  }

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
        error: error.message || "Migration failed.",
      });
    }
  }

  async function handleReconfigureWorkspace(request, response) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = workspaceService.reconfigureWorkspace(payload);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, {
        error: error.message || "Reconfiguration failed.",
      });
    }
  }

  function handleListTemplateOverrides(_request, response) {
    try {
      const result = workspaceService.listWorkspaceTemplateOverrides();
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, {
        error: error.message || "Template override listing failed.",
      });
    }
  }

  async function handleSaveTemplateOverride(request, response) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = workspaceService.saveWorkspaceTemplateOverride(payload);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, {
        error: error.message || "Template override save failed.",
      });
    }
  }

  async function handleDeleteTemplateOverride(request, response, overrideId) {
    const payload = await readOptionalJsonBody(request);

    try {
      const result = workspaceService.deleteWorkspaceTemplateOverride(overrideId, payload);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, {
        error: error.message || "Template override deletion failed.",
      });
    }
  }

  return {
    handleInitializeWorkspace,
    handleStatus,
    handleMigrateWorkspace,
    handleReconfigureWorkspace,
    handleListTemplateOverrides,
    handleSaveTemplateOverride,
    handleDeleteTemplateOverride,
  };
}

module.exports = {
  createWorkspaceController,
};
