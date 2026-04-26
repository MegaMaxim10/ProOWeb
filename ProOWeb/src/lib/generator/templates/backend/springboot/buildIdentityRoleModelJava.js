function buildIdentityRoleModelJava() {
  return `package com.prooweb.generated.identity.domain.model;

import java.util.List;

public record Role(
  long id,
  String code,
  String description,
  boolean active,
  List<Permission> permissions
) {
}
`;
}

module.exports = {
  buildIdentityRoleModelJava,
};
