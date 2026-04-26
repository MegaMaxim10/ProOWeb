function buildGatewayAuthenticationFlowControllerJava() {
  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.identity.application.port.in.RunAuthenticationFlowUseCase;
import com.prooweb.generated.identity.domain.model.AuthenticationFlowResult;
import io.swagger.v3.oas.annotations.Operation;
import java.security.Principal;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthenticationFlowController {
  private final RunAuthenticationFlowUseCase runAuthenticationFlowUseCase;

  public AuthenticationFlowController(RunAuthenticationFlowUseCase runAuthenticationFlowUseCase) {
    this.runAuthenticationFlowUseCase = runAuthenticationFlowUseCase;
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
  public Map<String, Object> login(@RequestBody LoginPayload payload) {
    return toPayload(runAuthenticationFlowUseCase.login(payload.username(), payload.password(), payload.mfaCode()));
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
    return Map.of(
      "status", result.status(),
      "message", result.message(),
      "accessToken", result.accessToken() == null ? "" : result.accessToken(),
      "mfaMode", result.mfaMode() == null ? "" : result.mfaMode(),
      "activationToken", result.activationToken() == null ? "" : result.activationToken(),
      "passwordResetToken", result.passwordResetToken() == null ? "" : result.passwordResetToken(),
      "otpCode", result.otpCode() == null ? "" : result.otpCode(),
      "totpSecret", result.totpSecret() == null ? "" : result.totpSecret()
    );
  }

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
