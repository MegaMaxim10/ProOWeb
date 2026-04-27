function buildIdentityExternalAuthenticationServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.AuthenticateExternalIdentityUseCase;
import com.prooweb.generated.identity.domain.model.ExternalAuthenticationResult;
import com.prooweb.generated.identity.domain.port.out.AuthenticateExternalIdentityPort;

public class ExternalAuthenticationService implements AuthenticateExternalIdentityUseCase {
  private final AuthenticateExternalIdentityPort authenticateExternalIdentityPort;

  public ExternalAuthenticationService(AuthenticateExternalIdentityPort authenticateExternalIdentityPort) {
    this.authenticateExternalIdentityPort = authenticateExternalIdentityPort;
  }

  @Override
  public ExternalAuthenticationResult authenticateWithIdToken(String providerId, String idToken) {
    return authenticateExternalIdentityPort.authenticateWithIdToken(providerId, idToken);
  }
}
`;
}

module.exports = {
  buildIdentityExternalAuthenticationServiceJava,
};

