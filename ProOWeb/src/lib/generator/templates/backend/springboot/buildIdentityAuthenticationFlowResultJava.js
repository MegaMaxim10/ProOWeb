function buildIdentityAuthenticationFlowResultJava() {
  return `package com.prooweb.generated.identity.domain.model;

public record AuthenticationFlowResult(
  String status,
  String message,
  String accessToken,
  String mfaMode,
  String activationToken,
  String passwordResetToken,
  String otpCode,
  String totpSecret
) {
  public static AuthenticationFlowResult success(String status, String message, String accessToken) {
    return new AuthenticationFlowResult(status, message, accessToken, null, null, null, null, null);
  }

  public static AuthenticationFlowResult info(
    String status,
    String message,
    String mfaMode,
    String activationToken,
    String passwordResetToken,
    String otpCode,
    String totpSecret
  ) {
    return new AuthenticationFlowResult(
      status,
      message,
      null,
      mfaMode,
      activationToken,
      passwordResetToken,
      otpCode,
      totpSecret
    );
  }
}
`;
}

module.exports = {
  buildIdentityAuthenticationFlowResultJava,
};
