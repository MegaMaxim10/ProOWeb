function buildFrontendGeneratedProcessRuntimeApiJs() {
  return `const RUNTIME_NOT_DEPLOYED_MESSAGE =
  "No deployed process runtime artifacts detected yet. Deploy a process version from ProOWeb.";

function toEmptyPayload(key) {
  return { [key]: [] };
}

export function fetchProcessRuntimeStartOptions(_query = {}) {
  return Promise.resolve(toEmptyPayload("startOptions"));
}

export function startProcessRuntimeInstance(_payload) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function listProcessRuntimeTasks(_query = {}) {
  return Promise.resolve(toEmptyPayload("tasks"));
}

export function listProcessRuntimeInstances(_query = {}) {
  return Promise.resolve(toEmptyPayload("instances"));
}

export function completeProcessRuntimeTask(_taskId, _payload) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function assignProcessRuntimeTask(_taskId, _payload) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function readProcessRuntimeInstance(_instanceId, _query = {}) {
  return Promise.resolve({ instance: null });
}

export function readProcessRuntimeTimeline(_instanceId) {
  return Promise.resolve(toEmptyPayload("timeline"));
}

export function stopProcessRuntimeInstance(_instanceId, _payload) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function archiveProcessRuntimeInstance(_instanceId, _payload) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}
`;
}

module.exports = {
  buildFrontendGeneratedProcessRuntimeApiJs,
};
