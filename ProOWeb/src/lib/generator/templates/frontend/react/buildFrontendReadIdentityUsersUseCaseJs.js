function buildFrontendReadIdentityUsersUseCaseJs() {
  return `import { ensureLoadIdentityUsersPort } from "../../domain/port/out/LoadIdentityUsersPort";

export function createReadIdentityUsersUseCase({ loadIdentityUsersPort }) {
  const port = ensureLoadIdentityUsersPort(loadIdentityUsersPort);

  return async function readIdentityUsers(input = {}) {
    return port(input);
  };
}
`;
}

module.exports = {
  buildFrontendReadIdentityUsersUseCaseJs,
};
