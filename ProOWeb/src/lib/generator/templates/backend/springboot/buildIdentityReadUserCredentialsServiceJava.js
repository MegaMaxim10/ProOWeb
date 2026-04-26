function buildIdentityReadUserCredentialsServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.ReadIdentityUserCredentialsUseCase;
import com.prooweb.generated.identity.domain.model.UserCredentials;
import com.prooweb.generated.identity.domain.port.out.LoadUserCredentialsPort;
import java.util.Optional;

public class ReadIdentityUserCredentialsService implements ReadIdentityUserCredentialsUseCase {
  private final LoadUserCredentialsPort loadUserCredentialsPort;

  public ReadIdentityUserCredentialsService(LoadUserCredentialsPort loadUserCredentialsPort) {
    this.loadUserCredentialsPort = loadUserCredentialsPort;
  }

  @Override
  public Optional<UserCredentials> readByUsername(String username) {
    return loadUserCredentialsPort.loadByUsername(username);
  }
}
`;
}

module.exports = {
  buildIdentityReadUserCredentialsServiceJava,
};
