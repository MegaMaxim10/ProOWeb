function buildFrontendLoadNotificationAuditTrailPortJs() {
  return `export function loadNotificationAuditTrailPort() {
  throw new Error("loadNotificationAuditTrailPort is not implemented.");
}
`;
}

module.exports = {
  buildFrontendLoadNotificationAuditTrailPortJs,
};

