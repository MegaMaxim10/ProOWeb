function buildFrontendReadNotificationTemplatesUseCaseJs() {
  return `export function createReadNotificationTemplatesUseCase({ loadNotificationTemplatesPort }) {
  if (typeof loadNotificationTemplatesPort !== "function") {
    throw new Error("loadNotificationTemplatesPort must be a function.");
  }

  return async function readNotificationTemplates({ auth, signal } = {}) {
    return loadNotificationTemplatesPort({ auth, signal });
  };
}
`;
}

module.exports = {
  buildFrontendReadNotificationTemplatesUseCaseJs,
};

