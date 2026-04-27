function buildOrganizationDomainMarkerJava() {
  return `package com.prooweb.generated.organization.domain;

public final class OrganizationDomainMarker {
  private OrganizationDomainMarker() {
  }
}
`;
}

module.exports = {
  buildOrganizationDomainMarkerJava,
};

