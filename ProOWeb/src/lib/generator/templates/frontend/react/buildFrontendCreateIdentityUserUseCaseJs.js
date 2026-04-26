function buildFrontendCreateIdentityUserUseCaseJs() {
  return `import { ensureCreateIdentityUserPort } from "../../domain/port/out/CreateIdentityUserPort";

export function createCreateIdentityUserUseCase({ createIdentityUserPort }) {
  const port = ensureCreateIdentityUserPort(createIdentityUserPort);

  return async function createIdentityUser(input = {}) {
    return port(input);
  };
}
`;
}

module.exports = {
  buildFrontendCreateIdentityUserUseCaseJs,
};
