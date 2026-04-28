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

export function listProcessRuntimeMonitorEvents(_query = {}) {
  return Promise.resolve(toEmptyPayload("events"));
}

export function readProcessRuntimeUserPreferences(_query = {}) {
  return Promise.resolve({
    preferences: {
      userId: "process.user",
      profileDisplayName: "Process User",
      profilePhotoUrl: "",
      preferredLanguage: "en",
      preferredTheme: "SYSTEM",
      notificationChannel: "IN_APP_EMAIL",
      notificationsEnabled: true,
      automaticTaskPolicy: "MANUAL_TRIGGER",
      automaticTaskDelaySeconds: 0,
      automaticTaskNotifyOnly: true,
    },
  });
}

export function updateProcessRuntimeUserPreferences(payload = {}) {
  return Promise.resolve({
    preferences: {
      userId: String(payload.actor || "process.user"),
      profileDisplayName: String(payload.profileDisplayName || payload.actor || "Process User"),
      profilePhotoUrl: String(payload.profilePhotoUrl || ""),
      preferredLanguage: String(payload.preferredLanguage || "en"),
      preferredTheme: String(payload.preferredTheme || "SYSTEM"),
      notificationChannel: String(payload.notificationChannel || "IN_APP_EMAIL"),
      notificationsEnabled: payload.notificationsEnabled !== false,
      automaticTaskPolicy: String(payload.automaticTaskPolicy || "MANUAL_TRIGGER"),
      automaticTaskDelaySeconds: Number(payload.automaticTaskDelaySeconds || 0),
      automaticTaskNotifyOnly: payload.automaticTaskNotifyOnly !== false,
    },
  });
}

export function setupOtpMfaWithBasicAuth(_credentials = {}) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function setupTotpMfaWithBasicAuth(_credentials = {}) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function requestPasswordReset(_payload = {}) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
}

export function confirmPasswordReset(_payload = {}) {
  return Promise.reject(new Error(RUNTIME_NOT_DEPLOYED_MESSAGE));
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
