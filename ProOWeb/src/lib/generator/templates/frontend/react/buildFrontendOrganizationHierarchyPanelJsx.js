function buildFrontendOrganizationHierarchyPanelJsx() {
  return `import { useState } from "react";
import { useOrganizationHierarchy } from "./useOrganizationHierarchy";

export function OrganizationHierarchyPanel() {
  const {
    credentials,
    units,
    loading,
    working,
    connected,
    error,
    success,
    assignmentPreview,
    updateCredential,
    connect,
    createUnit,
    assignSupervisor,
    assignMember,
    resolveAssignment,
  } = useOrganizationHierarchy();

  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newParentCode, setNewParentCode] = useState("");

  const [supervisorUnitCode, setSupervisorUnitCode] = useState("");
  const [supervisorUsername, setSupervisorUsername] = useState("");

  const [memberUnitCode, setMemberUnitCode] = useState("");
  const [memberUsername, setMemberUsername] = useState("");

  const [resolveUnitCode, setResolveUnitCode] = useState("");
  const [resolveStrategy, setResolveStrategy] = useState("SUPERVISOR_THEN_ANCESTORS");

  async function onCreateUnit(event) {
    event.preventDefault();
    await createUnit({
      code: newUnitCode,
      name: newUnitName,
      parentCode: newParentCode,
    });
    setNewUnitCode("");
    setNewUnitName("");
    setNewParentCode("");
  }

  async function onAssignSupervisor(event) {
    event.preventDefault();
    await assignSupervisor({
      unitCode: supervisorUnitCode,
      username: supervisorUsername,
    });
    setSupervisorUsername("");
  }

  async function onAssignMember(event) {
    event.preventDefault();
    await assignMember({
      unitCode: memberUnitCode,
      username: memberUsername,
    });
    setMemberUsername("");
  }

  async function onResolveAssignment(event) {
    event.preventDefault();
    await resolveAssignment({
      unitCode: resolveUnitCode,
      strategy: resolveStrategy,
    });
  }

  return (
    <section className="card">
      <p className="eyebrow">Organization hierarchy capability</p>
      <h2>Organization Hierarchy Administration</h2>
      <p className="muted">
        Manage units, supervisors, and hierarchy-aware assignment previews for process task strategies.
      </p>

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Organization API credentials</h3>
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
            {loading ? "Connecting..." : "Connect hierarchy API"}
          </button>
        </div>

        <div className="identity-box">
          <h3>Create Unit</h3>
          <form className="identity-form" onSubmit={onCreateUnit}>
            <input
              type="text"
              value={newUnitCode}
              onChange={(event) => setNewUnitCode(event.target.value)}
              placeholder="FINANCE"
              required
            />
            <input
              type="text"
              value={newUnitName}
              onChange={(event) => setNewUnitName(event.target.value)}
              placeholder="Finance Department"
              required
            />
            <input
              type="text"
              value={newParentCode}
              onChange={(event) => setNewParentCode(event.target.value)}
              placeholder="ROOT_UNIT (optional)"
            />
            <button type="submit" disabled={!connected || loading || working}>
              Create unit
            </button>
          </form>
        </div>

        <div className="identity-box">
          <h3>Assign Supervisor</h3>
          <form className="identity-form" onSubmit={onAssignSupervisor}>
            <input
              type="text"
              value={supervisorUnitCode}
              onChange={(event) => setSupervisorUnitCode(event.target.value)}
              placeholder="Unit code"
              required
            />
            <input
              type="text"
              value={supervisorUsername}
              onChange={(event) => setSupervisorUsername(event.target.value)}
              placeholder="username"
              required
            />
            <button type="submit" disabled={!connected || loading || working}>
              Assign supervisor
            </button>
          </form>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Assign Member</h3>
          <form className="identity-form" onSubmit={onAssignMember}>
            <input
              type="text"
              value={memberUnitCode}
              onChange={(event) => setMemberUnitCode(event.target.value)}
              placeholder="Unit code"
              required
            />
            <input
              type="text"
              value={memberUsername}
              onChange={(event) => setMemberUsername(event.target.value)}
              placeholder="username"
              required
            />
            <button type="submit" disabled={!connected || loading || working}>
              Assign member
            </button>
          </form>
        </div>

        <div className="identity-box">
          <h3>Resolve Assignment</h3>
          <form className="identity-form" onSubmit={onResolveAssignment}>
            <input
              type="text"
              value={resolveUnitCode}
              onChange={(event) => setResolveUnitCode(event.target.value)}
              placeholder="Unit code"
              required
            />
            <select value={resolveStrategy} onChange={(event) => setResolveStrategy(event.target.value)}>
              <option value="SUPERVISOR_THEN_ANCESTORS">SUPERVISOR_THEN_ANCESTORS</option>
              <option value="SUPERVISOR_ONLY">SUPERVISOR_ONLY</option>
              <option value="UNIT_MEMBERS">UNIT_MEMBERS</option>
            </select>
            <button type="submit" disabled={!connected || loading || working}>
              Preview assignees
            </button>
          </form>
          {assignmentPreview ? (
            <p className="muted">
              Assignees: <strong>{(assignmentPreview.assignees || []).join(", ") || "(none)"}</strong>
            </p>
          ) : null}
        </div>

        <div className="identity-box">
          <h3>Units ({units.length})</h3>
          <ul className="identity-list">
            {units.map((unit) => (
              <li key={unit.code}>
                <strong>{unit.code}</strong>
                <span>{unit.name}</span>
                <small>Parent: {unit.parentCode || "(root)"}</small>
                <small>Supervisor: {unit.supervisorUsername || "(unassigned)"}</small>
                <small>Members: {(unit.memberUsernames || []).join(", ") || "-"}</small>
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
  buildFrontendOrganizationHierarchyPanelJsx,
};
