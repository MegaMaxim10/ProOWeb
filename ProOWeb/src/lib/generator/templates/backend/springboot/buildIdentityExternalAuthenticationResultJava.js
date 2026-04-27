function buildIdentityExternalAuthenticationResultJava() {
  return `package com.prooweb.generated.identity.domain.model;

public record ExternalAuthenticationResult(
  String status,
  String message,
  String accessToken,
  String providerId,
  String username,
  String email
) {
  public static ExternalAuthenticationResult success(
    String message,
    String accessToken,
    String providerId,
    String username,
    String email
  ) {
    return new ExternalAuthenticationResult("AUTHENTICATED", message, accessToken, providerId, username, email);
  }

  public static ExternalAuthenticationResult info(
    String status,
    String message,
    String providerId,
    String username,
    String email
  ) {
    return new ExternalAuthenticationResult(status, message, null, providerId, username, email);
  }
}
`;
}

module.exports = {
  buildIdentityExternalAuthenticationResultJava,
};
