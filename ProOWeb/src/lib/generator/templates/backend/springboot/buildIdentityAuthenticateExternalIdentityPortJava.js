function buildIdentityAuthenticateExternalIdentityPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.ExternalAuthenticationResult;

public interface AuthenticateExternalIdentityPort {
  ExternalAuthenticationResult authenticateWithIdToken(String providerId, String idToken);
}
`;
}

module.exports = {
  buildIdentityAuthenticateExternalIdentityPortJava,
};

