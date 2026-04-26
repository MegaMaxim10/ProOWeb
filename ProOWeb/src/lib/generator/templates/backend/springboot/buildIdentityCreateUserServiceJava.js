function buildIdentityCreateUserServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.CreateIdentityUserUseCase;
import com.prooweb.generated.identity.domain.model.CreateUserCommand;
import com.prooweb.generated.identity.domain.model.UserAccount;
import com.prooweb.generated.identity.domain.port.out.CreateUserPort;

public class CreateIdentityUserService implements CreateIdentityUserUseCase {
  private final CreateUserPort createUserPort;

  public CreateIdentityUserService(CreateUserPort createUserPort) {
    this.createUserPort = createUserPort;
  }

  @Override
  public UserAccount createUser(CreateUserCommand command) {
    return createUserPort.createUser(command);
  }
}
`;
}

module.exports = {
  buildIdentityCreateUserServiceJava,
};
