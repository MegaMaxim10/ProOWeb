function buildIdentityCreateUserCommandJava() {
  return `package com.prooweb.generated.identity.domain.model;

import java.util.List;

public record CreateUserCommand(
  String displayName,
  String email,
  String username,
  String rawPassword,
  boolean active,
  List<String> roleCodes
) {
}
`;
}

module.exports = {
  buildIdentityCreateUserCommandJava,
};
