function buildIdentityPermissionModelJava() {
  return `package com.prooweb.generated.identity.domain.model;

public record Permission(
  String code,
  String description
) {
}
`;
}

module.exports = {
  buildIdentityPermissionModelJava,
};
