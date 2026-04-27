function buildFrontendNotificationWorkflowPanelJsx() {
  return `import { useMemo, useState } from "react";
import { useNotificationWorkflows } from "./useNotificationWorkflows";

function parseTemplateVariables(rawValue) {
  const result = {};
  String(rawValue || "")
    .split("\\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        return;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    });
  return result;
}

export function NotificationWorkflowPanel() {
  const {
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
  } = useNotificationWorkflows();

  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");
  const [recipient, setRecipient] = useState("");
  const [variablesRaw, setVariablesRaw] = useState("displayName=John Doe\\nactivationToken=TOKEN-123");

  const selectedTemplate = useMemo(
    () => templates.find((entry) => entry.code === selectedTemplateCode) || null,
    [templates, selectedTemplateCode],
  );

  async function onDispatch(event) {
    event.preventDefault();

    await dispatch({
      templateCode: selectedTemplateCode,
      recipient,
      variables: parseTemplateVariables(variablesRaw),
    });
  }

  return (
    <section className="card">
      <p className="eyebrow">Notification workflows</p>
      <h2>Notification Operations</h2>
      <p className="muted">
        Trigger generated notification templates and inspect the audit timeline.
      </p>

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Notification API credentials</h3>
          <label>
            Username
            <input
              type="text"
              value={credentials.username}
              onChange={(event) => updateCredential("username", event.target.value)}
              placeholder="superadmin"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => updateCredential("password", event.target.value)}
              placeholder="Your admin password"
            />
          </label>
          <button type="button" onClick={connect} disabled={loading || working}>
            {loading ? "Connecting..." : "Connect notification API"}
          </button>
        </div>

        <div className="identity-box">
          <h3>Dispatch Template</h3>
          <form className="identity-form" onSubmit={onDispatch}>
            <select
              value={selectedTemplateCode}
              onChange={(event) => setSelectedTemplateCode(event.target.value)}
              required
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.code} value={template.code}>
                  {template.code}
                </option>
              ))}
            </select>
            <input
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="recipient@example.com"
              required
            />
            <textarea
              value={variablesRaw}
              onChange={(event) => setVariablesRaw(event.target.value)}
              rows={5}
              placeholder={"displayName=John Doe\\nactivationToken=TOKEN-123"}
            />
            <button type="submit" disabled={!connected || loading || working}>
              Dispatch notification
            </button>
          </form>
          {selectedTemplate ? (
            <small>
              Subject template: <strong>{selectedTemplate.subjectTemplate}</strong>
            </small>
          ) : null}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Templates ({templates.length})</h3>
          <ul className="identity-list">
            {templates.map((template) => (
              <li key={template.code}>
                <strong>{template.code}</strong>
                <span>Channel: {template.channel}</span>
                <small>{template.bodyTemplate}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="identity-box">
          <h3>Audit ({auditEntries.length})</h3>
          <ul className="identity-list">
            {auditEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.templateCode}</strong>
                <span>{entry.recipient}</span>
                <small>Status: {entry.status}</small>
                <small>{entry.createdAt || "-"}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
`;
}

module.exports = {
  buildFrontendNotificationWorkflowPanelJsx,
};

