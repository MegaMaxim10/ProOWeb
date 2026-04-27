function buildFrontendReadNotificationAuditTrailUseCaseJs() {
  return `export function createReadNotificationAuditTrailUseCase({ loadNotificationAuditTrailPort }) {
  if (typeof loadNotificationAuditTrailPort !== "function") {
    throw new Error("loadNotificationAuditTrailPort must be a function.");
  }

  return async function readNotificationAuditTrail({ auth, signal } = {}) {
    return loadNotificationAuditTrailPort({ auth, signal });
  };
}
`;
}

module.exports = {
  buildFrontendReadNotificationAuditTrailUseCaseJs,
};

