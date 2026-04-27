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
