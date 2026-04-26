function buildIdentityReadRolesServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.ReadIdentityRolesUseCase;
import com.prooweb.generated.identity.domain.model.Role;
import com.prooweb.generated.identity.domain.port.out.LoadRolesPort;
import java.util.List;

public class ReadIdentityRolesService implements ReadIdentityRolesUseCase {
  private final LoadRolesPort loadRolesPort;

  public ReadIdentityRolesService(LoadRolesPort loadRolesPort) {
    this.loadRolesPort = loadRolesPort;
  }

  @Override
  public List<Role> readRoles() {
    return loadRolesPort.loadRoles();
  }
}
`;
}

module.exports = {
  buildIdentityReadRolesServiceJava,
};
