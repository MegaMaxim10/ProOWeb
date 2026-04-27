function buildFrontendDispatchNotificationPortJs() {
  return `export function dispatchNotificationPort() {
  throw new Error("dispatchNotificationPort is not implemented.");
}
`;
}

module.exports = {
  buildFrontendDispatchNotificationPortJs,
};

