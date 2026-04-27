function buildFrontendReadOrganizationUnitsUseCaseJs() {
  return `export function createReadOrganizationUnitsUseCase({ loadOrganizationUnitsPort }) {
  if (typeof loadOrganizationUnitsPort !== "function") {
    throw new Error("loadOrganizationUnitsPort must be a function.");
  }

  return async function readOrganizationUnits({ auth, signal } = {}) {
    return loadOrganizationUnitsPort({ auth, signal });
  };
}
`;
}

module.exports = {
  buildFrontendReadOrganizationUnitsUseCaseJs,
};

