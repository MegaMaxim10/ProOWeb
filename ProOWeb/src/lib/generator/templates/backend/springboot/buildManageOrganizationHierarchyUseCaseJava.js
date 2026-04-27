function buildManageOrganizationHierarchyUseCaseJava() {
  return `package com.prooweb.generated.organization.application.port.in;

import com.prooweb.generated.organization.domain.model.OrganizationUnit;

public interface ManageOrganizationHierarchyUseCase {
  OrganizationUnit createUnit(String code, String name, String parentCode);

  OrganizationUnit assignSupervisor(String unitCode, String supervisorUsername);

  OrganizationUnit assignMember(String unitCode, String username);
}
`;
}

module.exports = {
  buildManageOrganizationHierarchyUseCaseJava,
};

