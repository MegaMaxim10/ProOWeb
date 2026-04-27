function buildFrontendAssignOrganizationSupervisorUseCaseJs() {
  return `export function createAssignOrganizationSupervisorUseCase({ assignOrganizationSupervisorPort }) {
  if (typeof assignOrganizationSupervisorPort !== "function") {
    throw new Error("assignOrganizationSupervisorPort must be a function.");
  }

  return async function assignOrganizationSupervisor({ auth, unitCode, username, signal } = {}) {
    return assignOrganizationSupervisorPort({ auth, unitCode, username, signal });
  };
}
`;
}

module.exports = {
  buildFrontendAssignOrganizationSupervisorUseCaseJs,
};

