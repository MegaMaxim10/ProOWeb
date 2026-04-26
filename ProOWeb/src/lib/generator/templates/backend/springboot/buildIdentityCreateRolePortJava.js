function buildIdentityCreateRolePortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.CreateRoleCommand;
import com.prooweb.generated.identity.domain.model.Role;

public interface CreateRolePort {
  Role createRole(CreateRoleCommand command);
}
`;
}

module.exports = {
  buildIdentityCreateRolePortJava,
};
