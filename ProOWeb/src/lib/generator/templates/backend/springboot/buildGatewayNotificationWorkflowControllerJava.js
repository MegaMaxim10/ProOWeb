function buildGatewayNotificationWorkflowControllerJava() {
  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.common.application.notification.port.in.DispatchNotificationUseCase;
import com.prooweb.generated.common.application.notification.port.in.ReadNotificationAuditTrailUseCase;
import com.prooweb.generated.common.application.notification.port.in.ReadNotificationTemplatesUseCase;
import com.prooweb.generated.common.domain.notification.model.NotificationAuditEntry;
import com.prooweb.generated.common.domain.notification.model.NotificationTemplate;
import io.swagger.v3.oas.annotations.Operation;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/notifications")
public class NotificationWorkflowController {
  private final ReadNotificationTemplatesUseCase readNotificationTemplatesUseCase;
  private final DispatchNotificationUseCase dispatchNotificationUseCase;
  private final ReadNotificationAuditTrailUseCase readNotificationAuditTrailUseCase;

  public NotificationWorkflowController(
    ReadNotificationTemplatesUseCase readNotificationTemplatesUseCase,
    DispatchNotificationUseCase dispatchNotificationUseCase,
    ReadNotificationAuditTrailUseCase readNotificationAuditTrailUseCase
  ) {
    this.readNotificationTemplatesUseCase = readNotificationTemplatesUseCase;
    this.dispatchNotificationUseCase = dispatchNotificationUseCase;
    this.readNotificationAuditTrailUseCase = readNotificationAuditTrailUseCase;
  }

  @Operation(summary = "List generated notification templates")
  @GetMapping("/templates")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> listTemplates() {
    List<Map<String, Object>> templates = readNotificationTemplatesUseCase.readTemplates().stream()
      .map(this::toTemplatePayload)
      .toList();
    return Map.of("templates", templates);
  }

  @Operation(summary = "Dispatch notification from generated template")
  @PostMapping("/dispatch")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> dispatch(@RequestBody DispatchNotificationPayload payload) {
    NotificationAuditEntry auditEntry = dispatchNotificationUseCase.dispatch(
      payload.templateCode(),
      payload.recipient(),
      payload.variables()
    );
    return Map.of("auditEntry", toAuditPayload(auditEntry));
  }

  @Operation(summary = "Read notification audit entries")
  @GetMapping("/audit")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> readAuditTrail() {
    List<Map<String, Object>> entries = readNotificationAuditTrailUseCase.readAuditTrail().stream()
      .map(this::toAuditPayload)
      .toList();
    return Map.of("entries", entries);
  }

  private Map<String, Object> toTemplatePayload(NotificationTemplate template) {
    return Map.of(
      "code", template.code(),
      "subjectTemplate", template.subjectTemplate(),
      "bodyTemplate", template.bodyTemplate(),
      "channel", template.channel()
    );
  }

  private Map<String, Object> toAuditPayload(NotificationAuditEntry entry) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("id", entry.id());
    payload.put("channel", entry.channel());
    payload.put("templateCode", entry.templateCode());
    payload.put("recipient", entry.recipient());
    payload.put("status", entry.status());
    payload.put("createdAt", entry.createdAt());
    payload.put("metadata", entry.metadata() == null ? Collections.emptyMap() : entry.metadata());
    return payload;
  }

  public record DispatchNotificationPayload(
    String templateCode,
    String recipient,
    Map<String, String> variables
  ) {
  }
}
`;
}

module.exports = {
  buildGatewayNotificationWorkflowControllerJava,
};

