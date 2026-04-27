function buildFrontendUseNotificationWorkflowsHookJs() {
  return `import { useMemo, useState } from "react";
import { createNotificationTemplate as toNotificationTemplate } from "../domain/model/NotificationTemplate";
import { createNotificationAuditEntry as toNotificationAuditEntry } from "../domain/model/NotificationAuditEntry";
import { createReadNotificationTemplatesUseCase } from "../application/usecase/ReadNotificationTemplates";
import { createDispatchNotificationUseCase } from "../application/usecase/DispatchNotification";
import { createReadNotificationAuditTrailUseCase } from "../application/usecase/ReadNotificationAuditTrail";
import { createHttpNotificationWorkflowAdapter } from "../infrastructure/adapter/out/http/HttpNotificationWorkflowAdapter";

const adapter = createHttpNotificationWorkflowAdapter();

const readNotificationTemplates = createReadNotificationTemplatesUseCase({
  loadNotificationTemplatesPort: ({ auth, signal } = {}) => adapter.loadTemplates({ auth, signal }),
});

const dispatchNotificationAction = createDispatchNotificationUseCase({
  dispatchNotificationPort: ({ auth, templateCode, recipient, variables, signal } = {}) =>
    adapter.dispatch({ auth, templateCode, recipient, variables, signal }),
});

const readNotificationAuditTrail = createReadNotificationAuditTrailUseCase({
  loadNotificationAuditTrailPort: ({ auth, signal } = {}) => adapter.loadAudit({ auth, signal }),
});

export function useNotificationWorkflows() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [templates, setTemplates] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const auth = useMemo(
    () => ({
      username: credentials.username.trim(),
      password: credentials.password,
    }),
    [credentials],
  );

  async function refresh({ signal } = {}) {
    const [nextTemplates, nextAuditEntries] = await Promise.all([
      readNotificationTemplates({ auth, signal }),
      readNotificationAuditTrail({ auth, signal }),
    ]);

    setTemplates(nextTemplates.map((entry) => toNotificationTemplate(entry)));
    setAuditEntries(nextAuditEntries.map((entry) => toNotificationAuditEntry(entry)));
  }

  async function connect() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await refresh();
      setConnected(true);
      setSuccess("Notification workflow API connected.");
    } catch (cause) {
      setConnected(false);
      setError(cause?.message || "Unable to connect to notification workflow API.");
    } finally {
      setLoading(false);
    }
  }

  async function dispatch(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await dispatchNotificationAction({
        auth,
        templateCode: payload.templateCode,
        recipient: payload.recipient,
        variables: payload.variables,
      });
      await refresh();
      setSuccess("Notification dispatched.");
    } catch (cause) {
      setError(cause?.message || "Unable to dispatch notification.");
    } finally {
      setWorking(false);
    }
  }

  function updateCredential(field, value) {
    setCredentials((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  return {
    credentials,
    templates,
    auditEntries,
    loading,
    working,
    connected,
    error,
    success,
    updateCredential,
    connect,
    dispatch,
  };
}
`;
}

module.exports = {
  buildFrontendUseNotificationWorkflowsHookJs,
};

