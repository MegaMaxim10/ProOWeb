import { requestJson } from "../shared/http-client.js";

export function fetchWorkspaceStatus() {
  return requestJson("/api/status");
}

export function initializeWorkspace(payload) {
  return requestJson("/api/init", {
    method: "POST",
    body: payload,
  });
}
