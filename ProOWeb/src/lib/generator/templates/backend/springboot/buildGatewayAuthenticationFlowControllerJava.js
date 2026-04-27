function buildGatewayAuthenticationFlowControllerJava(options = {}) {
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
  const loginMethodArgs = options.sessionSecurityEnabled
    ? "@RequestBody LoginPayload payload, HttpServletRequest request"
    : "@RequestBody LoginPayload payload";
  const loginBody = options.sessionSecurityEnabled
    ? `AuthenticationFlowResult result = runAuthenticationFlowUseCase.login(payload.username(), payload.password(), payload.mfaCode());
    Map<String, Object> responsePayload = toPayload(result);
    if (isAuthenticated(result)) {
      UserSessionObservation sessionObservation = observeUserSessionUseCase.observeAuthenticatedSession(
        payload.username(),
        result.accessToken(),
        request.getHeader("X-Device-Fingerprint"),
        request.getRemoteAddr(),
        request.getHeader("User-Agent")
      );
      appendSessionObservation(responsePayload, sessionObservation);
    }
    return responsePayload;`
    : "return toPayload(runAuthenticationFlowUseCase.login(payload.username(), payload.password(), payload.mfaCode()));";
  const sessionHelpers = options.sessionSecurityEnabled
    ? `
  private static boolean isAuthenticated(AuthenticationFlowResult result) {
    return result != null
      && "AUTHENTICATED".equalsIgnoreCase(result.status())
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

import com.prooweb.generated.identity.application.port.in.RunAuthenticationFlowUseCase;
import com.prooweb.generated.identity.domain.model.AuthenticationFlowResult;
${sessionImports}
import io.swagger.v3.oas.annotations.Operation;
import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthenticationFlowController {
  private final RunAuthenticationFlowUseCase runAuthenticationFlowUseCase;
${sessionField}

  public AuthenticationFlowController(
    RunAuthenticationFlowUseCase runAuthenticationFlowUseCase${sessionConstructorArg}
  ) {
    this.runAuthenticationFlowUseCase = runAuthenticationFlowUseCase;
${sessionConstructorAssign}
  }

  @Operation(summary = "Create an account in inactive state")
  @PostMapping("/auth/register")
  public Map<String, Object> register(@RequestBody RegisterPayload payload) {
    return toPayload(runAuthenticationFlowUseCase.registerAccount(
      payload.displayName(),
      payload.email(),
      payload.username(),
      payload.password()
    ));
  }

  @Operation(summary = "Activate account using activation token")
  @PostMapping("/auth/activate")
  public Map<String, Object> activate(@RequestBody ActivatePayload payload) {
    return toPayload(runAuthenticationFlowUseCase.activateAccount(payload.activationToken()));
  }

  @Operation(summary = "Login with password and optional MFA code")
  @PostMapping("/auth/login")
  public Map<String, Object> login(${loginMethodArgs}) {
    ${loginBody}
  }

  @Operation(summary = "Request password reset token")
  @PostMapping("/auth/password-reset/request")
  public Map<String, Object> requestPasswordReset(@RequestBody PasswordResetRequestPayload payload) {
    return toPayload(runAuthenticationFlowUseCase.requestPasswordReset(payload.principal()));
  }

  @Operation(summary = "Confirm password reset")
  @PostMapping("/auth/password-reset/confirm")
  public Map<String, Object> confirmPasswordReset(@RequestBody PasswordResetConfirmPayload payload) {
    return toPayload(runAuthenticationFlowUseCase.confirmPasswordReset(payload.resetToken(), payload.newPassword()));
  }

  @Operation(summary = "Configure OTP MFA for current user")
  @PostMapping("/account/mfa/otp/setup")
  public Map<String, Object> setupOtpMfa(Principal principal) {
    return toPayload(runAuthenticationFlowUseCase.configureOtpMfa(principal.getName()));
  }

  @Operation(summary = "Configure TOTP MFA for current user")
  @PostMapping("/account/mfa/totp/setup")
  public Map<String, Object> setupTotpMfa(Principal principal) {
    return toPayload(runAuthenticationFlowUseCase.configureTotpMfa(principal.getName()));
  }

  private Map<String, Object> toPayload(AuthenticationFlowResult result) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("status", result.status());
    payload.put("message", result.message());
    payload.put("accessToken", result.accessToken() == null ? "" : result.accessToken());
    payload.put("mfaMode", result.mfaMode() == null ? "" : result.mfaMode());
    payload.put("activationToken", result.activationToken() == null ? "" : result.activationToken());
    payload.put("passwordResetToken", result.passwordResetToken() == null ? "" : result.passwordResetToken());
    payload.put("otpCode", result.otpCode() == null ? "" : result.otpCode());
    payload.put("totpSecret", result.totpSecret() == null ? "" : result.totpSecret());
    return payload;
  }
${sessionHelpers}

  public record RegisterPayload(
    String displayName,
    String email,
    String username,
    String password
  ) {
  }

  public record ActivatePayload(String activationToken) {
  }

  public record LoginPayload(
    String username,
    String password,
    String mfaCode
  ) {
  }

  public record PasswordResetRequestPayload(String principal) {
  }

  public record PasswordResetConfirmPayload(
    String resetToken,
    String newPassword
  ) {
  }
}
`;
}

module.exports = {
  buildGatewayAuthenticationFlowControllerJava,
};
