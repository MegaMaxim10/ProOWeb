function buildIdentityLoadRolesPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.Role;
import java.util.List;

public interface LoadRolesPort {
  List<Role> loadRoles();
}
`;
}

module.exports = {
  buildIdentityLoadRolesPortJava,
};
