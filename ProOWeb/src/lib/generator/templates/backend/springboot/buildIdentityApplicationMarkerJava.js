function buildIdentityApplicationMarkerJava() {
  return `package com.prooweb.generated.identity.application;

public final class IdentityApplicationMarker {
  private IdentityApplicationMarker() {
  }
}
`;
}

module.exports = {
  buildIdentityApplicationMarkerJava,
};
