function buildIdentityCreateRoleServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.CreateIdentityRoleUseCase;
import com.prooweb.generated.identity.domain.model.CreateRoleCommand;
import com.prooweb.generated.identity.domain.model.Role;
import com.prooweb.generated.identity.domain.port.out.CreateRolePort;

public class CreateIdentityRoleService implements CreateIdentityRoleUseCase {
  private final CreateRolePort createRolePort;

  public CreateIdentityRoleService(CreateRolePort createRolePort) {
    this.createRolePort = createRolePort;
  }

  @Override
  public Role createRole(CreateRoleCommand command) {
    return createRolePort.createRole(command);
  }
}
`;
}

module.exports = {
  buildIdentityCreateRoleServiceJava,
};
