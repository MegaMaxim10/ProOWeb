function buildCommonModuleConfigJava() {
  return `package com.prooweb.generated.common.infrastructure.config;

import com.prooweb.generated.common.application.notification.port.in.DispatchNotificationUseCase;
import com.prooweb.generated.common.application.notification.port.in.NotifyByEmailUseCase;
import com.prooweb.generated.common.application.notification.port.in.ReadNotificationAuditTrailUseCase;
import com.prooweb.generated.common.application.notification.port.in.ReadNotificationTemplatesUseCase;
import com.prooweb.generated.common.application.notification.service.NotificationWorkflowService;
import com.prooweb.generated.common.application.notification.service.NotifyByEmailService;
import com.prooweb.generated.common.domain.notification.port.out.SendEmailNotificationPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CommonModuleConfig {
  @Bean
  NotifyByEmailUseCase notifyByEmailUseCase(SendEmailNotificationPort sendEmailNotificationPort) {
    return new NotifyByEmailService(sendEmailNotificationPort);
  }

  @Bean
  NotificationWorkflowService notificationWorkflowService(
    NotifyByEmailUseCase notifyByEmailUseCase,
    @Value("\${app.notifications.enabled:true}") boolean notificationsEnabled,
    @Value("\${app.notifications.audit-enabled:true}") boolean auditEnabled
  ) {
    return new NotificationWorkflowService(notifyByEmailUseCase, notificationsEnabled, auditEnabled);
  }

  @Bean
  DispatchNotificationUseCase dispatchNotificationUseCase(NotificationWorkflowService notificationWorkflowService) {
    return notificationWorkflowService;
  }

  @Bean
  ReadNotificationTemplatesUseCase readNotificationTemplatesUseCase(
    NotificationWorkflowService notificationWorkflowService
  ) {
    return notificationWorkflowService;
  }

  @Bean
  ReadNotificationAuditTrailUseCase readNotificationAuditTrailUseCase(
    NotificationWorkflowService notificationWorkflowService
  ) {
    return notificationWorkflowService;
  }
}
`;
}

module.exports = {
  buildCommonModuleConfigJava,
};
