function buildIdentityCreateRoleCommandJava() {
  return `package com.prooweb.generated.identity.domain.model;

import java.util.List;

public record CreateRoleCommand(
  String code,
  String description,
  boolean active,
  List<String> permissionCodes
) {
}
`;
}

module.exports = {
  buildIdentityCreateRoleCommandJava,
};
