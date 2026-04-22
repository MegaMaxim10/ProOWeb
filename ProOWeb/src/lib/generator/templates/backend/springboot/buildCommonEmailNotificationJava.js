function buildCommonEmailNotificationJava() {
  return `package com.prooweb.generated.common.domain.notification.model;

public record EmailNotification(
  String to,
  String subject,
  String body
) {
}
`;
}

module.exports = {
  buildCommonEmailNotificationJava,
};
