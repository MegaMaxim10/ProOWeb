function buildFrontendCreateOrganizationUnitUseCaseJs() {
  return `export function createCreateOrganizationUnitUseCase({ createOrganizationUnitPort }) {
  if (typeof createOrganizationUnitPort !== "function") {
    throw new Error("createOrganizationUnitPort must be a function.");
  }

  return async function createOrganizationUnit({ auth, unit, signal } = {}) {
    return createOrganizationUnitPort({ auth, unit, signal });
  };
}
`;
}

module.exports = {
  buildFrontendCreateOrganizationUnitUseCaseJs,
};

