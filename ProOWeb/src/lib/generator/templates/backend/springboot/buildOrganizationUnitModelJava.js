function buildOrganizationUnitModelJava() {
  return `package com.prooweb.generated.organization.domain.model;

import java.util.List;

public record OrganizationUnit(
  String code,
  String name,
  String parentCode,
  String supervisorUsername,
  List<String> memberUsernames
) {
  public OrganizationUnit {
    memberUsernames = memberUsernames == null ? List.of() : List.copyOf(memberUsernames);
  }
}
`;
}

module.exports = {
  buildOrganizationUnitModelJava,
};

