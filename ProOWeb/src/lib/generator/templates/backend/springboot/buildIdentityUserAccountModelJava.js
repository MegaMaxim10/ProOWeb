function buildIdentityUserAccountModelJava() {
  return `package com.prooweb.generated.identity.domain.model;

import java.util.List;

public record UserAccount(
  long id,
  String displayName,
  String email,
  String username,
  boolean active,
  List<String> roles,
  List<String> permissions
) {
}
`;
}

module.exports = {
  buildIdentityUserAccountModelJava,
};
