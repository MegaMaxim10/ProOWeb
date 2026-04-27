function buildOrganizationInfrastructureMarkerJava() {
  return `package com.prooweb.generated.organization.infrastructure;

public final class OrganizationInfrastructureMarker {
  private OrganizationInfrastructureMarker() {
  }
}
`;
}

module.exports = {
  buildOrganizationInfrastructureMarkerJava,
};

