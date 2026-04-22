function buildCommonMailSenderEmailNotificationAdapterJava() {
  return `package com.prooweb.generated.common.infrastructure.notification;

import com.prooweb.generated.common.domain.notification.model.EmailNotification;
import com.prooweb.generated.common.domain.notification.port.out.SendEmailNotificationPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class MailSenderEmailNotificationAdapter implements SendEmailNotificationPort {
  private static final Logger LOGGER = LoggerFactory.getLogger(MailSenderEmailNotificationAdapter.class);
  private final JavaMailSender javaMailSender;
  private final String senderAddress;

  public MailSenderEmailNotificationAdapter(
    JavaMailSender javaMailSender,
    @Value("\${app.notifications.email.from:no-reply@prooweb.local}") String senderAddress
  ) {
    this.javaMailSender = javaMailSender;
    this.senderAddress = senderAddress;
  }

  @Override
  public void send(EmailNotification notification) {
    if (notification == null || notification.to() == null || notification.to().isBlank()) {
      LOGGER.warn("Email notification ignored because recipient is missing.");
      return;
    }

    try {
      SimpleMailMessage message = new SimpleMailMessage();
      message.setFrom(senderAddress);
      message.setTo(notification.to());
      message.setSubject(notification.subject() == null ? "" : notification.subject());
      message.setText(notification.body() == null ? "" : notification.body());
      javaMailSender.send(message);
    } catch (Exception exception) {
      LOGGER.error("Failed to send email notification.", exception);
    }
  }
}
`;
}

module.exports = {
  buildCommonMailSenderEmailNotificationAdapterJava,
};
