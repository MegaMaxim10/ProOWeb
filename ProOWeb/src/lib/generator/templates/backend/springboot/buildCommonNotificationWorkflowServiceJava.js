function buildCommonNotificationWorkflowServiceJava() {
  return `package com.prooweb.generated.common.application.notification.service;

import com.prooweb.generated.common.application.notification.port.in.DispatchNotificationUseCase;
import com.prooweb.generated.common.application.notification.port.in.NotifyByEmailUseCase;
import com.prooweb.generated.common.application.notification.port.in.ReadNotificationAuditTrailUseCase;
import com.prooweb.generated.common.application.notification.port.in.ReadNotificationTemplatesUseCase;
import com.prooweb.generated.common.domain.notification.model.EmailNotification;
import com.prooweb.generated.common.domain.notification.model.NotificationAuditEntry;
import com.prooweb.generated.common.domain.notification.model.NotificationTemplate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

public class NotificationWorkflowService
  implements DispatchNotificationUseCase, ReadNotificationTemplatesUseCase, ReadNotificationAuditTrailUseCase {
  private final NotifyByEmailUseCase notifyByEmailUseCase;
  private final boolean notificationsEnabled;
  private final boolean auditEnabled;
  private final List<NotificationTemplate> templates;
  private final List<NotificationAuditEntry> auditTrail;
  private final AtomicLong sequence;

  public NotificationWorkflowService(
    NotifyByEmailUseCase notifyByEmailUseCase,
    boolean notificationsEnabled,
    boolean auditEnabled
  ) {
    this.notifyByEmailUseCase = Objects.requireNonNull(notifyByEmailUseCase, "notifyByEmailUseCase is required");
    this.notificationsEnabled = notificationsEnabled;
    this.auditEnabled = auditEnabled;
    this.templates = List.of(
      new NotificationTemplate(
        "ACCOUNT_ACTIVATION",
        "Activate your account",
        "Hello {{displayName}},\\n\\nUse this token to activate your account: {{activationToken}}",
        "EMAIL"
      ),
      new NotificationTemplate(
        "PASSWORD_RESET",
        "Reset your password",
        "Hello {{displayName}},\\n\\nUse this token to reset your password: {{resetToken}}",
        "EMAIL"
      )
    );
    this.auditTrail = new CopyOnWriteArrayList<>();
    this.sequence = new AtomicLong(0L);
  }

  @Override
  public List<NotificationTemplate> readTemplates() {
    return templates;
  }

  @Override
  public NotificationAuditEntry dispatch(String templateCode, String recipient, Map<String, String> variables) {
    String safeTemplateCode = normalize(templateCode);
    String safeRecipient = normalize(recipient);
    NotificationTemplate template = templates.stream()
      .filter(candidate -> candidate.code().equalsIgnoreCase(safeTemplateCode))
      .findFirst()
      .orElseThrow(() -> new IllegalArgumentException("Unknown notification template: " + safeTemplateCode));

    Map<String, String> safeVariables = new LinkedHashMap<>();
    if (variables != null) {
      variables.forEach((key, value) -> {
        String safeKey = normalize(key);
        if (!safeKey.isBlank()) {
          safeVariables.put(safeKey, normalize(value));
        }
      });
    }

    String status = "DISABLED";
    if (notificationsEnabled) {
      String subject = render(template.subjectTemplate(), safeVariables);
      String body = render(template.bodyTemplate(), safeVariables);
      notifyByEmailUseCase.notify(new EmailNotification(safeRecipient, subject, body));
      status = "SENT";
    }

    NotificationAuditEntry entry = new NotificationAuditEntry(
      "NOTIF-" + sequence.incrementAndGet(),
      template.channel(),
      template.code(),
      safeRecipient,
      status,
      Instant.now(),
      safeVariables
    );

    if (auditEnabled) {
      auditTrail.add(0, entry);
    }

    return entry;
  }

  @Override
  public List<NotificationAuditEntry> readAuditTrail() {
    return Collections.unmodifiableList(new ArrayList<>(auditTrail));
  }

  private static String render(String template, Map<String, String> variables) {
    String rendered = template == null ? "" : template;
    for (Map.Entry<String, String> entry : variables.entrySet()) {
      rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
    }
    return rendered;
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim();
  }
}
`;
}

module.exports = {
  buildCommonNotificationWorkflowServiceJava,
};

