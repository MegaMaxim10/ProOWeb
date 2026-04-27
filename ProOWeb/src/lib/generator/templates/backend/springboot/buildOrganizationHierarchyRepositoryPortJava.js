function buildOrganizationHierarchyRepositoryPortJava() {
  return `package com.prooweb.generated.organization.domain.port.out;

import com.prooweb.generated.organization.domain.model.OrganizationUnit;
import java.util.List;
import java.util.Optional;

public interface OrganizationHierarchyRepositoryPort {
  List<OrganizationUnit> loadUnits();

  Optional<OrganizationUnit> findUnitByCode(String code);

  OrganizationUnit saveUnit(OrganizationUnit unit);
}
`;
}

module.exports = {
  buildOrganizationHierarchyRepositoryPortJava,
};

