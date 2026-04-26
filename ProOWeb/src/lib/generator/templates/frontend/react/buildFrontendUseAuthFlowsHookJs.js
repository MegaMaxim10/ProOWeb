function buildFrontendUseAuthFlowsHookJs() {
  return `import { useMemo, useState } from "react";
import { createHttpAuthFlowsAdapter } from "../infrastructure/adapter/out/http/HttpAuthFlowsAdapter";

const authAdapter = createHttpAuthFlowsAdapter();

export function useAuthFlows() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
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
      const next = await action();
      setResult(next);
      return next;
    } catch (cause) {
      const message = cause?.message || "Authentication action failed.";
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    result,
    basicAuth,
    setBasicAuth,
    registerAccount(payload) {
      return run(() => authAdapter.registerAccount(payload));
    },
    activateAccount(payload) {
      return run(() => authAdapter.activateAccount(payload));
    },
    login(payload) {
      return run(() => authAdapter.login(payload));
    },
    requestPasswordReset(payload) {
      return run(() => authAdapter.requestPasswordReset(payload));
    },
    confirmPasswordReset(payload) {
      return run(() => authAdapter.confirmPasswordReset(payload));
    },
    setupOtpMfa() {
      return run(() => authAdapter.setupOtpMfa({ basicAuth: basicAuthPayload }));
    },
    setupTotpMfa() {
      return run(() => authAdapter.setupTotpMfa({ basicAuth: basicAuthPayload }));
    },
  };
}
`;
}

module.exports = {
  buildFrontendUseAuthFlowsHookJs,
};
