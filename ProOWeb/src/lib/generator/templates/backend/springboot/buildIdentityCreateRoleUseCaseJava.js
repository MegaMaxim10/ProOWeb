function buildIdentityCreateRoleUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.CreateRoleCommand;
import com.prooweb.generated.identity.domain.model.Role;

public interface CreateIdentityRoleUseCase {
  Role createRole(CreateRoleCommand command);
}
`;
}

module.exports = {
  buildIdentityCreateRoleUseCaseJava,
};
