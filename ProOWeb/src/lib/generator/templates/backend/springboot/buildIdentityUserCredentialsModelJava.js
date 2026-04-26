function buildIdentityUserCredentialsModelJava() {
  return `package com.prooweb.generated.identity.domain.model;

import java.util.List;

public record UserCredentials(
  String username,
  String passwordDigest,
  boolean active,
  List<String> authorities
) {
}
`;
}

module.exports = {
  buildIdentityUserCredentialsModelJava,
};
