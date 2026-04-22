function buildCommonModuleConfigJava() {
  return `package com.prooweb.generated.common.infrastructure.config;

import com.prooweb.generated.common.application.notification.port.in.NotifyByEmailUseCase;
import com.prooweb.generated.common.application.notification.service.NotifyByEmailService;
import com.prooweb.generated.common.domain.notification.port.out.SendEmailNotificationPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CommonModuleConfig {
  @Bean
  NotifyByEmailUseCase notifyByEmailUseCase(SendEmailNotificationPort sendEmailNotificationPort) {
    return new NotifyByEmailService(sendEmailNotificationPort);
  }
}
`;
}

module.exports = {
  buildCommonModuleConfigJava,
};
