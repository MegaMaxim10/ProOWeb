function buildFrontendShellAppJsx() {
  return `import { useSystemSnapshot } from "./useSystemSnapshot";

export function ShellApp() {
  const { snapshot, loading, error, healthLabel } = useSystemSnapshot();
  const meta = snapshot?.meta;

  return (
    <main className="app-shell">
      <section className="card">
        <p className="eyebrow">ProOWeb generated project</p>
        <h1>{meta?.siteTitle}</h1>
        <p>
          Backend: <strong>{meta?.backend}</strong> | Database: <strong>{meta?.database}</strong>
        </p>

        {meta?.swaggerEnabled ? (
          <p>
            Swagger UI active sur profils: <strong>{(meta.swaggerProfiles || []).join(", ") || "-"}</strong>
          </p>
        ) : (
          <p>Swagger UI desactive.</p>
        )}

        {loading ? <p>Loading backend status...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error ? (
          <p>
            Healthcheck: <span className={healthLabel === "UP" ? "ok" : "warn"}>{healthLabel}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}
`;
}

module.exports = {
  buildFrontendShellAppJsx,
};
