function buildFrontendShellAppJsx(options = {}) {
  const identityImport = options.identityEnabled
    ? `import { IdentityAdminPanel } from "../../identity/ui/IdentityAdminPanel";\n`
    : "";
  const authImport = options.authEnabled
    ? `import { AuthenticationWorkbench } from "../../auth/ui/AuthenticationWorkbench";\n`
    : "";
  const identitySection = options.identityEnabled ? "\n      <IdentityAdminPanel />" : "";
  const authSection = options.authEnabled ? "\n      <AuthenticationWorkbench />" : "";

  return `import { useSystemSnapshot } from "./useSystemSnapshot";
${identityImport}
${authImport}
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
            Swagger UI active on profiles: <strong>{(meta.swaggerProfiles || []).join(", ") || "-"}</strong>
          </p>
        ) : (
          <p>Swagger UI disabled.</p>
        )}

        {loading ? <p>Loading backend status...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error ? (
          <p>
            Healthcheck: <span className={healthLabel === "UP" ? "ok" : "warn"}>{healthLabel}</span>
          </p>
        ) : null}
      </section>${identitySection}${authSection}
    </main>
  );
}
`;
}

module.exports = {
  buildFrontendShellAppJsx,
};
