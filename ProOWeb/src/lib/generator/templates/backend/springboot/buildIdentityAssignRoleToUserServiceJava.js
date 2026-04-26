function buildIdentityAssignRoleToUserServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.AssignRoleToIdentityUserUseCase;
import com.prooweb.generated.identity.domain.model.UserAccount;
import com.prooweb.generated.identity.domain.port.out.AssignRoleToUserPort;

public class AssignRoleToIdentityUserService implements AssignRoleToIdentityUserUseCase {
  private final AssignRoleToUserPort assignRoleToUserPort;

  public AssignRoleToIdentityUserService(AssignRoleToUserPort assignRoleToUserPort) {
    this.assignRoleToUserPort = assignRoleToUserPort;
  }

  @Override
  public UserAccount assignRoleToUser(String username, String roleCode) {
    return assignRoleToUserPort.assignRoleToUser(username, roleCode);
  }
}
`;
}

module.exports = {
  buildIdentityAssignRoleToUserServiceJava,
};
