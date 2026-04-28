function buildFrontendProcessRuntimeWorkbenchTestJsx() {
  return `import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProcessRuntimeWorkbench } from "./ProcessRuntimeWorkbench";

const hookState = {
  actor: "process.user",
  rolesRaw: "PROCESS_USER",
  startPayloadRaw: "{\\"seed\\":\\"runtime\\"}",
  completionPayloadRaw: "{\\"decision\\":\\"APPROVED\\"}",
  stopReason: "Stopped from tests",
  selectedStartKey: "",
  selectedStartOption: null,
  selectedStartActivityByKey: {},
  selectedInstanceId: "",
  selectedInstance: null,
  taskFormValuesByTaskId: {},
  assignTargetByTaskId: {},
  instanceStatusFilter: "ALL",
  instanceViewMode: "PARTICIPATING",
  taskViewMode: "TO_PROCESS",
  monitorInstanceFilter: "",
  monitorActionFilter: "ALL",
  preferencesTargetUserId: "",
  userPreferences: {
    userId: "process.user",
    profileDisplayName: "Process User",
    profilePhotoUrl: "",
    preferredLanguage: "en",
    preferredTheme: "SYSTEM",
    notificationChannel: "IN_APP_EMAIL",
    notificationsEnabled: true,
    automaticTaskPolicy: "MANUAL_TRIGGER",
    automaticTaskDelaySeconds: 0,
    automaticTaskNotifyOnly: true,
  },
  securityUsername: "",
  securityPassword: "",
  passwordResetPrincipal: "",
  passwordResetToken: "",
  passwordResetNewPassword: "",
  startOptions: [],
  startableFromRegistry: [
    { modelKey: "purchase-request", versionNumber: 1, startableByRoles: ["PROCESS_USER"] },
  ],
  manualTaskCatalog: [],
  tasks: [],
  visibleTasks: [],
  instances: [],
  visibleInstances: [],
  timeline: [],
  monitorEvents: [],
  loading: false,
  working: false,
  hasMonitorPrivilege: true,
  error: null,
  success: null,
  setActor: vi.fn(),
  setRolesRaw: vi.fn(),
  setStartPayloadRaw: vi.fn(),
  setCompletionPayloadRaw: vi.fn(),
  setStopReason: vi.fn(),
  setSelectedStartKey: vi.fn(),
  setSelectedStartActivityByKey: vi.fn(),
  setTaskFormValue: vi.fn(),
  setAssignTargetByTaskId: vi.fn(),
  setInstanceStatusFilter: vi.fn(),
  setInstanceViewMode: vi.fn(),
  setTaskViewMode: vi.fn(),
  setMonitorInstanceFilter: vi.fn(),
  setMonitorActionFilter: vi.fn(),
  setPreferencesTargetUserId: vi.fn(),
  setUserPreferences: vi.fn(),
  setSecurityUsername: vi.fn(),
  setSecurityPassword: vi.fn(),
  setPasswordResetPrincipal: vi.fn(),
  setPasswordResetToken: vi.fn(),
  setPasswordResetNewPassword: vi.fn(),
  getTaskFormDefinition: vi.fn(() => null),
  refreshRuntimeData: vi.fn(),
  startInstance: vi.fn(),
  assignTask: vi.fn(),
  completeTask: vi.fn(),
  inspectInstance: vi.fn(),
  stopInstance: vi.fn(),
  archiveInstance: vi.fn(),
  saveUserPreferences: vi.fn(),
  setupOtpMfa: vi.fn(),
  setupTotpMfa: vi.fn(),
  requestPasswordResetToken: vi.fn(),
  confirmPasswordResetToken: vi.fn(),
};

vi.mock("./useProcessRuntime", () => ({
  useProcessRuntime: () => hookState,
}));

describe("ProcessRuntimeWorkbench", () => {
  beforeEach(() => {
    Object.values(hookState).forEach((entry) => {
      if (typeof entry === "function" && "mockClear" in entry) {
        entry.mockClear();
      }
    });
  });

  it("renders user settings panel and triggers save action", () => {
    render(<ProcessRuntimeWorkbench />);

    expect(screen.getByText("Process Runtime Workbench")).toBeInTheDocument();
    expect(screen.getByText("User settings")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save user settings" }));
    expect(hookState.saveUserPreferences).toHaveBeenCalledTimes(1);
  });

  it("forwards profile edits to hook setter", () => {
    render(<ProcessRuntimeWorkbench />);

    fireEvent.change(screen.getByLabelText("Profile display name"), {
      target: { value: "Runtime QA" },
    });

    expect(hookState.setUserPreferences).toHaveBeenCalledTimes(1);
  });
});
`;
}

module.exports = {
  buildFrontendProcessRuntimeWorkbenchTestJsx,
};
