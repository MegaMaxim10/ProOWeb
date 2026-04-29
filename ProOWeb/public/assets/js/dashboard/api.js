import { requestJson } from "../shared/http-client.js";

export function fetchWorkspaceStatus() {
  return requestJson("/api/status");
}

export function runWorkspaceMigration() {
  return requestJson("/api/migrate", {
    method: "POST",
    body: { reason: "dashboard-action" },
  });
}

export function runWorkspaceReconfiguration(payload) {
  return requestJson("/api/reconfigure", {
    method: "POST",
    body: payload,
  });
}

export function fetchTemplateOverrides() {
  return requestJson("/api/template-overrides");
}

export function saveTemplateOverride(payload) {
  return requestJson("/api/template-overrides", {
    method: "POST",
    body: payload,
  });
}

export function deleteTemplateOverride(overrideId, payload = {}) {
  return requestJson("/api/template-overrides/" + encodeURIComponent(overrideId), {
    method: "DELETE",
    body: payload,
  });
}
