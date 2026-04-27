const { getServiceErrorStatusCode } = require("../errors/service-error");

function createProcessModelController({ processModelService, readJsonBody, sendJson }) {
  function handleListProcessModels(_request, response) {
    try {
      const result = processModelService.listModels();
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to list process models." });
    }
  }

  async function handleCreateProcessModel(request, response) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = processModelService.createModel(payload);
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to create process model." });
    }
  }

  async function handleCreateProcessModelVersion(request, response, modelKey) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = processModelService.createModelVersion(modelKey, payload);
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to create process model version." });
    }
  }

  function handleReadProcessModelVersion(_request, response, modelKey, versionNumber) {
    try {
      const result = processModelService.readModelVersion(modelKey, versionNumber);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to read process model version." });
    }
  }

  function handleReadProcessModelVersionSpecification(_request, response, modelKey, versionNumber) {
    try {
      const result = processModelService.readModelVersionSpecification(modelKey, versionNumber);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to read process specification." });
    }
  }

  async function handleValidateProcessModelVersionSpecification(request, response, modelKey, versionNumber) {
    let payload = {};
    try {
      payload = await readJsonBody(request).catch(() => ({}));
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = processModelService.validateModelVersionSpecification(
        modelKey,
        versionNumber,
        payload,
      );
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to validate process specification." });
    }
  }

  async function handleSaveProcessModelVersionSpecification(request, response, modelKey, versionNumber) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = processModelService.saveModelVersionSpecification(
        modelKey,
        versionNumber,
        payload,
      );
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to save process specification." });
    }
  }

  function handleCompareProcessModelVersions(_request, response, modelKey, query) {
    try {
      const sourceVersion = query.get("sourceVersion");
      const targetVersion = query.get("targetVersion");
      const result = processModelService.compareModelVersions(modelKey, sourceVersion, targetVersion);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to compare versions." });
    }
  }

  async function handleTransitionProcessModelVersion(request, response, modelKey, versionNumber) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = processModelService.transitionModelVersion(modelKey, versionNumber, payload);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to transition version." });
    }
  }

  async function handleDeployProcessModelVersion(request, response, modelKey, versionNumber) {
    try {
      await readJsonBody(request).catch(() => ({}));
      const result = processModelService.deployModelVersion(modelKey, versionNumber);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to deploy process version." });
    }
  }

  function handleReadProcessModelHistory(_request, response, modelKey) {
    try {
      const result = processModelService.readStudioHistory(modelKey);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to read process model history." });
    }
  }

  async function handleCreateProcessModelSnapshot(request, response, modelKey) {
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    try {
      const result = processModelService.createStudioSnapshot(modelKey, payload);
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to create process model snapshot." });
    }
  }

  async function handleUndoProcessModelSnapshot(_request, response, modelKey) {
    try {
      const result = processModelService.undoStudio(modelKey);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to undo process model snapshot." });
    }
  }

  async function handleRedoProcessModelSnapshot(_request, response, modelKey) {
    try {
      const result = processModelService.redoStudio(modelKey);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = getServiceErrorStatusCode(error, 500);
      sendJson(response, statusCode, { error: error.message || "Failed to redo process model snapshot." });
    }
  }

  return {
    handleListProcessModels,
    handleCreateProcessModel,
    handleCreateProcessModelVersion,
    handleReadProcessModelVersion,
    handleReadProcessModelVersionSpecification,
    handleValidateProcessModelVersionSpecification,
    handleSaveProcessModelVersionSpecification,
    handleCompareProcessModelVersions,
    handleTransitionProcessModelVersion,
    handleDeployProcessModelVersion,
    handleReadProcessModelHistory,
    handleCreateProcessModelSnapshot,
    handleUndoProcessModelSnapshot,
    handleRedoProcessModelSnapshot,
  };
}

module.exports = {
  createProcessModelController,
};
