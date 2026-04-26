function buildIdentityRunAuthenticationFlowPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.AuthenticationFlowResult;

public interface RunAuthenticationFlowPort {
  AuthenticationFlowResult registerAccount(String displayName, String email, String username, String rawPassword);

  AuthenticationFlowResult activateAccount(String activationToken);

  AuthenticationFlowResult login(String username, String rawPassword, String mfaCode);

  AuthenticationFlowResult requestPasswordReset(String principal);

  AuthenticationFlowResult confirmPasswordReset(String resetToken, String newPassword);

  AuthenticationFlowResult configureOtpMfa(String username);

  AuthenticationFlowResult configureTotpMfa(String username);
}
`;
}

module.exports = {
  buildIdentityRunAuthenticationFlowPortJava,
};
