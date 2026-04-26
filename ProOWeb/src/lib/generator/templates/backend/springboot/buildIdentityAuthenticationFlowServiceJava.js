function buildIdentityAuthenticationFlowServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.RunAuthenticationFlowUseCase;
import com.prooweb.generated.identity.domain.model.AuthenticationFlowResult;
import com.prooweb.generated.identity.domain.port.out.RunAuthenticationFlowPort;

public class AuthenticationFlowService implements RunAuthenticationFlowUseCase {
  private final RunAuthenticationFlowPort runAuthenticationFlowPort;

  public AuthenticationFlowService(RunAuthenticationFlowPort runAuthenticationFlowPort) {
    this.runAuthenticationFlowPort = runAuthenticationFlowPort;
  }

  @Override
  public AuthenticationFlowResult registerAccount(String displayName, String email, String username, String rawPassword) {
    return runAuthenticationFlowPort.registerAccount(displayName, email, username, rawPassword);
  }

  @Override
  public AuthenticationFlowResult activateAccount(String activationToken) {
    return runAuthenticationFlowPort.activateAccount(activationToken);
  }

  @Override
  public AuthenticationFlowResult login(String username, String rawPassword, String mfaCode) {
    return runAuthenticationFlowPort.login(username, rawPassword, mfaCode);
  }

  @Override
  public AuthenticationFlowResult requestPasswordReset(String principal) {
    return runAuthenticationFlowPort.requestPasswordReset(principal);
  }

  @Override
  public AuthenticationFlowResult confirmPasswordReset(String resetToken, String newPassword) {
    return runAuthenticationFlowPort.confirmPasswordReset(resetToken, newPassword);
  }

  @Override
  public AuthenticationFlowResult configureOtpMfa(String username) {
    return runAuthenticationFlowPort.configureOtpMfa(username);
  }

  @Override
  public AuthenticationFlowResult configureTotpMfa(String username) {
    return runAuthenticationFlowPort.configureTotpMfa(username);
  }
}
`;
}

module.exports = {
  buildIdentityAuthenticationFlowServiceJava,
};
