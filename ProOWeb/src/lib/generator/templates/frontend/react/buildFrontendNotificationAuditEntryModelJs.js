function buildFrontendNotificationAuditEntryModelJs() {
  return `export function createNotificationAuditEntry(payload = {}) {
  return {
    id: String(payload.id || "").trim(),
    channel: String(payload.channel || "").trim(),
    templateCode: String(payload.templateCode || "").trim(),
    recipient: String(payload.recipient || "").trim(),
    status: String(payload.status || "").trim(),
    createdAt: String(payload.createdAt || "").trim(),
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  };
}
`;
}

module.exports = {
  buildFrontendNotificationAuditEntryModelJs,
};

