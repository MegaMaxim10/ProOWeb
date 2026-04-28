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
    taskFormValuesByTaskId,
    assignTargetByTaskId,
    instanceStatusFilter,
    instanceViewMode,
    taskViewMode,
    monitorInstanceFilter,
    monitorActionFilter,
    startOptions,
    startableFromRegistry,
    manualTaskCatalog,
    tasks,
    visibleTasks,
    instances,
    visibleInstances,
    timeline,
    monitorEvents,
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
    setTaskFormValue,
    setAssignTargetByTaskId,
    setInstanceStatusFilter,
    setInstanceViewMode,
    setTaskViewMode,
    setMonitorInstanceFilter,
    setMonitorActionFilter,
    getTaskFormDefinition,
    refreshRuntimeData,
    startInstance,
    assignTask,
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
          <h3>Pending tasks ({visibleTasks.length}/{tasks.length})</h3>
          <div className="runtime-view-switch">
            <button
              type="button"
              className={taskViewMode === "TO_PROCESS" ? "is-active" : ""}
              onClick={() => setTaskViewMode("TO_PROCESS")}
            >
              To process
            </button>
            <button
              type="button"
              className={taskViewMode === "TO_ASSIGN" ? "is-active" : ""}
              onClick={() => setTaskViewMode("TO_ASSIGN")}
            >
              To assign
            </button>
            <button
              type="button"
              className={taskViewMode === "ALL" ? "is-active" : ""}
              onClick={() => setTaskViewMode("ALL")}
            >
              All visible
            </button>
          </div>
          <label>
            Global completion payload (JSON object, merged with generated form fields)
            <textarea
              value={completionPayloadRaw}
              onChange={(event) => setCompletionPayloadRaw(event.target.value)}
              rows={4}
              className="runtime-json"
            />
          </label>
          <ul className="identity-list">
            {visibleTasks.map((task) => (
              <li key={task.taskId}>
                <strong>{task.activityId}</strong>
                <span>Task: {task.taskId}</span>
                <small>Instance: {task.instanceId}</small>
                <small>Assignee: {task.assignee || "-"}</small>
                <small>
                  Assignment: {task.assignmentStatus || "-"} ({task.assignmentMode || "-"} / {task.assignmentStrategy || "-"})
                </small>
                <small>Candidate roles: {(task.candidateRoles || []).join(", ") || "-"}</small>
                {getTaskFormDefinition(task) ? (
                  <div className="runtime-form-grid">
                    {(getTaskFormDefinition(task).inputFields || []).map((field) => (
                      <label key={String(task.taskId) + ":" + String(field.targetPath)}>
                        {field.label || field.targetPath}
                        <input
                          type="text"
                          value={(taskFormValuesByTaskId[task.taskId] || {})[field.targetPath] || ""}
                          onChange={(event) => setTaskFormValue(task, field.targetPath, event.target.value)}
                          placeholder={field.targetPath}
                        />
                      </label>
                    ))}
                    {((getTaskFormDefinition(task).inputFields || []).length === 0) ? (
                      <small>No generated input field for this activity.</small>
                    ) : null}
                    <small>
                      Data viewer roles: {(getTaskFormDefinition(task).dataViewerRoles || []).join(", ") || "-"}
                    </small>
                  </div>
                ) : (
                  <small>No generated form definition for this activity.</small>
                )}
                <div className="assign-row">
                  <input
                    type="text"
                    value={assignTargetByTaskId[task.taskId] || ""}
                    onChange={(event) =>
                      setAssignTargetByTaskId((previous) => ({
                        ...previous,
                        [task.taskId]: event.target.value,
                      }))
                    }
                    placeholder="assignee id"
                  />
                  <button
                    type="button"
                    disabled={loading || working}
                    onClick={() => assignTask(task)}
                  >
                    Assign
                  </button>
                  {hasMonitorPrivilege ? (
                    <button
                      type="button"
                      disabled={loading || working}
                      onClick={() => assignTask(task, { force: true })}
                    >
                      Force assign
                    </button>
                  ) : null}
                </div>
                <div className="runtime-actions">
                  <button
                    type="button"
                    disabled={loading || working || !task.assignee}
                    onClick={() => completeTask(task)}
                  >
                    Complete task
                  </button>
                  <button type="button" disabled={loading || working} onClick={() => inspectInstance(task.instanceId)}>
                    Inspect instance
                  </button>
                </div>
              </li>
            ))}
            {visibleTasks.length === 0 ? <li>No pending task for this task view.</li> : null}
          </ul>
        </div>

        <div className="identity-box">
          <h3>Instances ({visibleInstances.length}/{instances.length})</h3>
          <div className="runtime-view-switch">
            <button
              type="button"
              className={instanceViewMode === "PARTICIPATING" ? "is-active" : ""}
              onClick={() => setInstanceViewMode("PARTICIPATING")}
            >
              Participating
            </button>
            <button
              type="button"
              className={instanceViewMode === "CONSULTATION" ? "is-active" : ""}
              onClick={() => setInstanceViewMode("CONSULTATION")}
            >
              Consultation
            </button>
            <button
              type="button"
              className={instanceViewMode === "ALL" ? "is-active" : ""}
              onClick={() => setInstanceViewMode("ALL")}
            >
              All visible
            </button>
          </div>
          <label>
            Status filter
            <select
              value={instanceStatusFilter}
              onChange={(event) => setInstanceStatusFilter(event.target.value)}
            >
              <option value="ALL">ALL</option>
              <option value="RUNNING">RUNNING</option>
              <option value="STOPPED">STOPPED</option>
              <option value="ARCHIVED">ARCHIVED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </label>
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
            {visibleInstances.map((instance) => (
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
            {visibleInstances.length === 0 ? <li>No visible instance for current filters.</li> : null}
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
          <h3>PROCESS_MONITOR Console</h3>
          {hasMonitorPrivilege ? (
            <>
              <label>
                Instance filter
                <input
                  type="text"
                  value={monitorInstanceFilter}
                  onChange={(event) => setMonitorInstanceFilter(event.target.value)}
                  placeholder="instance id (optional)"
                />
              </label>
              <label>
                Action filter
                <select
                  value={monitorActionFilter}
                  onChange={(event) => setMonitorActionFilter(event.target.value)}
                >
                  <option value="ALL">ALL</option>
                  <option value="TASK_ASSIGN">TASK_ASSIGN</option>
                  <option value="INSTANCE_STOP">INSTANCE_STOP</option>
                  <option value="INSTANCE_ARCHIVE">INSTANCE_ARCHIVE</option>
                </select>
              </label>
              <button type="button" onClick={refreshRuntimeData} disabled={loading || working}>
                Refresh monitor events
              </button>
              <ul className="monitor-event-list">
                {monitorEvents.map((event) => (
                  <li key={event.eventId || (String(event.occurredAt) + ":" + String(event.actionType))}>
                    <strong>{event.actionType || "UNKNOWN_ACTION"}</strong>
                    <small>{event.occurredAt || "-"}</small>
                    <small>
                      Actor: {event.actor || "-"} | Roles: {(event.actorRoleCodes || []).join(", ") || "-"}
                    </small>
                    <small>
                      Target: {event.targetType || "-"} / {event.targetId || "-"} | Forced: {event.forced ? "YES" : "NO"}
                    </small>
                    <small>Details: {event.details || "-"}</small>
                  </li>
                ))}
                {monitorEvents.length === 0 ? <li>No monitor event for current filters.</li> : null}
              </ul>
            </>
          ) : (
            <small>PROCESS_MONITOR or ADMINISTRATOR role is required to access governance audit events.</small>
          )}
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
