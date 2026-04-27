function buildResolveHierarchyAssignmentUseCaseJava() {
  return `package com.prooweb.generated.organization.application.port.in;

import java.util.List;

public interface ResolveHierarchyAssignmentUseCase {
  List<String> resolveAssignees(String unitCode, String strategy);
}
`;
}

module.exports = {
  buildResolveHierarchyAssignmentUseCaseJava,
};

