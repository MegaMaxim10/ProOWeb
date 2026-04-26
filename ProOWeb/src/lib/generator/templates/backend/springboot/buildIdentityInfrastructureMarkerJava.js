function buildIdentityInfrastructureMarkerJava() {
  return `package com.prooweb.generated.identity.infrastructure;

public final class IdentityInfrastructureMarker {
  private IdentityInfrastructureMarker() {
  }
}
`;
}

module.exports = {
  buildIdentityInfrastructureMarkerJava,
};
