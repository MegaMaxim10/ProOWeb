function buildFrontendLoadNotificationTemplatesPortJs() {
  return `export function loadNotificationTemplatesPort() {
  throw new Error("loadNotificationTemplatesPort is not implemented.");
}
`;
}

module.exports = {
  buildFrontendLoadNotificationTemplatesPortJs,
};

