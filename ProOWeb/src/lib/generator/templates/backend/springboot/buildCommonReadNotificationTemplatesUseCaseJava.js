function buildCommonReadNotificationTemplatesUseCaseJava() {
  return `package com.prooweb.generated.common.application.notification.port.in;

import com.prooweb.generated.common.domain.notification.model.NotificationTemplate;
import java.util.List;

public interface ReadNotificationTemplatesUseCase {
  List<NotificationTemplate> readTemplates();
}
`;
}

module.exports = {
  buildCommonReadNotificationTemplatesUseCaseJava,
};

