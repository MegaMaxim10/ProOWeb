function buildIdentityAssignRoleToUserPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.UserAccount;

public interface AssignRoleToUserPort {
  UserAccount assignRoleToUser(String username, String roleCode);
}
`;
}

module.exports = {
  buildIdentityAssignRoleToUserPortJava,
};
