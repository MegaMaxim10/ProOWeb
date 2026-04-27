import { requestJson } from "../shared/http-client.js";

export function fetchProcessModels() {
  return requestJson("/api/process-models");
}

export function createProcessModel(payload) {
  return requestJson("/api/process-models", {
    method: "POST",
    body: payload,
  });
}

export function createProcessModelVersion(modelKey, payload) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/versions`, {
    method: "POST",
    body: payload,
  });
}

export function fetchProcessModelVersion(modelKey, versionNumber) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}`);
}

export function fetchProcessModelRuntimeContract(modelKey, versionNumber) {
  return requestJson(
    `/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}/runtime-contract`,
  );
}

export function fetchProcessModelSpecification(modelKey, versionNumber) {
  return requestJson(
    `/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}/specification`,
  );
}

export function validateProcessModelSpecification(modelKey, versionNumber, payload) {
  return requestJson(
    `/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}/specification/validate`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function saveProcessModelSpecification(modelKey, versionNumber, payload) {
  return requestJson(
    `/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}/specification`,
    {
      method: "PUT",
      body: payload,
    },
  );
}

export function compareProcessModelVersions(modelKey, sourceVersion, targetVersion) {
  const query = new URLSearchParams({
    sourceVersion: String(sourceVersion),
    targetVersion: String(targetVersion),
  });

  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/diff?${query.toString()}`);
}

export function transitionProcessModelVersion(modelKey, versionNumber, targetStatus) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}/transition`, {
    method: "POST",
    body: { targetStatus },
  });
}

export function deployProcessModelVersion(modelKey, versionNumber) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/versions/${encodeURIComponent(versionNumber)}/deploy`, {
    method: "POST",
    body: {},
  });
}

export function fetchProcessModelHistory(modelKey) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/history`);
}

export function createProcessModelSnapshot(modelKey, payload) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/history/snapshots`, {
    method: "POST",
    body: payload,
  });
}

export function undoProcessModelSnapshot(modelKey) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/history/undo`, {
    method: "POST",
    body: {},
  });
}

export function redoProcessModelSnapshot(modelKey) {
  return requestJson(`/api/process-models/${encodeURIComponent(modelKey)}/history/redo`, {
    method: "POST",
    body: {},
  });
}
