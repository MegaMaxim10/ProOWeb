function buildFrontendIdentityAdminPanelJsx() {
  return `import { useState } from "react";
import { useIdentityAdmin } from "./useIdentityAdmin";

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function IdentityAdminPanel() {
  const {
    credentials,
    users,
    roles,
    loading,
    working,
    connected,
    error,
    success,
    updateCredential,
    connect,
    createRole,
    createUser,
    assignRoleToUser,
  } = useIdentityAdmin();

  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState("");

  const [selectedRoleByUser, setSelectedRoleByUser] = useState({});

  async function onCreateRole(event) {
    event.preventDefault();
    await createRole({
      code: newRoleCode,
      description: newRoleDescription,
      active: true,
      permissionCodes: parseCsv(newRolePermissions),
    });
    setNewRoleCode("");
    setNewRoleDescription("");
    setNewRolePermissions("");
  }

  async function onCreateUser(event) {
    event.preventDefault();
    await createUser({
      displayName: newUserName,
      email: newUserEmail,
      username: newUserUsername,
      password: newUserPassword,
      active: true,
      roleCodes: parseCsv(newUserRoles),
    });
    setNewUserName("");
    setNewUserEmail("");
    setNewUserUsername("");
    setNewUserPassword("");
    setNewUserRoles("");
  }

  async function onAssignRole(username) {
    const roleCode = selectedRoleByUser[username] || "";
    if (!roleCode) {
      return;
    }

    await assignRoleToUser({ username, roleCode });
  }

  return (
    <section className="card">
      <p className="eyebrow">Identity RBAC foundation</p>
      <h2>Identity Administration</h2>
      <p className="muted">
        This generated panel calls the backend admin APIs and demonstrates the default RBAC baseline.
      </p>

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Admin API credentials</h3>
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
              placeholder="Your bootstrap password"
            />
          </label>
          <button type="button" onClick={connect} disabled={loading || working}>
            {loading ? "Connecting..." : "Connect identity API"}
          </button>
        </div>

        <div className="identity-box">
          <h3>Create Role</h3>
          <form onSubmit={onCreateRole} className="identity-form">
            <input
              type="text"
              value={newRoleCode}
              onChange={(event) => setNewRoleCode(event.target.value)}
              placeholder="ROLE_FINANCE_MANAGER"
              required
            />
            <input
              type="text"
              value={newRoleDescription}
              onChange={(event) => setNewRoleDescription(event.target.value)}
              placeholder="Finance manager role"
              required
            />
            <input
              type="text"
              value={newRolePermissions}
              onChange={(event) => setNewRolePermissions(event.target.value)}
              placeholder="PERMISSION_A, PERMISSION_B"
            />
            <button type="submit" disabled={!connected || loading || working}>
              Create role
            </button>
          </form>
        </div>

        <div className="identity-box">
          <h3>Create User</h3>
          <form onSubmit={onCreateUser} className="identity-form">
            <input
              type="text"
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              placeholder="Display name"
              required
            />
            <input
              type="email"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder="user@company.local"
              required
            />
            <input
              type="text"
              value={newUserUsername}
              onChange={(event) => setNewUserUsername(event.target.value)}
              placeholder="username"
              required
            />
            <input
              type="password"
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              placeholder="password"
              required
            />
            <input
              type="text"
              value={newUserRoles}
              onChange={(event) => setNewUserRoles(event.target.value)}
              placeholder="ROLE_A, ROLE_B"
            />
            <button type="submit" disabled={!connected || loading || working}>
              Create user
            </button>
          </form>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Roles ({roles.length})</h3>
          <ul className="identity-list">
            {roles.map((role) => (
              <li key={role.code}>
                <strong>{role.code}</strong>
                <span>{role.description}</span>
                <small>{role.permissions.join(", ") || "No permission mapped yet"}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="identity-box">
          <h3>Users ({users.length})</h3>
          <ul className="identity-list">
            {users.map((user) => (
              <li key={user.username}>
                <strong>{user.username}</strong>
                <span>{user.displayName} - {user.email}</span>
                <small>Roles: {user.roles.join(", ") || "-"}</small>
                <div className="assign-row">
                  <select
                    value={selectedRoleByUser[user.username] || ""}
                    onChange={(event) =>
                      setSelectedRoleByUser((previous) => ({
                        ...previous,
                        [user.username]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.code}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!connected || loading || working}
                    onClick={() => onAssignRole(user.username)}
                  >
                    Assign
                  </button>
                </div>
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
  buildFrontendIdentityAdminPanelJsx,
};
