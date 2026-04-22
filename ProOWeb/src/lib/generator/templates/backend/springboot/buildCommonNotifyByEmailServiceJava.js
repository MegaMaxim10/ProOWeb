function buildCommonNotifyByEmailServiceJava() {
  return `package com.prooweb.generated.common.application.notification.service;

import com.prooweb.generated.common.application.notification.port.in.NotifyByEmailUseCase;
import com.prooweb.generated.common.domain.notification.model.EmailNotification;
import com.prooweb.generated.common.domain.notification.port.out.SendEmailNotificationPort;

public class NotifyByEmailService implements NotifyByEmailUseCase {
  private final SendEmailNotificationPort sendEmailNotificationPort;

  public NotifyByEmailService(SendEmailNotificationPort sendEmailNotificationPort) {
    this.sendEmailNotificationPort = sendEmailNotificationPort;
  }

  @Override
  public void notify(EmailNotification notification) {
    sendEmailNotificationPort.send(notification);
  }
}
`;
}

module.exports = {
  buildCommonNotifyByEmailServiceJava,
};
