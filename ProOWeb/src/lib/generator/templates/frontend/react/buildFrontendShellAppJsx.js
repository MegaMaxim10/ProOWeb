function buildFrontendShellAppJsx(options = {}) {
  const identityImport = options.identityEnabled
    ? `import { IdentityAdminPanel } from "../../identity/ui/IdentityAdminPanel";\n`
    : "";
  const authImport = options.authEnabled
    ? `import { AuthenticationWorkbench } from "../../auth/ui/AuthenticationWorkbench";\n`
    : "";
  const sessionSecurityImport = options.sessionSecurityEnabled
    ? `import { SessionSecurityPanel } from "../../session-security/ui/SessionSecurityPanel";\n`
    : "";
  const organizationImport = options.organizationEnabled
    ? `import { OrganizationHierarchyPanel } from "../../organization/ui/OrganizationHierarchyPanel";\n`
    : "";
  const notificationsImport = options.notificationsEnabled
    ? `import { NotificationWorkflowPanel } from "../../notifications/ui/NotificationWorkflowPanel";\n`
    : "";
  const processRuntimeImport = options.processRuntimeEnabled
    ? `import { ProcessRuntimeWorkbench } from "../../processes/ui/ProcessRuntimeWorkbench";\n`
    : "";
  const identitySection = options.identityEnabled ? "\n      <IdentityAdminPanel />" : "";
  const authSection = options.authEnabled ? "\n      <AuthenticationWorkbench />" : "";
  const sessionSecuritySection = options.sessionSecurityEnabled ? "\n      <SessionSecurityPanel />" : "";
  const organizationSection = options.organizationEnabled ? "\n      <OrganizationHierarchyPanel />" : "";
  const notificationsSection = options.notificationsEnabled ? "\n      <NotificationWorkflowPanel />" : "";
  const processRuntimeSection = options.processRuntimeEnabled ? "\n      <ProcessRuntimeWorkbench />" : "";

  return `import { useSystemSnapshot } from "./useSystemSnapshot";
${identityImport}
${authImport}
${sessionSecurityImport}
${organizationImport}
${notificationsImport}
${processRuntimeImport}
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
      </section>${identitySection}${authSection}${sessionSecuritySection}${organizationSection}${notificationsSection}${processRuntimeSection}
    </main>
  );
}
`;
}

module.exports = {
  buildFrontendShellAppJsx,
};
