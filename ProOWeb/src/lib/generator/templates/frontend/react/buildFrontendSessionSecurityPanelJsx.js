function buildFrontendSessionSecurityPanelJsx() {
  return `import { useState } from "react";
import { useSessionSecurity } from "./useSessionSecurity";

export function SessionSecurityPanel() {
  const {
    loading,
    error,
    sessionsPayload,
    revokeResult,
    basicAuth,
    setBasicAuth,
    refreshSessions,
    revokeSession,
  } = useSessionSecurity();
  const [sessionIdToRevoke, setSessionIdToRevoke] = useState("");

  async function onReadSessions(event) {
    event.preventDefault();
    await refreshSessions();
  }

  async function onRevoke(event) {
    event.preventDefault();
    await revokeSession(sessionIdToRevoke);
  }

  const activeSessions = Array.isArray(sessionsPayload?.activeSessions)
    ? sessionsPayload.activeSessions
    : [];

  return (
    <section className="card">
      <p className="eyebrow">Session & Device Security</p>
      <h2>Session Monitoring</h2>
      <p className="muted">
        Observe active sessions, detect suspicious multi-device patterns, and revoke sessions manually.
      </p>

      <div className="auth-grid">
        <form className="auth-box auth-form" onSubmit={onReadSessions}>
          <h3>Read Active Sessions</h3>
          <input
            value={basicAuth.username}
            onChange={(event) => setBasicAuth((previous) => ({ ...previous, username: event.target.value }))}
            placeholder="Basic auth username"
            required
          />
          <input
            type="password"
            value={basicAuth.password}
            onChange={(event) => setBasicAuth((previous) => ({ ...previous, password: event.target.value }))}
            placeholder="Basic auth password"
            required
          />
          <button type="submit" disabled={loading}>Load sessions</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onRevoke}>
          <h3>Revoke Session</h3>
          <input
            value={sessionIdToRevoke}
            onChange={(event) => setSessionIdToRevoke(event.target.value)}
            placeholder="Session ID"
            required
          />
          <button type="submit" disabled={loading}>Revoke session</button>
        </form>
      </div>

      {sessionsPayload ? (
        <div className="auth-result">
          <p>
            Suspicious account activity: <strong>{sessionsPayload.suspicious ? "yes" : "no"}</strong>
          </p>
          <p>Active sessions: {activeSessions.length}</p>
          <pre>{JSON.stringify(activeSessions, null, 2)}</pre>
        </div>
      ) : null}

      {revokeResult ? (
        <p className={revokeResult.status === "REVOKED" ? "ok" : "warn"}>
          Revoke result: {revokeResult.status}
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
`;
}

module.exports = {
  buildFrontendSessionSecurityPanelJsx,
};

