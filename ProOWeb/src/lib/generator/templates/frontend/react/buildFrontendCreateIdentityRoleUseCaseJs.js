function buildFrontendCreateIdentityRoleUseCaseJs() {
  return `import { ensureCreateIdentityRolePort } from "../../domain/port/out/CreateIdentityRolePort";

export function createCreateIdentityRoleUseCase({ createIdentityRolePort }) {
  const port = ensureCreateIdentityRolePort(createIdentityRolePort);

  return async function createIdentityRole(input = {}) {
    return port(input);
  };
}
`;
}

module.exports = {
  buildFrontendCreateIdentityRoleUseCaseJs,
};
