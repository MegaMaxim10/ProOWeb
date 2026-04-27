function buildCommonNotificationAuditEntryJava() {
  return `package com.prooweb.generated.common.domain.notification.model;

import java.time.Instant;
import java.util.Map;

public record NotificationAuditEntry(
  String id,
  String channel,
  String templateCode,
  String recipient,
  String status,
  Instant createdAt,
  Map<String, String> metadata
) {
}
`;
}

module.exports = {
  buildCommonNotificationAuditEntryJava,
};

