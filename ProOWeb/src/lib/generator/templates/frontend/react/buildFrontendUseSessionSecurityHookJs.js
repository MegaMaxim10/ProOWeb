function buildFrontendUseSessionSecurityHookJs() {
  return `import { useMemo, useState } from "react";
import { createHttpSessionSecurityAdapter } from "../infrastructure/adapter/out/http/HttpSessionSecurityAdapter";

const sessionSecurityAdapter = createHttpSessionSecurityAdapter();

export function useSessionSecurity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionsPayload, setSessionsPayload] = useState(null);
  const [revokeResult, setRevokeResult] = useState(null);
  const [basicAuth, setBasicAuth] = useState({
    username: "",
    password: "",
  });

  const basicAuthPayload = useMemo(
    () => ({
      username: basicAuth.username.trim(),
      password: basicAuth.password,
    }),
    [basicAuth],
  );

  async function run(action) {
    setLoading(true);
    setError(null);
    try {
      return await action();
    } catch (cause) {
      const message = cause?.message || "Session security action failed.";
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }

  async function refreshSessions() {
    const payload = await run(() => sessionSecurityAdapter.readActiveSessions({ basicAuth: basicAuthPayload }));
    setSessionsPayload(payload);
    return payload;
  }

  return {
    loading,
    error,
    sessionsPayload,
    revokeResult,
    basicAuth,
    setBasicAuth,
    refreshSessions,
    async revokeSession(sessionId) {
      const result = await run(
        () => sessionSecurityAdapter.revokeSession({ sessionId }, { basicAuth: basicAuthPayload }),
      );
      setRevokeResult(result);
      await refreshSessions();
      return result;
    },
  };
}
`;
}

module.exports = {
  buildFrontendUseSessionSecurityHookJs,
};
