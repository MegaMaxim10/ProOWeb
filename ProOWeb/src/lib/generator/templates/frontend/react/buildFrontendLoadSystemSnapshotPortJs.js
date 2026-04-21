function buildFrontendLoadSystemSnapshotPortJs() {
  return `/**
 * Port sortant: charge les donnees systeme depuis l'exterieur.
 * Signature attendue:
 * ({ signal?: AbortSignal }) => Promise<{ meta: object, health: object }>
 */
export const LoadSystemSnapshotPort = Object.freeze({
  kind: "LoadSystemSnapshotPort",
});
`;
}

module.exports = {
  buildFrontendLoadSystemSnapshotPortJs,
};
