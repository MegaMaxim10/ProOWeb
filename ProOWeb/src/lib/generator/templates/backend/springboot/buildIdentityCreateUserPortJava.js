function buildIdentityCreateUserPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.CreateUserCommand;
import com.prooweb.generated.identity.domain.model.UserAccount;

public interface CreateUserPort {
  UserAccount createUser(CreateUserCommand command);
}
`;
}

module.exports = {
  buildIdentityCreateUserPortJava,
};
