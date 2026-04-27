function buildCommonReadNotificationAuditTrailUseCaseJava() {
  return `package com.prooweb.generated.common.application.notification.port.in;

import com.prooweb.generated.common.domain.notification.model.NotificationAuditEntry;
import java.util.List;

public interface ReadNotificationAuditTrailUseCase {
  List<NotificationAuditEntry> readAuditTrail();
}
`;
}

module.exports = {
  buildCommonReadNotificationAuditTrailUseCaseJava,
};

