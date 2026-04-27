function buildGatewaySessionSecurityControllerJava() {
  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.identity.application.port.in.ObserveUserSessionUseCase;
import com.prooweb.generated.identity.domain.model.UserSessionObservation;
import io.swagger.v3.oas.annotations.Operation;
import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account/sessions")
public class SessionSecurityController {
  private final ObserveUserSessionUseCase observeUserSessionUseCase;

  public SessionSecurityController(ObserveUserSessionUseCase observeUserSessionUseCase) {
    this.observeUserSessionUseCase = observeUserSessionUseCase;
  }

  @Operation(summary = "Read active sessions for current account")
  @GetMapping
  public Map<String, Object> readActiveSessions(Principal principal) {
    List<UserSessionObservation> sessions = observeUserSessionUseCase.readActiveSessions(principal.getName());
    boolean suspicious = sessions.stream().anyMatch(UserSessionObservation::suspicious);

    return Map.of(
      "status", "OK",
      "suspicious", suspicious,
      "activeSessions", sessions.stream().map(this::toPayload).toList()
    );
  }

  @Operation(summary = "Revoke one active session for current account")
  @PostMapping("/revoke")
  public Map<String, Object> revokeSession(Principal principal, @RequestBody RevokeSessionPayload payload) {
    boolean revoked = observeUserSessionUseCase.revokeSession(principal.getName(), payload.sessionId());
    return Map.of(
      "status", revoked ? "REVOKED" : "NOT_FOUND",
      "sessionId", payload.sessionId() == null ? "" : payload.sessionId()
    );
  }

  private Map<String, Object> toPayload(UserSessionObservation observation) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("sessionId", observation.sessionId());
    payload.put("username", observation.username());
    payload.put("deviceFingerprint", observation.deviceFingerprint());
    payload.put("ipAddress", observation.ipAddress());
    payload.put("userAgent", observation.userAgent());
    payload.put("authenticatedAt", observation.authenticatedAt() == null ? "" : observation.authenticatedAt().toString());
    payload.put("active", observation.active());
    payload.put("suspicious", observation.suspicious());
    payload.put("suspiciousReason", observation.suspiciousReason() == null ? "" : observation.suspiciousReason());
    return payload;
  }

  public record RevokeSessionPayload(String sessionId) {
  }
}
`;
}

module.exports = {
  buildGatewaySessionSecurityControllerJava,
};

