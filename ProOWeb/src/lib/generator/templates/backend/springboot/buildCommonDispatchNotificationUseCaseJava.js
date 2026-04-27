function buildCommonDispatchNotificationUseCaseJava() {
  return `package com.prooweb.generated.common.application.notification.port.in;

import com.prooweb.generated.common.domain.notification.model.NotificationAuditEntry;
import java.util.Map;

public interface DispatchNotificationUseCase {
  NotificationAuditEntry dispatch(String templateCode, String recipient, Map<String, String> variables);
}
`;
}

module.exports = {
  buildCommonDispatchNotificationUseCaseJava,
};

