function buildFrontendNotificationTemplateModelJs() {
  return `export function createNotificationTemplate(payload = {}) {
  return {
    code: String(payload.code || "").trim(),
    subjectTemplate: String(payload.subjectTemplate || "").trim(),
    bodyTemplate: String(payload.bodyTemplate || "").trim(),
    channel: String(payload.channel || "EMAIL").trim(),
  };
}
`;
}

module.exports = {
  buildFrontendNotificationTemplateModelJs,
};

