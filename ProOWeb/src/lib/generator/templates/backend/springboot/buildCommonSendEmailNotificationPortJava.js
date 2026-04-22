function buildCommonSendEmailNotificationPortJava() {
  return `package com.prooweb.generated.common.domain.notification.port.out;

import com.prooweb.generated.common.domain.notification.model.EmailNotification;

public interface SendEmailNotificationPort {
  void send(EmailNotification notification);
}
`;
}

module.exports = {
  buildCommonSendEmailNotificationPortJava,
};
