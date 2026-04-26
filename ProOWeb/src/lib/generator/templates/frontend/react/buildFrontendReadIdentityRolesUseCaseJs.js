function buildFrontendReadIdentityRolesUseCaseJs() {
  return `import { ensureLoadIdentityRolesPort } from "../../domain/port/out/LoadIdentityRolesPort";

export function createReadIdentityRolesUseCase({ loadIdentityRolesPort }) {
  const port = ensureLoadIdentityRolesPort(loadIdentityRolesPort);

  return async function readIdentityRoles(input = {}) {
    return port(input);
  };
}
`;
}

module.exports = {
  buildFrontendReadIdentityRolesUseCaseJs,
};
