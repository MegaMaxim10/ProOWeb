function buildFrontendDispatchNotificationUseCaseJs() {
  return `export function createDispatchNotificationUseCase({ dispatchNotificationPort }) {
  if (typeof dispatchNotificationPort !== "function") {
    throw new Error("dispatchNotificationPort must be a function.");
  }

  return async function dispatchNotification({ auth, templateCode, recipient, variables, signal } = {}) {
    return dispatchNotificationPort({
      auth,
      templateCode,
      recipient,
      variables,
      signal,
    });
  };
}
`;
}

module.exports = {
  buildFrontendDispatchNotificationUseCaseJs,
};

