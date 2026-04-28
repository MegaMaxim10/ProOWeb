function buildFrontendGeneratedProcessRuntimeApiJs() {
  return `const RUNTIME_NOT_DEPLOYED_MESSAGE =
  "No deployed process runtime artifacts detected yet. Deploy a process version from ProOWeb.";

function toEmptyPayload(key) {
  return { [key]: [] };
}

export function fetchProcessRuntimeStartOptions() {
  return Promise.resolve(toEmptyPayload("startOptions"));
}

export function startProcessRuntimeInstance() {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function listProcessRuntimeTasks() {
  return Promise.resolve(toEmptyPayload("tasks"));
}

export function listProcessRuntimeInstances() {
  return Promise.resolve(toEmptyPayload("instances"));
}

export function completeProcessRuntimeTask() {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function readProcessRuntimeInstance() {
  return Promise.resolve({ instance: null });
}

export function readProcessRuntimeTimeline() {
  return Promise.resolve(toEmptyPayload("timeline"));
}

export function stopProcessRuntimeInstance() {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function archiveProcessRuntimeInstance() {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}
`;
}

module.exports = {
  buildFrontendGeneratedProcessRuntimeApiJs,
};

