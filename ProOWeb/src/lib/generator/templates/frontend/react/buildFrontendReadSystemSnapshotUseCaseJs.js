function buildFrontendReadSystemSnapshotUseCaseJs() {
  return `export function createReadSystemSnapshotUseCase({ loadSystemSnapshotPort }) {
  if (typeof loadSystemSnapshotPort !== "function") {
    throw new Error("loadSystemSnapshotPort must be a function");
  }

  return async function readSystemSnapshot({ signal } = {}) {
    return loadSystemSnapshotPort({ signal });
  };
}
`;
}

module.exports = {
  buildFrontendReadSystemSnapshotUseCaseJs,
};
