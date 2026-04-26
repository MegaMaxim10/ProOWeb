function buildIdentityCreateUserUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.CreateUserCommand;
import com.prooweb.generated.identity.domain.model.UserAccount;

public interface CreateIdentityUserUseCase {
  UserAccount createUser(CreateUserCommand command);
}
`;
}

module.exports = {
  buildIdentityCreateUserUseCaseJava,
};
