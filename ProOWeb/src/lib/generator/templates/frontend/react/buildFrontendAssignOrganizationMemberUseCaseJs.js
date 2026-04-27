function buildFrontendAssignOrganizationMemberUseCaseJs() {
  return `export function createAssignOrganizationMemberUseCase({ assignOrganizationMemberPort }) {
  if (typeof assignOrganizationMemberPort !== "function") {
    throw new Error("assignOrganizationMemberPort must be a function.");
  }

  return async function assignOrganizationMember({ auth, unitCode, username, signal } = {}) {
    return assignOrganizationMemberPort({ auth, unitCode, username, signal });
  };
}
`;
}

module.exports = {
  buildFrontendAssignOrganizationMemberUseCaseJs,
};

