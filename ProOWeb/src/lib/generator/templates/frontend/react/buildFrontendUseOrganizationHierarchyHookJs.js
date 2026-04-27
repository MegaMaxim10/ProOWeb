function buildFrontendUseOrganizationHierarchyHookJs() {
  return `import { useMemo, useState } from "react";
import { createOrganizationUnit as toOrganizationUnit } from "../domain/model/OrganizationUnit";
import { createReadOrganizationUnitsUseCase } from "../application/usecase/ReadOrganizationUnits";
import { createCreateOrganizationUnitUseCase } from "../application/usecase/CreateOrganizationUnit";
import { createAssignOrganizationSupervisorUseCase } from "../application/usecase/AssignOrganizationSupervisor";
import { createAssignOrganizationMemberUseCase } from "../application/usecase/AssignOrganizationMember";
import { createResolveOrganizationAssignmentUseCase } from "../application/usecase/ResolveOrganizationAssignment";
import { createHttpOrganizationHierarchyAdapter } from "../infrastructure/adapter/out/http/HttpOrganizationHierarchyAdapter";

const adapter = createHttpOrganizationHierarchyAdapter();

const readOrganizationUnits = createReadOrganizationUnitsUseCase({
  loadOrganizationUnitsPort: ({ auth, signal } = {}) => adapter.loadUnits({ auth, signal }),
});

const createOrganizationUnitAction = createCreateOrganizationUnitUseCase({
  createOrganizationUnitPort: ({ auth, unit, signal } = {}) => adapter.createUnit({ auth, unit, signal }),
});

const assignOrganizationSupervisor = createAssignOrganizationSupervisorUseCase({
  assignOrganizationSupervisorPort: ({ auth, unitCode, username, signal } = {}) =>
    adapter.assignSupervisor({ auth, unitCode, username, signal }),
});

const assignOrganizationMember = createAssignOrganizationMemberUseCase({
  assignOrganizationMemberPort: ({ auth, unitCode, username, signal } = {}) =>
    adapter.assignMember({ auth, unitCode, username, signal }),
});

const resolveOrganizationAssignment = createResolveOrganizationAssignmentUseCase({
  resolveOrganizationAssignmentPort: ({ auth, unitCode, strategy, signal } = {}) =>
    adapter.resolveAssignment({ auth, unitCode, strategy, signal }),
});

export function useOrganizationHierarchy() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [assignmentPreview, setAssignmentPreview] = useState(null);

  const auth = useMemo(
    () => ({
      username: credentials.username.trim(),
      password: credentials.password,
    }),
    [credentials],
  );

  async function refreshHierarchy({ signal } = {}) {
    const nextUnits = await readOrganizationUnits({ auth, signal });
    setUnits(nextUnits.map((entry) => toOrganizationUnit(entry)));
  }

  async function connect() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await refreshHierarchy();
      setConnected(true);
      setSuccess("Organization hierarchy API connected.");
    } catch (cause) {
      setConnected(false);
      setError(cause?.message || "Unable to connect to organization hierarchy API.");
    } finally {
      setLoading(false);
    }
  }

  async function createUnit(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await createOrganizationUnitAction({
        auth,
        unit: payload,
      });
      await refreshHierarchy();
      setSuccess("Organization unit created.");
    } catch (cause) {
      setError(cause?.message || "Unable to create organization unit.");
    } finally {
      setWorking(false);
    }
  }

  async function assignSupervisor(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await assignOrganizationSupervisor({
        auth,
        unitCode: payload.unitCode,
        username: payload.username,
      });
      await refreshHierarchy();
      setSuccess("Supervisor assignment saved.");
    } catch (cause) {
      setError(cause?.message || "Unable to assign supervisor.");
    } finally {
      setWorking(false);
    }
  }

  async function assignMember(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await assignOrganizationMember({
        auth,
        unitCode: payload.unitCode,
        username: payload.username,
      });
      await refreshHierarchy();
      setSuccess("Unit member assignment saved.");
    } catch (cause) {
      setError(cause?.message || "Unable to assign member.");
    } finally {
      setWorking(false);
    }
  }

  async function resolveAssignment(payload) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const preview = await resolveOrganizationAssignment({
        auth,
        unitCode: payload.unitCode,
        strategy: payload.strategy,
      });
      setAssignmentPreview(preview);
      setSuccess("Assignment strategy resolved.");
    } catch (cause) {
      setError(cause?.message || "Unable to resolve assignment strategy.");
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
  };
}
`;
}

module.exports = {
  buildFrontendUseOrganizationHierarchyHookJs,
};

