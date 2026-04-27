function buildFrontendResolveOrganizationAssignmentUseCaseJs() {
  return `export function createResolveOrganizationAssignmentUseCase({ resolveOrganizationAssignmentPort }) {
  if (typeof resolveOrganizationAssignmentPort !== "function") {
    throw new Error("resolveOrganizationAssignmentPort must be a function.");
  }

  return async function resolveOrganizationAssignment({ auth, unitCode, strategy, signal } = {}) {
    return resolveOrganizationAssignmentPort({ auth, unitCode, strategy, signal });
  };
}
`;
}

module.exports = {
  buildFrontendResolveOrganizationAssignmentUseCaseJs,
};

