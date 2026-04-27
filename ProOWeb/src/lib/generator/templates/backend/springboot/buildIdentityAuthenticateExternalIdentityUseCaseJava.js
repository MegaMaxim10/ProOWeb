function buildIdentityAuthenticateExternalIdentityUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.ExternalAuthenticationResult;

public interface AuthenticateExternalIdentityUseCase {
  ExternalAuthenticationResult authenticateWithIdToken(String providerId, String idToken);
}
`;
}

module.exports = {
  buildIdentityAuthenticateExternalIdentityUseCaseJava,
};

