function buildCommonNotificationTemplateJava() {
  return `package com.prooweb.generated.common.domain.notification.model;

public record NotificationTemplate(
  String code,
  String subjectTemplate,
  String bodyTemplate,
  String channel
) {
}
`;
}

module.exports = {
  buildCommonNotificationTemplateJava,
};

