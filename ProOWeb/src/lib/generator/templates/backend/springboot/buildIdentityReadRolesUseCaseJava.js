function buildIdentityReadRolesUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.Role;
import java.util.List;

public interface ReadIdentityRolesUseCase {
  List<Role> readRoles();
}
`;
}

module.exports = {
  buildIdentityReadRolesUseCaseJava,
};
