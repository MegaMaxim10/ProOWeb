function buildIdentityReadUsersUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.UserAccount;
import java.util.List;

public interface ReadIdentityUsersUseCase {
  List<UserAccount> readUsers();
}
`;
}

module.exports = {
  buildIdentityReadUsersUseCaseJava,
};
