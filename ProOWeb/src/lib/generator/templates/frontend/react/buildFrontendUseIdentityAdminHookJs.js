function buildFrontendUseIdentityAdminHookJs() {
  return `import { useMemo, useState } from "react";
import { createIdentityRole as toIdentityRole } from "../domain/model/IdentityRole";
import { createIdentityUser as toIdentityUser } from "../domain/model/IdentityUser";
import { createReadIdentityUsersUseCase } from "../application/usecase/ReadIdentityUsers";
import { createCreateIdentityUserUseCase } from "../application/usecase/CreateIdentityUser";
import { createReadIdentityRolesUseCase } from "../application/usecase/ReadIdentityRoles";
import { createCreateIdentityRoleUseCase } from "../application/usecase/CreateIdentityRole";
import { createAssignIdentityRoleUseCase } from "../application/usecase/AssignIdentityRole";
import { createHttpIdentityAdminAdapter } from "../infrastructure/adapter/out/http/HttpIdentityAdminAdapter";

const adapter = createHttpIdentityAdminAdapter();

const readIdentityUsers = createReadIdentityUsersUseCase({
  loadIdentityUsersPort: ({ auth, signal } = {}) => adapter.loadUsers({ auth, signal }),
});

const createIdentityUserAction = createCreateIdentityUserUseCase({
  createIdentityUserPort: ({ auth, user, signal } = {}) => adapter.createUser({ auth, user, signal }),
});

const readIdentityRoles = createReadIdentityRolesUseCase({
  loadIdentityRolesPort: ({ auth, signal } = {}) => adapter.loadRoles({ auth, signal }),
});

const createIdentityRoleAction = createCreateIdentityRoleUseCase({
  createIdentityRolePort: ({ auth, role, signal } = {}) => adapter.createRole({ auth, role, signal }),
});

const assignIdentityRole = createAssignIdentityRoleUseCase({
  assignIdentityRolePort: ({ auth, username, roleCode, signal } = {}) =>
    adapter.assignRole({ auth, username, roleCode, signal }),
});

export function useIdentityAdmin() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
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

  async function refreshIdentitySnapshot({ signal } = {}) {
    const [nextUsers, nextRoles] = await Promise.all([
      readIdentityUsers({ auth, signal }),
      readIdentityRoles({ auth, signal }),
    ]);

    setUsers(nextUsers.map((entry) => toIdentityUser(entry)));
    setRoles(nextRoles.map((entry) => toIdentityRole(entry)));
  }

  async function connect() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await refreshIdentitySnapshot();
      setConnected(true);
      setSuccess("Identity admin API connected.");
    } catch (cause) {
      setConnected(false);
      setError(cause?.message || "Unable to connect to identity admin API.");
    } finally {
      setLoading(false);
    }
  }

  async function createRole(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await createIdentityRoleAction({
        auth,
        role: payload,
      });
      await refreshIdentitySnapshot();
      setSuccess("Role created successfully.");
    } catch (cause) {
      setError(cause?.message || "Unable to create role.");
    } finally {
      setWorking(false);
    }
  }

  async function createUser(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await createIdentityUserAction({
        auth,
        user: payload,
      });
      await refreshIdentitySnapshot();
      setSuccess("User created successfully.");
    } catch (cause) {
      setError(cause?.message || "Unable to create user.");
    } finally {
      setWorking(false);
    }
  }

  async function assignRoleToUser({ username, roleCode }) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await assignIdentityRole({
        auth,
        username,
        roleCode,
      });
      await refreshIdentitySnapshot();
      setSuccess("Role assignment applied.");
    } catch (cause) {
      setError(cause?.message || "Unable to assign role.");
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
  };
}
`;
}

module.exports = {
  buildFrontendUseIdentityAdminHookJs,
};
