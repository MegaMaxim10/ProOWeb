function buildOrganizationApplicationMarkerJava() {
  return `package com.prooweb.generated.organization.application;

public final class OrganizationApplicationMarker {
  private OrganizationApplicationMarker() {
  }
}
`;
}

module.exports = {
  buildOrganizationApplicationMarkerJava,
};

