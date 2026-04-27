function buildReadOrganizationHierarchyUseCaseJava() {
  return `package com.prooweb.generated.organization.application.port.in;

import com.prooweb.generated.organization.domain.model.OrganizationUnit;
import java.util.List;

public interface ReadOrganizationHierarchyUseCase {
  List<OrganizationUnit> readUnits();
}
`;
}

module.exports = {
  buildReadOrganizationHierarchyUseCaseJava,
};

