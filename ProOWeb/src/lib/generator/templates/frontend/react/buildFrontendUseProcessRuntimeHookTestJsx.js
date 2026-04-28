function buildFrontendUseProcessRuntimeHookTestJsx() {
  return `import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as runtimeApi from "../runtime/generatedProcessRuntimeApi";
import { useProcessRuntime } from "./useProcessRuntime";

vi.mock("../runtime/generatedProcessRuntimeApi", () => ({
  fetchProcessRuntimeStartOptions: vi.fn(async () => ({ startOptions: [] })),
  startProcessRuntimeInstance: vi.fn(async () => ({ instance: { instanceId: "instance-1" } })),
  listProcessRuntimeTasks: vi.fn(async () => ({ tasks: [] })),
  listProcessRuntimeInstances: vi.fn(async () => ({ instances: [] })),
  assignProcessRuntimeTask: vi.fn(async () => ({})),
  completeProcessRuntimeTask: vi.fn(async () => ({})),
  readProcessRuntimeInstance: vi.fn(async () => ({ instance: null })),
  readProcessRuntimeTimeline: vi.fn(async () => ({ timeline: [] })),
  listProcessRuntimeMonitorEvents: vi.fn(async () => ({ events: [] })),
  readProcessRuntimeUserPreferences: vi.fn(async () => ({
    preferences: {
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
  })),
  updateProcessRuntimeUserPreferences: vi.fn(async (payload) => ({
    preferences: {
      userId: payload.targetUserId || payload.actor || "process.user",
      profileDisplayName: payload.profileDisplayName || "Process User",
      profilePhotoUrl: payload.profilePhotoUrl || "",
      preferredLanguage: payload.preferredLanguage || "en",
      preferredTheme: payload.preferredTheme || "SYSTEM",
      notificationChannel: payload.notificationChannel || "IN_APP_EMAIL",
      notificationsEnabled: payload.notificationsEnabled !== false,
      automaticTaskPolicy: payload.automaticTaskPolicy || "MANUAL_TRIGGER",
      automaticTaskDelaySeconds: Number(payload.automaticTaskDelaySeconds || 0),
      automaticTaskNotifyOnly: payload.automaticTaskNotifyOnly !== false,
    },
  })),
  setupOtpMfaWithBasicAuth: vi.fn(async () => ({})),
  setupTotpMfaWithBasicAuth: vi.fn(async () => ({})),
  requestPasswordReset: vi.fn(async () => ({})),
  confirmPasswordReset: vi.fn(async () => ({})),
  stopProcessRuntimeInstance: vi.fn(async () => ({})),
  archiveProcessRuntimeInstance: vi.fn(async () => ({})),
}));

describe("useProcessRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads user preferences during runtime refresh", async () => {
    runtimeApi.readProcessRuntimeUserPreferences.mockResolvedValueOnce({
      preferences: {
        userId: "runtime.user",
        profileDisplayName: "Runtime User",
        profilePhotoUrl: "",
        preferredLanguage: "fr",
        preferredTheme: "LIGHT",
        notificationChannel: "IN_APP",
        notificationsEnabled: true,
        automaticTaskPolicy: "AUTO_AFTER_DELAY",
        automaticTaskDelaySeconds: 45,
        automaticTaskNotifyOnly: false,
      },
    });

    const { result } = renderHook(() => useProcessRuntime());

    await act(async () => {
      await result.current.refreshRuntimeData();
    });

    expect(runtimeApi.fetchProcessRuntimeStartOptions).toHaveBeenCalled();
    expect(runtimeApi.readProcessRuntimeUserPreferences).toHaveBeenCalled();
    expect(result.current.userPreferences.profileDisplayName).toBe("Runtime User");
    expect(result.current.userPreferences.preferredLanguage).toBe("fr");
    expect(result.current.userPreferences.automaticTaskPolicy).toBe("AUTO_AFTER_DELAY");
  });

  it("sends settings payload when saving user preferences", async () => {
    const { result } = renderHook(() => useProcessRuntime());

    act(() => {
      result.current.setActor("qa.user");
      result.current.setRolesRaw("PROCESS_USER,PROCESS_MONITOR");
      result.current.setPreferencesTargetUserId("runtime.approverA");
      result.current.setUserPreferences((previous) => ({
        ...previous,
        profileDisplayName: "QA Runtime",
        preferredLanguage: "fr",
        preferredTheme: "DARK",
        notificationChannel: "EMAIL",
        notificationsEnabled: true,
        automaticTaskPolicy: "AUTO_AFTER_DELAY",
        automaticTaskDelaySeconds: 120,
        automaticTaskNotifyOnly: false,
      }));
    });

    await act(async () => {
      await result.current.saveUserPreferences();
    });

    expect(runtimeApi.updateProcessRuntimeUserPreferences).toHaveBeenCalledTimes(1);
    expect(runtimeApi.updateProcessRuntimeUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "qa.user",
        targetUserId: "runtime.approverA",
        profileDisplayName: "QA Runtime",
        preferredLanguage: "fr",
        preferredTheme: "DARK",
        notificationChannel: "EMAIL",
        automaticTaskPolicy: "AUTO_AFTER_DELAY",
        automaticTaskDelaySeconds: 120,
        automaticTaskNotifyOnly: false,
      }),
    );
  });
});
`;
}

module.exports = {
  buildFrontendUseProcessRuntimeHookTestJsx,
};
