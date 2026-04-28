function buildFrontendUseProcessRuntimeHookJs() {
  return `import { useMemo, useState } from "react";
import { generatedProcessRegistry } from "../generatedProcessRegistry";
import { listManualTasksByRole } from "../generatedTaskInboxCatalog";
import {
  fetchProcessRuntimeStartOptions,
  startProcessRuntimeInstance,
  listProcessRuntimeTasks,
  listProcessRuntimeInstances,
  completeProcessRuntimeTask,
  readProcessRuntimeInstance,
  readProcessRuntimeTimeline,
  stopProcessRuntimeInstance,
  archiveProcessRuntimeInstance,
} from "../runtime/generatedProcessRuntimeApi";

function parseRoleCodes(rawRoles) {
  return Array.from(
    new Set(
      String(rawRoles || "")
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function parseObjectPayload(rawValue) {
  const normalized = String(rawValue || "").trim();
  if (!normalized) {
    return {};
  }

  const parsed = JSON.parse(normalized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a valid JSON object.");
  }

  return parsed;
}

function toStartKey(option) {
  return String(option.modelKey || "") + "::" + String(option.versionNumber || "");
}

export function useProcessRuntime() {
  const [actor, setActor] = useState("process.user");
  const [rolesRaw, setRolesRaw] = useState("PROCESS_USER");
  const [startPayloadRaw, setStartPayloadRaw] = useState("{\\n  \\"seed\\": \\"runtime-workbench\\"\\n}");
  const [completionPayloadRaw, setCompletionPayloadRaw] = useState("{\\n  \\"decision\\": \\"APPROVED\\"\\n}");
  const [stopReason, setStopReason] = useState("Stopped from generated runtime workbench.");
  const [selectedStartKey, setSelectedStartKey] = useState("");
  const [selectedStartActivityByKey, setSelectedStartActivityByKey] = useState({});
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [startOptions, setStartOptions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [instances, setInstances] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const roleCodes = useMemo(() => parseRoleCodes(rolesRaw), [rolesRaw]);
  const startableFromRegistry = useMemo(() => {
    const rows = [];
    for (const roleCode of roleCodes) {
      for (const registryEntry of generatedProcessRegistry) {
        if ((registryEntry.startableByRoles || []).includes(roleCode)) {
          rows.push(registryEntry);
        }
      }
    }

    const deduplicated = [];
    const seen = new Set();
    for (const entry of rows) {
      const key = String(entry.modelKey || "") + "::" + String(entry.versionNumber || "");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduplicated.push(entry);
    }
    return deduplicated;
  }, [roleCodes]);
  const manualTaskCatalog = useMemo(() => {
    const rows = [];
    for (const roleCode of roleCodes) {
      for (const task of listManualTasksByRole(roleCode)) {
        rows.push(task);
      }
    }

    const deduplicated = [];
    const seen = new Set();
    for (const task of rows) {
      const key = String(task.modelKey || "") + "::" + String(task.versionNumber || "") + "::" + String(task.activityId || "");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduplicated.push(task);
    }
    return deduplicated;
  }, [roleCodes]);
  const hasMonitorPrivilege = useMemo(
    () => roleCodes.includes("PROCESS_MONITOR") || roleCodes.includes("ADMINISTRATOR"),
    [roleCodes],
  );
  const selectedStartOption = useMemo(
    () => startOptions.find((entry) => toStartKey(entry) === selectedStartKey) || null,
    [selectedStartKey, startOptions],
  );

  async function refreshRuntimeData() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const trimmedActor = actor.trim();
      const [startOptionsPayload, tasksPayload, instancesPayload] = await Promise.all([
        fetchProcessRuntimeStartOptions({
          actor: trimmedActor,
          roles: roleCodes,
        }),
        listProcessRuntimeTasks(trimmedActor),
        listProcessRuntimeInstances({
          actor: trimmedActor,
          roles: roleCodes,
        }),
      ]);

      const nextStartOptions = Array.isArray(startOptionsPayload?.startOptions)
        ? startOptionsPayload.startOptions
        : [];
      const nextTasks = Array.isArray(tasksPayload?.tasks) ? tasksPayload.tasks : [];
      const nextInstances = Array.isArray(instancesPayload?.instances) ? instancesPayload.instances : [];

      setStartOptions(nextStartOptions);
      setTasks(nextTasks);
      setInstances(nextInstances);

      if (!selectedStartKey && nextStartOptions.length > 0) {
        const defaultStart = nextStartOptions[0];
        const defaultStartKey = toStartKey(defaultStart);
        setSelectedStartKey(defaultStartKey);
        setSelectedStartActivityByKey((previous) => ({
          ...previous,
          [defaultStartKey]: (defaultStart.allowedStartActivities || [])[0] || "",
        }));
      }

      if (selectedInstanceId) {
        const [instancePayload, timelinePayload] = await Promise.all([
          readProcessRuntimeInstance(selectedInstanceId),
          readProcessRuntimeTimeline(selectedInstanceId),
        ]);
        setSelectedInstance(instancePayload?.instance || null);
        setTimeline(Array.isArray(timelinePayload?.timeline) ? timelinePayload.timeline : []);
      }

      setSuccess("Runtime snapshot refreshed.");
    } catch (cause) {
      setError(cause?.message || "Unable to refresh runtime snapshot.");
    } finally {
      setLoading(false);
    }
  }

  async function startInstance() {
    if (!selectedStartOption) {
      setError("Select a process start option first.");
      return;
    }

    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const startActivityId = selectedStartActivityByKey[selectedStartKey]
        || (selectedStartOption.allowedStartActivities || [])[0]
        || null;
      const payload = parseObjectPayload(startPayloadRaw);
      const startedPayload = await startProcessRuntimeInstance({
        modelKey: selectedStartOption.modelKey,
        versionNumber: selectedStartOption.versionNumber,
        startActivityId,
        actor: actor.trim(),
        roleCodes,
        initialPayload: payload,
      });

      const startedInstanceId = startedPayload?.instance?.instanceId || "";
      if (startedInstanceId) {
        setSelectedInstanceId(startedInstanceId);
      }

      await refreshRuntimeData();
      setSuccess("Process instance started.");
    } catch (cause) {
      setError(cause?.message || "Unable to start process instance.");
    } finally {
      setWorking(false);
    }
  }

  async function completeTask(task) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = parseObjectPayload(completionPayloadRaw);
      await completeProcessRuntimeTask(task.taskId, {
        instanceId: task.instanceId,
        actor: actor.trim(),
        payload,
      });
      await refreshRuntimeData();
      setSuccess("Task completed.");
    } catch (cause) {
      setError(cause?.message || "Unable to complete task.");
    } finally {
      setWorking(false);
    }
  }

  async function inspectInstance(instanceId) {
    if (!instanceId) {
      return;
    }

    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const [instancePayload, timelinePayload] = await Promise.all([
        readProcessRuntimeInstance(instanceId),
        readProcessRuntimeTimeline(instanceId),
      ]);

      setSelectedInstanceId(instanceId);
      setSelectedInstance(instancePayload?.instance || null);
      setTimeline(Array.isArray(timelinePayload?.timeline) ? timelinePayload.timeline : []);
      setSuccess("Runtime instance loaded.");
    } catch (cause) {
      setError(cause?.message || "Unable to load instance details.");
    } finally {
      setWorking(false);
    }
  }

  async function stopInstance(instanceId) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await stopProcessRuntimeInstance(instanceId, {
        actor: actor.trim(),
        reason: stopReason.trim(),
      });
      await refreshRuntimeData();
      setSuccess("Runtime instance stopped.");
    } catch (cause) {
      setError(cause?.message || "Unable to stop instance.");
    } finally {
      setWorking(false);
    }
  }

  async function archiveInstance(instanceId) {
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await archiveProcessRuntimeInstance(instanceId, {
        actor: actor.trim(),
      });
      await refreshRuntimeData();
      setSuccess("Runtime instance archived.");
    } catch (cause) {
      setError(cause?.message || "Unable to archive instance.");
    } finally {
      setWorking(false);
    }
  }

  return {
    actor,
    rolesRaw,
    startPayloadRaw,
    completionPayloadRaw,
    stopReason,
    selectedStartKey,
    selectedStartOption,
    selectedStartActivityByKey,
    selectedInstanceId,
    selectedInstance,
    startOptions,
    startableFromRegistry,
    manualTaskCatalog,
    tasks,
    instances,
    timeline,
    loading,
    working,
    hasMonitorPrivilege,
    error,
    success,
    setActor,
    setRolesRaw,
    setStartPayloadRaw,
    setCompletionPayloadRaw,
    setStopReason,
    setSelectedStartKey,
    setSelectedStartActivityByKey,
    refreshRuntimeData,
    startInstance,
    completeTask,
    inspectInstance,
    stopInstance,
    archiveInstance,
  };
}
`;
}

module.exports = {
  buildFrontendUseProcessRuntimeHookJs,
};

