import { setFeedback } from "../shared/feedback.js";
import {
  fetchProcessModels,
  createProcessModel,
  createProcessModelVersion,
  fetchProcessModelVersion,
  fetchProcessModelRuntimeContract,
  fetchProcessModelDataContract,
  fetchProcessModelSpecification,
  validateProcessModelSpecification,
  saveProcessModelSpecification,
  createProcessModelSnapshot,
  undoProcessModelSnapshot,
  redoProcessModelSnapshot,
  compareProcessModelVersions,
  transitionProcessModelVersion,
  deployProcessModelVersion,
  undeployProcessModelVersion,
} from "./process-modeling-api.js";
import { initializeBpmnStudio } from "./bpmn-studio.js";
import { initializeSpecificationStudio } from "./specification-studio.js";

function byVersionNumber(left, right) {
  return Number(left?.versionNumber || 0) - Number(right?.versionNumber || 0);
}

function buildModelOptionLabel(model) {
  return `${model.modelKey} - ${model.title}`;
}

function getModelByKey(models, modelKey) {
  return models.find((entry) => entry.modelKey === modelKey) || null;
}

function buildVersionOptionLabel(version) {
  return `v${version.versionNumber} (${version.status})`;
}

function fillSelectOptions(select, options, selectedValue = "") {
  if (!select) {
    return;
  }

  const previousValue = selectedValue || select.value || "";
  select.innerHTML = "";

  if (options.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "-";
    select.appendChild(option);
    select.value = "";
    return;
  }

  for (const optionData of options) {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.appendChild(option);
  }

  const availableValues = new Set(options.map((entry) => String(entry.value)));
  select.value = availableValues.has(String(previousValue))
    ? String(previousValue)
    : String(options[0].value);
}

function fillModelSelectors(selectors, models) {
  const options = models.map((model) => ({
    value: model.modelKey,
    label: buildModelOptionLabel(model),
  }));

  for (const selector of selectors) {
    fillSelectOptions(selector, options, selector.value);
  }
}

function fillVersionSelector(selector, model) {
  const options = (model?.versions || [])
    .slice()
    .sort(byVersionNumber)
    .map((version) => ({
      value: String(version.versionNumber),
      label: buildVersionOptionLabel(version),
    }));

  fillSelectOptions(selector, options, selector.value);
}

function renderCatalog(container, models) {
  if (!container) {
    return;
  }

  if (!Array.isArray(models) || models.length === 0) {
    container.textContent = "No process models yet.";
    return;
  }

  const lines = [];
  for (const model of models) {
    lines.push(`${model.modelKey} | ${model.title}`);
    lines.push(`  Description: ${model.description || "-"}`);

    const versions = (model.versions || []).slice().sort(byVersionNumber);
    for (const version of versions) {
      lines.push(
        `  - v${version.versionNumber} | ${version.status} | ${version.summary || "-"} | lines=${version.bpmnLineCount}`,
      );
    }
  }

  container.textContent = lines.join("\n");
}

function renderDiffReport(diff) {
  if (!diff) {
    return "No diff report.";
  }

  const lines = [
    `Model: ${diff.modelKey}`,
    `Source version: ${diff.sourceVersion}`,
    `Target version: ${diff.targetVersion}`,
    `Shared lines: ${diff.sharedLineCount}`,
    "",
    "[Added lines]",
    ...(Array.isArray(diff.added) && diff.added.length > 0 ? diff.added : ["-"]),
    "",
    "[Removed lines]",
    ...(Array.isArray(diff.removed) && diff.removed.length > 0 ? diff.removed : ["-"]),
  ];

  return lines.join("\n");
}

function renderDeploymentReport(deployment) {
  const report = deployment?.report;
  if (!report) {
    return "No deployment report.";
  }

  return JSON.stringify(report, null, 2);
}

function renderRuntimeContractReport(payload) {
  const contract = payload?.contract;
  if (!contract || typeof contract !== "object") {
    return "No runtime contract available.";
  }

  const summary = contract.summary || {};
  const lines = [
    `Runtime contract for ${contract.modelKey} v${contract.versionNumber}`,
    `Status: ${contract.status}`,
    `Deployed at: ${contract.deployedAt || "-"}`,
    `Activities: ${summary.activityCount ?? 0}`,
    `Manual activities: ${summary.manualActivityCount ?? 0}`,
    `Automatic activities: ${summary.automaticActivityCount ?? 0}`,
    `Startable roles: ${(contract.start?.startableByRoles || []).join(", ") || "-"}`,
    `Monitor roles: ${(contract.monitors?.monitorRoles || []).join(", ") || "-"}`,
    "",
    "[Activity Runtime Policies]",
  ];

  for (const activity of contract.activities || []) {
    lines.push(
      `- ${activity.activityId} | ${activity.activityType} | strategy=${activity.assignment?.strategy || "-"}`,
    );
  }

  return lines.join("\n");
}

function renderDataContractReport(payload) {
  const contract = payload?.contract;
  if (!contract || typeof contract !== "object") {
    return "No data contract available.";
  }

  const summary = contract.summary || {};
  const lines = [
    `Data contract for ${contract.modelKey} v${contract.versionNumber}`,
    `Status: ${contract.status || "-"}`,
    `Activities: ${summary.activityCount ?? 0}`,
    `Input sources: ${summary.inputSourceCount ?? 0}`,
    `Input mappings: ${summary.inputMappingCount ?? 0}`,
    `Output mappings: ${summary.outputMappingCount ?? 0}`,
    `Lineage edges: ${summary.lineageEdgeCount ?? 0}`,
    `Shared data entities: ${summary.sharedDataEntityCount ?? 0}`,
    `Warnings: ${summary.warningCount ?? 0}`,
    "",
    "[Shared Data Entities]",
  ];

  for (const entity of contract.sharedData?.entities || []) {
    lines.push(
      `- ${entity.entityKey} | producedBy=${(entity.producedByActivities || []).join(",") || "-"} | consumedBy=${(entity.consumedByActivities || []).join(",") || "-"}`,
    );
  }

  lines.push("", "[Sample Lineage Edges]");
  const sampleEdges = (contract.lineage?.edges || []).slice(0, 15);
  for (const edge of sampleEdges) {
    if (edge.edgeType === "INPUT") {
      lines.push(`- INPUT | ${edge.sourceType}:${edge.sourceRef || "-"}:${edge.sourcePath} -> ${edge.activityId}.input.${edge.targetPath}`);
    } else {
      lines.push(`- OUTPUT | ${edge.activityId}.output.${edge.sourcePath} -> ${edge.storageTarget}:${edge.targetPath}`);
    }
  }

  return lines.join("\n");
}

function renderSpecificationReport(action, payload) {
  const summary = payload?.summary || {};
  const validation = payload?.validation || {};
  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];

  const lines = [
    `Action: specification/${action}`,
    `Model: ${payload?.model?.modelKey || "-"}`,
    `Version: ${payload?.version?.versionNumber || "-"}`,
    `Schema version: ${summary.schemaVersion || payload?.specification?.schemaVersion || "-"}`,
    `Activities: ${summary.activityCount ?? "-"}`,
    `Manual activities: ${summary.manualActivityCount ?? "-"}`,
    `Automatic activities: ${summary.automaticActivityCount ?? "-"}`,
    `Validation: ${validation.valid ? "valid" : "invalid"}`,
    `Errors: ${errors.length}`,
    `Warnings: ${warnings.length}`,
  ];

  if (errors.length > 0) {
    lines.push("", "[Errors]");
    for (const issue of errors) {
      lines.push(`- ${issue.path || "-"}: ${issue.message || "-"}`);
    }
  }

  if (warnings.length > 0) {
    lines.push("", "[Warnings]");
    for (const issue of warnings) {
      lines.push(`- ${issue.path || "-"}: ${issue.message || "-"}`);
    }
  }

  return lines.join("\n");
}

function bindVersionSync({
  modelSelector,
  versionSelector,
  getModels,
}) {
  if (!modelSelector || !versionSelector) {
    return;
  }

  const refresh = () => {
    const models = getModels();
    const model = getModelByKey(models, modelSelector.value);
    fillVersionSelector(versionSelector, model);
  };

  modelSelector.addEventListener("change", refresh);
  refresh();
}

export async function wireProcessModelingPanel({ status, documentRef = document }) {
  if (!status?.initialized || !status?.workspace) {
    return;
  }
  const processModelingEnabled = status.workspace?.backendOptions?.processModeling?.enabled !== false;
  const processSection = documentRef.getElementById("process-model");

  const catalogView = documentRef.getElementById("process-model-catalog");
  const reportView = documentRef.getElementById("process-model-report");

  const createForm = documentRef.getElementById("process-model-create-form");
  const createFeedback = documentRef.getElementById("process-model-create-feedback");

  const createVersionForm = documentRef.getElementById("process-model-version-form");
  const createVersionFeedback = documentRef.getElementById("process-model-version-feedback");
  const createVersionModelSelector = documentRef.getElementById("process-version-model");

  const diffForm = documentRef.getElementById("process-model-diff-form");
  const diffFeedback = documentRef.getElementById("process-model-diff-feedback");
  const diffModelSelector = documentRef.getElementById("process-diff-model");
  const diffSourceSelector = documentRef.getElementById("process-diff-source-version");
  const diffTargetSelector = documentRef.getElementById("process-diff-target-version");

  const transitionForm = documentRef.getElementById("process-model-transition-form");
  const transitionFeedback = documentRef.getElementById("process-model-transition-feedback");
  const transitionModelSelector = documentRef.getElementById("process-transition-model");
  const transitionVersionSelector = documentRef.getElementById("process-transition-version");

  const deployForm = documentRef.getElementById("process-model-deploy-form");
  const deployFeedback = documentRef.getElementById("process-model-deploy-feedback");
  const deployModelSelector = documentRef.getElementById("process-deploy-model");
  const deployVersionSelector = documentRef.getElementById("process-deploy-version");
  const undeployForm = documentRef.getElementById("process-model-undeploy-form");
  const undeployFeedback = documentRef.getElementById("process-model-undeploy-feedback");
  const undeployModelSelector = documentRef.getElementById("process-undeploy-model");
  const undeployVersionSelector = documentRef.getElementById("process-undeploy-version");

  const runtimeContractForm = documentRef.getElementById("process-model-runtime-contract-form");
  const runtimeContractFeedback = documentRef.getElementById("process-model-runtime-contract-feedback");
  const runtimeContractModelSelector = documentRef.getElementById("process-runtime-contract-model");
  const runtimeContractVersionSelector = documentRef.getElementById("process-runtime-contract-version");
  const dataContractForm = documentRef.getElementById("process-model-data-contract-form");
  const dataContractFeedback = documentRef.getElementById("process-model-data-contract-feedback");
  const dataContractModelSelector = documentRef.getElementById("process-data-contract-model");
  const dataContractVersionSelector = documentRef.getElementById("process-data-contract-version");

  if (
    !catalogView
    || !reportView
    || !createForm
    || !createVersionForm
    || !diffForm
    || !transitionForm
    || !deployForm
    || !undeployForm
    || !runtimeContractForm
    || !dataContractForm
  ) {
    return;
  }

  if (!processModelingEnabled) {
    if (processSection) {
      for (const field of processSection.querySelectorAll("input, select, textarea, button")) {
        field.disabled = true;
      }
    }

    catalogView.textContent = "Process modeling is disabled for this workspace. Re-enable it in the reconfiguration panel.";
    reportView.textContent = "No report available while process modeling is disabled.";
    return;
  }

  const bpmnStudio = await initializeBpmnStudio({
    documentRef,
    api: {
      fetchProcessModelVersion,
      createProcessModelSnapshot,
      undoProcessModelSnapshot,
      redoProcessModelSnapshot,
    },
  });
  const specificationStudio = await initializeSpecificationStudio({
    documentRef,
    api: {
      fetchProcessModelSpecification,
      validateProcessModelSpecification,
      saveProcessModelSpecification,
    },
    onReport(action, payload) {
      reportView.textContent = renderSpecificationReport(action, payload);
    },
  });

  let models = [];
  const modelSelectors = [
    createVersionModelSelector,
    diffModelSelector,
    transitionModelSelector,
    deployModelSelector,
    undeployModelSelector,
    runtimeContractModelSelector,
    dataContractModelSelector,
  ].filter(Boolean);

  function getModels() {
    return models;
  }

  bindVersionSync({
    modelSelector: diffModelSelector,
    versionSelector: diffSourceSelector,
    getModels,
  });
  bindVersionSync({
    modelSelector: diffModelSelector,
    versionSelector: diffTargetSelector,
    getModels,
  });
  bindVersionSync({
    modelSelector: transitionModelSelector,
    versionSelector: transitionVersionSelector,
    getModels,
  });
  bindVersionSync({
    modelSelector: deployModelSelector,
    versionSelector: deployVersionSelector,
    getModels,
  });
  bindVersionSync({
    modelSelector: undeployModelSelector,
    versionSelector: undeployVersionSelector,
    getModels,
  });
  bindVersionSync({
    modelSelector: runtimeContractModelSelector,
    versionSelector: runtimeContractVersionSelector,
    getModels,
  });
  bindVersionSync({
    modelSelector: dataContractModelSelector,
    versionSelector: dataContractVersionSelector,
    getModels,
  });

  async function refreshModels() {
    const payload = await fetchProcessModels();
    models = Array.isArray(payload?.models) ? payload.models : [];
    fillModelSelectors(modelSelectors, models);
    renderCatalog(catalogView, models);
    if (typeof bpmnStudio?.setCatalog === "function") {
      bpmnStudio.setCatalog(models);
    }
    if (typeof specificationStudio?.setCatalog === "function") {
      specificationStudio.setCatalog(models);
    }
  }

  await refreshModels();
  reportView.textContent = "Select an action to see details.";

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(createFeedback, "Creating process model...");

    const payload = Object.fromEntries(new FormData(createForm).entries());
    try {
      if (!String(payload.bpmnXml || "").trim() && bpmnStudio?.ready) {
        payload.bpmnXml = await bpmnStudio.getXml();
      }
      await createProcessModel(payload);
      setFeedback(createFeedback, "Process model created.", "success");
      createForm.reset();
      await refreshModels();
    } catch (error) {
      setFeedback(createFeedback, error.message || "Failed to create process model.", "error");
    }
  });

  createVersionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(createVersionFeedback, "Creating model version...");

    const form = new FormData(createVersionForm);
    const modelKey = String(form.get("modelKey") || "");
    const payload = {
      summary: form.get("summary"),
      bpmnXml: form.get("bpmnXml"),
    };

    try {
      if (!String(payload.bpmnXml || "").trim() && bpmnStudio?.ready) {
        payload.bpmnXml = await bpmnStudio.getXml();
      }
      await createProcessModelVersion(modelKey, payload);
      setFeedback(createVersionFeedback, "Process model version created.", "success");
      createVersionForm.reset();
      await refreshModels();
    } catch (error) {
      setFeedback(createVersionFeedback, error.message || "Failed to create process model version.", "error");
    }
  });

  diffForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(diffFeedback, "Computing BPMN diff...");

    const form = new FormData(diffForm);
    const modelKey = String(form.get("modelKey") || "");
    const sourceVersion = form.get("sourceVersion");
    const targetVersion = form.get("targetVersion");

    try {
      const payload = await compareProcessModelVersions(modelKey, sourceVersion, targetVersion);
      setFeedback(diffFeedback, "Version diff ready.", "success");
      reportView.textContent = renderDiffReport(payload.diff);
    } catch (error) {
      setFeedback(diffFeedback, error.message || "Failed to compare versions.", "error");
    }
  });

  transitionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(transitionFeedback, "Applying transition...");

    const form = new FormData(transitionForm);
    const modelKey = String(form.get("modelKey") || "");
    const versionNumber = form.get("versionNumber");
    const targetStatus = form.get("targetStatus");

    try {
      await transitionProcessModelVersion(modelKey, versionNumber, targetStatus);
      setFeedback(transitionFeedback, "Transition applied.", "success");
      await refreshModels();
    } catch (error) {
      setFeedback(transitionFeedback, error.message || "Failed to transition version.", "error");
    }
  });

  deployForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(deployFeedback, "Deploying process version and generating source code...");

    const form = new FormData(deployForm);
    const modelKey = String(form.get("modelKey") || "");
    const versionNumber = form.get("versionNumber");

    try {
      const payload = await deployProcessModelVersion(modelKey, versionNumber);
      setFeedback(deployFeedback, "Deployment completed with managed generation report.", "success");
      reportView.textContent = renderDeploymentReport(payload.deployment);
      await refreshModels();
    } catch (error) {
      setFeedback(deployFeedback, error.message || "Failed to deploy version.", "error");
    }
  });

  undeployForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(undeployFeedback, "Undeploying process version and synchronizing managed artifacts...");

    const form = new FormData(undeployForm);
    const modelKey = String(form.get("modelKey") || "");
    const versionNumber = form.get("versionNumber");

    try {
      const payload = await undeployProcessModelVersion(modelKey, versionNumber);
      setFeedback(undeployFeedback, "Undeployment completed with managed cleanup report.", "success");
      reportView.textContent = renderDeploymentReport(payload.undeployment);
      await refreshModels();
    } catch (error) {
      setFeedback(undeployFeedback, error.message || "Failed to undeploy version.", "error");
    }
  });

  runtimeContractForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(runtimeContractFeedback, "Loading runtime contract...");

    const form = new FormData(runtimeContractForm);
    const modelKey = String(form.get("modelKey") || "");
    const versionNumber = form.get("versionNumber");

    try {
      const payload = await fetchProcessModelRuntimeContract(modelKey, versionNumber);
      setFeedback(runtimeContractFeedback, "Runtime contract loaded.", "success");
      reportView.textContent = renderRuntimeContractReport(payload);
    } catch (error) {
      setFeedback(runtimeContractFeedback, error.message || "Failed to load runtime contract.", "error");
    }
  });

  dataContractForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(dataContractFeedback, "Loading data contract...");

    const form = new FormData(dataContractForm);
    const modelKey = String(form.get("modelKey") || "");
    const versionNumber = form.get("versionNumber");

    try {
      const payload = await fetchProcessModelDataContract(modelKey, versionNumber);
      setFeedback(dataContractFeedback, "Data contract loaded.", "success");
      reportView.textContent = renderDataContractReport(payload);
    } catch (error) {
      setFeedback(dataContractFeedback, error.message || "Failed to load data contract.", "error");
    }
  });
}
