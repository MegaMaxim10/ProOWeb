function buildGatewayExternalAuthenticationControllerJava(options = {}) {
  const sessionImports = options.sessionSecurityEnabled
    ? `
import com.prooweb.generated.identity.application.port.in.ObserveUserSessionUseCase;
import com.prooweb.generated.identity.domain.model.UserSessionObservation;
import jakarta.servlet.http.HttpServletRequest;`
    : "";
  const sessionField = options.sessionSecurityEnabled
    ? `
  private final ObserveUserSessionUseCase observeUserSessionUseCase;`
    : "";
  const sessionConstructorArg = options.sessionSecurityEnabled
    ? `,
    ObserveUserSessionUseCase observeUserSessionUseCase`
    : "";
  const sessionConstructorAssign = options.sessionSecurityEnabled
    ? `
    this.observeUserSessionUseCase = observeUserSessionUseCase;`
    : "";
  const methodArgs = options.sessionSecurityEnabled
    ? "@RequestBody ExternalOidcLoginPayload payload, HttpServletRequest request"
    : "@RequestBody ExternalOidcLoginPayload payload";
  const sessionBody = options.sessionSecurityEnabled
    ? `
    Map<String, Object> responsePayload = toPayload(result);
    if (isAuthenticated(result)) {
      UserSessionObservation sessionObservation = observeUserSessionUseCase.observeAuthenticatedSession(
        result.username(),
        result.accessToken(),
        request.getHeader("X-Device-Fingerprint"),
        request.getRemoteAddr(),
        request.getHeader("User-Agent")
      );
      appendSessionObservation(responsePayload, sessionObservation);
    }

    return responsePayload;`
    : "\n    return toPayload(result);";
  const sessionHelpers = options.sessionSecurityEnabled
    ? `
  private static boolean isAuthenticated(ExternalAuthenticationResult result) {
    return result != null
      && "AUTHENTICATED".equalsIgnoreCase(result.status())
      && result.username() != null
      && !result.username().isBlank()
      && result.accessToken() != null
      && !result.accessToken().isBlank();
  }

  private static void appendSessionObservation(
    Map<String, Object> payload,
    UserSessionObservation sessionObservation
  ) {
    payload.put("sessionId", sessionObservation.sessionId());
    payload.put("suspiciousSession", sessionObservation.suspicious());
    payload.put(
      "suspiciousReason",
      sessionObservation.suspiciousReason() == null ? "" : sessionObservation.suspiciousReason()
    );
  }`
    : "";

  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.identity.application.port.in.AuthenticateExternalIdentityUseCase;
import com.prooweb.generated.identity.domain.model.ExternalAuthenticationResult;
${sessionImports}
import io.swagger.v3.oas.annotations.Operation;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/external")
public class ExternalAuthenticationController {
  private final AuthenticateExternalIdentityUseCase authenticateExternalIdentityUseCase;
${sessionField}

  public ExternalAuthenticationController(
    AuthenticateExternalIdentityUseCase authenticateExternalIdentityUseCase${sessionConstructorArg}
  ) {
    this.authenticateExternalIdentityUseCase = authenticateExternalIdentityUseCase;
${sessionConstructorAssign}
  }

  @Operation(summary = "Authenticate a user with an external OIDC ID token")
  @PostMapping("/oidc/login")
  public Map<String, Object> authenticateWithExternalIam(${methodArgs}) {
    ExternalAuthenticationResult result = authenticateExternalIdentityUseCase.authenticateWithIdToken(
      payload.providerId(),
      payload.idToken()
    );
${sessionBody}
  }

  private static Map<String, Object> toPayload(ExternalAuthenticationResult result) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("status", result.status());
    payload.put("message", result.message());
    payload.put("accessToken", result.accessToken() == null ? "" : result.accessToken());
    payload.put("providerId", result.providerId() == null ? "" : result.providerId());
    payload.put("username", result.username() == null ? "" : result.username());
    payload.put("email", result.email() == null ? "" : result.email());
    return payload;
  }
${sessionHelpers}

  public record ExternalOidcLoginPayload(
    String providerId,
    String idToken
  ) {
  }
}
`;
}

module.exports = {
  buildGatewayExternalAuthenticationControllerJava,
};
