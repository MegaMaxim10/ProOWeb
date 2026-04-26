function buildIdentityReadUsersServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.ReadIdentityUsersUseCase;
import com.prooweb.generated.identity.domain.model.UserAccount;
import com.prooweb.generated.identity.domain.port.out.LoadUsersPort;
import java.util.List;

public class ReadIdentityUsersService implements ReadIdentityUsersUseCase {
  private final LoadUsersPort loadUsersPort;

  public ReadIdentityUsersService(LoadUsersPort loadUsersPort) {
    this.loadUsersPort = loadUsersPort;
  }

  @Override
  public List<UserAccount> readUsers() {
    return loadUsersPort.loadUsers();
  }
}
`;
}

module.exports = {
  buildIdentityReadUsersServiceJava,
};
