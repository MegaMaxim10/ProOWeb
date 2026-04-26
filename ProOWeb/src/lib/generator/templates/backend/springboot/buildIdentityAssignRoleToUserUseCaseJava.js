function buildIdentityAssignRoleToUserUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.UserAccount;

public interface AssignRoleToIdentityUserUseCase {
  UserAccount assignRoleToUser(String username, String roleCode);
}
`;
}

module.exports = {
  buildIdentityAssignRoleToUserUseCaseJava,
};
