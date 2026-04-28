function buildFrontendProcessRuntimeWorkbenchJsx() {
  return `import { useMemo } from "react";
import { useProcessRuntime } from "./useProcessRuntime";

function toStartOptionLabel(option) {
  return String(option.modelKey || "") + " v" + String(option.versionNumber || "");
}

export function ProcessRuntimeWorkbench() {
  const {
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
  } = useProcessRuntime();

  const selectedStartActivities = useMemo(
    () => (selectedStartOption?.allowedStartActivities || []).slice(),
    [selectedStartOption],
  );
  const selectedStartActivity = selectedStartActivityByKey[selectedStartKey] || selectedStartActivities[0] || "";

  return (
    <section className="card">
      <p className="eyebrow">Process runtime operations</p>
      <h2>Process Runtime Workbench</h2>
      <p className="muted">
        Run guided starts, process task queue, inspect timelines, and monitor runtime instances.
      </p>

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Actor context</h3>
          <label>
            Actor
            <input
              type="text"
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              placeholder="process.user"
            />
          </label>
          <label>
            Role codes (CSV)
            <input
              type="text"
              value={rolesRaw}
              onChange={(event) => setRolesRaw(event.target.value)}
              placeholder="PROCESS_USER, PROCESS_MONITOR"
            />
          </label>
          <button type="button" onClick={refreshRuntimeData} disabled={loading || working}>
            {loading ? "Refreshing..." : "Refresh runtime snapshot"}
          </button>
          <small>
            Monitor privileges: <strong>{hasMonitorPrivilege ? "YES" : "NO"}</strong>
          </small>
        </div>

        <div className="identity-box">
          <h3>Start instance</h3>
          <label>
            Process
            <select
              value={selectedStartKey}
              onChange={(event) => setSelectedStartKey(event.target.value)}
            >
              <option value="">Select process version</option>
              {startOptions.map((option) => {
                const key = String(option.modelKey || "") + "::" + String(option.versionNumber || "");
                return (
                  <option key={key} value={key}>
                    {toStartOptionLabel(option)}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Start activity
            <select
              value={selectedStartActivity}
              onChange={(event) =>
                setSelectedStartActivityByKey((previous) => ({
                  ...previous,
                  [selectedStartKey]: event.target.value,
                }))
              }
              disabled={!selectedStartKey}
            >
              <option value="">Auto select</option>
              {selectedStartActivities.map((activityId) => (
                <option key={activityId} value={activityId}>
                  {activityId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Initial payload (JSON object)
            <textarea
              value={startPayloadRaw}
              onChange={(event) => setStartPayloadRaw(event.target.value)}
              rows={5}
              className="runtime-json"
            />
          </label>
          <button
            type="button"
            onClick={startInstance}
            disabled={!selectedStartKey || loading || working}
          >
            Start process instance
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Pending tasks ({tasks.length})</h3>
          <label>
            Completion payload (JSON object)
            <textarea
              value={completionPayloadRaw}
              onChange={(event) => setCompletionPayloadRaw(event.target.value)}
              rows={4}
              className="runtime-json"
            />
          </label>
          <ul className="identity-list">
            {tasks.map((task) => (
              <li key={task.taskId}>
                <strong>{task.activityId}</strong>
                <span>Task: {task.taskId}</span>
                <small>Instance: {task.instanceId}</small>
                <small>Assignee: {task.assignee || "-"}</small>
                <div className="runtime-actions">
                  <button type="button" disabled={loading || working} onClick={() => completeTask(task)}>
                    Complete task
                  </button>
                  <button type="button" disabled={loading || working} onClick={() => inspectInstance(task.instanceId)}>
                    Inspect instance
                  </button>
                </div>
              </li>
            ))}
            {tasks.length === 0 ? <li>No pending task for current actor context.</li> : null}
          </ul>
        </div>

        <div className="identity-box">
          <h3>Instances ({instances.length})</h3>
          <label>
            Stop reason
            <input
              type="text"
              value={stopReason}
              onChange={(event) => setStopReason(event.target.value)}
              placeholder="Reason when forcing stop"
            />
          </label>
          <ul className="identity-list">
            {instances.map((instance) => (
              <li key={instance.instanceId}>
                <strong>{instance.modelKey} v{instance.versionNumber}</strong>
                <span>Status: {instance.status}</span>
                <small>Instance: {instance.instanceId}</small>
                <small>Started by: {instance.startedBy || "-"}</small>
                <div className="runtime-actions">
                  <button type="button" disabled={loading || working} onClick={() => inspectInstance(instance.instanceId)}>
                    Inspect timeline
                  </button>
                  {hasMonitorPrivilege ? (
                    <>
                      <button type="button" disabled={loading || working} onClick={() => stopInstance(instance.instanceId)}>
                        Stop
                      </button>
                      <button type="button" disabled={loading || working} onClick={() => archiveInstance(instance.instanceId)}>
                        Archive
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
            {instances.length === 0 ? <li>No visible instance for current actor context.</li> : null}
          </ul>
        </div>
      </div>

      <div className="identity-grid">
        <div className="identity-box">
          <h3>Timeline {selectedInstanceId ? "(" + selectedInstanceId + ")" : ""}</h3>
          {selectedInstance ? (
            <small>
              Selected status: <strong>{selectedInstance.status}</strong>
            </small>
          ) : (
            <small>Select an instance to inspect timeline.</small>
          )}
          <ol className="runtime-timeline">
            {timeline.map((entry, index) => (
              <li key={String(index) + ":" + String(entry)}>{String(entry)}</li>
            ))}
            {timeline.length === 0 ? <li>No timeline event loaded.</li> : null}
          </ol>
        </div>

        <div className="identity-box">
          <h3>Runtime catalogs</h3>
          <p className="muted">
            These rows come from generated catalogs written by process deployment.
          </p>
          <small>Startable process entries: {startableFromRegistry.length}</small>
          <small>Manual task catalog rows: {manualTaskCatalog.length}</small>
          <ul className="identity-list">
            {startableFromRegistry.map((entry) => (
              <li key={String(entry.modelKey) + ":" + String(entry.versionNumber)}>
                <strong>{entry.modelKey} v{entry.versionNumber}</strong>
                <small>Roles: {(entry.startableByRoles || []).join(", ") || "-"}</small>
              </li>
            ))}
            {startableFromRegistry.length === 0 ? <li>No startable entry in generated registry.</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
`;
}

module.exports = {
  buildFrontendProcessRuntimeWorkbenchJsx,
};

