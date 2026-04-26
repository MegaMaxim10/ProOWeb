function buildIdentityReadUserCredentialsUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.UserCredentials;
import java.util.Optional;

public interface ReadIdentityUserCredentialsUseCase {
  Optional<UserCredentials> readByUsername(String username);
}
`;
}

module.exports = {
  buildIdentityReadUserCredentialsUseCaseJava,
};
