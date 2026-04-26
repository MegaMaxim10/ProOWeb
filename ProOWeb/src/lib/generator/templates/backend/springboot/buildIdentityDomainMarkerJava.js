function buildIdentityDomainMarkerJava() {
  return `package com.prooweb.generated.identity.domain;

public final class IdentityDomainMarker {
  private IdentityDomainMarker() {
  }
}
`;
}

module.exports = {
  buildIdentityDomainMarkerJava,
};
