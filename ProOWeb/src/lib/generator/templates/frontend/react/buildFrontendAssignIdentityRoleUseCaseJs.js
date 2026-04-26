function buildFrontendAssignIdentityRoleUseCaseJs() {
  return `import { ensureAssignIdentityRolePort } from "../../domain/port/out/AssignIdentityRolePort";

export function createAssignIdentityRoleUseCase({ assignIdentityRolePort }) {
  const port = ensureAssignIdentityRolePort(assignIdentityRolePort);

  return async function assignIdentityRole(input = {}) {
    return port(input);
  };
}
`;
}

module.exports = {
  buildFrontendAssignIdentityRoleUseCaseJs,
};
