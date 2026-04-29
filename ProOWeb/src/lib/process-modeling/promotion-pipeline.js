const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  createCatalogError,
  normalizeModelKey,
  normalizeVersionNumber,
  loadProcessModel,
  toPublicModel,
  toPublicVersion,
  transitionProcessModelVersion,
} = require("./catalog");
const { validateProcessSpecificationV1 } = require("./spec-v1");
const { buildRuntimeContract } = require("./runtime-contract");
const { buildDataContract } = require("./data-contract");
const { deployProcessModelVersion, undeployProcessModelVersion } = require("./deployment");
const {
  readAutomaticTaskCatalog,
  buildAutomaticTaskTypeLookup,
} = require("./automatic-task-catalog");

const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

function normalizePositiveNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return numeric;
}

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function truncateOutput(value, maxLength = 6000) {
  const source = String(value || "");
  if (source.length <= maxLength) {
    return source;
  }
  return source.slice(source.length - maxLength);
}

function toSimulationId() {
  return `simulation-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function toPromotionId() {
  return `promotion-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function resolveGeneratedProjectRoot(rootDir, workspaceConfig) {
  const generatedRoot = normalizeString(workspaceConfig?.managedBy?.generatedRoot || "root");
  if (!generatedRoot || generatedRoot === "root") {
    return path.resolve(rootDir);
  }

  return path.resolve(rootDir, generatedRoot);
}

function getPromotionsModelDir(rootDir, modelKey) {
  return path.join(rootDir, ".prooweb", "process-models", "promotions", normalizeModelKey(modelKey));
}

function getPromotionFilePath(rootDir, modelKey, promotionId) {
  const safeId = normalizeString(promotionId).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return path.join(getPromotionsModelDir(rootDir, modelKey), `${safeId}.json`);
}

function writePromotionRecord(rootDir, modelKey, promotionId, record) {
  const filePath = getPromotionFilePath(rootDir, modelKey, promotionId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function readPromotionRecord(rootDir, modelKey, promotionId) {
  const filePath = getPromotionFilePath(rootDir, modelKey, promotionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    throw createCatalogError(500, `Failed to parse promotion record '${promotionId}': ${error.message}`);
  }
}

function listPromotionRecords(rootDir, modelKey) {
  const directory = getPromotionsModelDir(rootDir, modelKey);
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(directory, entry.name));

  const records = [];
  for (const filePath of entries) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      records.push(parsed);
    } catch (_) {
      continue;
    }
  }

  records.sort((left, right) => {
    const leftTimestamp = Date.parse(left.completedAt || left.requestedAt || 0);
    const rightTimestamp = Date.parse(right.completedAt || right.requestedAt || 0);
    return rightTimestamp - leftTimestamp;
  });

  return records;
}

function findLatestRollbackCandidate(records, versionNumber) {
  const normalizedVersion = normalizeVersionNumber(versionNumber);
  return records.find((entry) =>
    entry.status === "PROMOTED"
    && Number(entry.versionNumber) === normalizedVersion
    && !entry.rollback?.completedAt) || null;
}

function requireModelAndVersion(rootDir, modelKey, versionNumber) {
  const normalizedModelKey = normalizeModelKey(modelKey);
  const normalizedVersion = normalizeVersionNumber(versionNumber);
  const model = loadProcessModel(rootDir, normalizedModelKey);
  if (!model) {
    throw createCatalogError(404, `Model '${normalizedModelKey}' was not found.`);
  }

  const version = model.versions.find((entry) => entry.versionNumber === normalizedVersion);
  if (!version) {
    throw createCatalogError(
      404,
      `Version ${normalizedVersion} was not found for model '${normalizedModelKey}'.`,
    );
  }

  return {
    normalizedModelKey,
    normalizedVersion,
    model,
    version,
  };
}

function buildTraversalPreview(contract) {
  const activities = Array.isArray(contract?.activities) ? contract.activities : [];
  const activitiesById = new Map();
  for (const activity of activities) {
    activitiesById.set(activity.activityId, activity);
  }
  const activityIds = activities.map((entry) => entry.activityId);
  const outgoingByActivity =
    contract?.flow && typeof contract.flow === "object" && contract.flow.outgoingByActivity
      ? contract.flow.outgoingByActivity
      : {};
  const startActivities = Array.isArray(contract?.start?.startActivities)
    ? contract.start.startActivities.filter((entry) => activitiesById.has(entry))
    : [];

  const queue = [];
  const queued = new Set();
  for (const activityId of startActivities) {
    queue.push(activityId);
    queued.add(activityId);
  }

  if (queue.length === 0 && activityIds.length > 0) {
    queue.push(activityIds[0]);
    queued.add(activityIds[0]);
  }

  const visited = new Set();
  const visitOrder = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    visitOrder.push(current);

    const outgoing = Array.isArray(outgoingByActivity[current]) ? outgoingByActivity[current] : [];
    const sortedOutgoing = outgoing.slice().sort((left, right) => String(left).localeCompare(String(right)));
    for (const next of sortedOutgoing) {
      if (!visited.has(next) && !queued.has(next) && activitiesById.has(next)) {
        queue.push(next);
        queued.add(next);
      }
    }
  }

  const reachableActivityIds = visitOrder.slice();
  const unreachableActivityIds = activityIds.filter((entry) => !visited.has(entry));
  const timeline = [];
  let cursor = 1;
  timeline.push({
    step: cursor,
    marker: "INSTANCE_STARTED",
  });
  cursor += 1;

  for (const activityId of reachableActivityIds) {
    const activity = activitiesById.get(activityId) || {};
    timeline.push({
      step: cursor,
      marker: "ACTIVITY_SIMULATED",
      activityId,
      activityType: activity.activityType || "MANUAL",
      assignmentStrategy: activity.assignment?.strategy || "ROLE_QUEUE",
    });
    cursor += 1;
  }

  timeline.push({
    step: cursor,
    marker: "INSTANCE_COMPLETED",
  });

  return {
    entryActivities: startActivities,
    reachableActivityIds,
    unreachableActivityIds,
    timeline,
  };
}

function simulateProcessModelVersion({
  rootDir,
  modelKey,
  versionNumber,
  options = {},
}) {
  const strictWarnings = normalizeBoolean(options.strictWarnings, false);
  const maxTimelineSteps = normalizePositiveNumber(options.maxTimelineSteps, 80);
  const {
    normalizedModelKey,
    normalizedVersion,
    model,
    version,
  } = requireModelAndVersion(rootDir, modelKey, versionNumber);
  const automaticTaskCatalog = readAutomaticTaskCatalog(rootDir, { includeSources: false });

  const validation = validateProcessSpecificationV1(version.specification, {
    bpmnXml: version.bpmnXml,
    strict: true,
    automaticTaskTypesByKey: buildAutomaticTaskTypeLookup(automaticTaskCatalog),
  });

  const runtimeContract = buildRuntimeContract({
    model,
    version,
  });
  const dataContract = buildDataContract({
    model,
    version,
    runtimeContract,
  });
  const traversal = buildTraversalPreview(runtimeContract);
  const warnings = Array.isArray(validation.warnings)
    ? validation.warnings.map((entry) => ({
      source: "specification",
      path: entry.path,
      message: entry.message,
    }))
    : [];
  const errors = Array.isArray(validation.errors)
    ? validation.errors.map((entry) => ({
      source: "specification",
      path: entry.path,
      message: entry.message,
    }))
    : [];

  if (runtimeContract.summary.activityCount > 0 && traversal.entryActivities.length === 0) {
    warnings.push({
      source: "runtime",
      path: "start.startActivities",
      message: "No start activity could be inferred from BPMN transitions.",
    });
  }

  if (traversal.unreachableActivityIds.length > 0) {
    warnings.push({
      source: "runtime",
      path: "flow.transitions",
      message: `Unreachable activities detected (${traversal.unreachableActivityIds.join(", ")}).`,
    });
  }

  let outcome = "PASS";
  if (errors.length > 0) {
    outcome = "FAIL";
  } else if (strictWarnings && warnings.length > 0) {
    outcome = "FAIL";
  } else if (warnings.length > 0) {
    outcome = "WARN";
  }

  return {
    simulationId: toSimulationId(),
    simulatedAt: new Date().toISOString(),
    modelKey: normalizedModelKey,
    versionNumber: normalizedVersion,
    status: version.status,
    strictWarnings,
    outcome,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
    runtimeSummary: runtimeContract.summary,
    dataSummary: dataContract.summary,
    preview: {
      entryActivities: traversal.entryActivities,
      reachableActivityIds: traversal.reachableActivityIds,
      unreachableActivityIds: traversal.unreachableActivityIds,
      timeline: traversal.timeline.slice(0, maxTimelineSteps),
      timelineTruncated: traversal.timeline.length > maxTimelineSteps,
    },
  };
}

function resolveNpmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function resolveQualityCommands(options = {}) {
  const profile = normalizeString(options.commandProfile || "verify-only").toLowerCase();

  if (profile === "expanded") {
    return [
      {
        id: "compile",
        label: "Compile generated application",
        command: resolveNpmExecutable(),
        args: ["run", "compile"],
      },
      {
        id: "test",
        label: "Run generated application tests",
        command: resolveNpmExecutable(),
        args: ["test"],
      },
      {
        id: "verify",
        label: "Run generated workspace verification pipeline",
        command: resolveNpmExecutable(),
        args: ["run", "verify"],
      },
    ];
  }

  return [
    {
      id: "verify",
      label: "Run generated workspace verification pipeline",
      command: resolveNpmExecutable(),
      args: ["run", "verify"],
    },
  ];
}

function runQualityCommand(rootDir, commandDefinition, timeoutMs) {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const command = normalizeString(commandDefinition.command);
  const args = Array.isArray(commandDefinition.args)
    ? commandDefinition.args.map((entry) => String(entry))
    : [];

  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    timeout: timeoutMs,
  });

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAtMs;
  const stdout = truncateOutput(result.stdout || "");
  const stderr = truncateOutput(result.stderr || "");

  if (result.error) {
    return {
      id: commandDefinition.id,
      label: commandDefinition.label,
      command,
      args,
      passed: false,
      startedAt,
      finishedAt,
      durationMs,
      exitCode: Number.isInteger(result.status) ? result.status : null,
      stdout,
      stderr,
      errorCode: result.error.code || "COMMAND_ERROR",
      errorMessage: result.error.message || "Unknown command execution error.",
    };
  }

  const passed = result.status === 0;
  return {
    id: commandDefinition.id,
    label: commandDefinition.label,
    command,
    args,
    passed,
    startedAt,
    finishedAt,
    durationMs,
    exitCode: Number.isInteger(result.status) ? result.status : null,
    stdout,
    stderr,
  };
}

function computeCounterMetrics(counter) {
  if (!counter) {
    return null;
  }

  const missed = Number(counter.missed);
  const covered = Number(counter.covered);
  if (!Number.isFinite(missed) || !Number.isFinite(covered)) {
    return null;
  }

  const total = missed + covered;
  const pct = total > 0 ? (covered * 100) / total : 0;

  return {
    covered,
    missed,
    total,
    pct: Number(pct.toFixed(2)),
  };
}

function extractJacocoCounter(xml, type) {
  const pattern = new RegExp(`<counter\\s+type="${type}"\\s+missed="(\\d+)"\\s+covered="(\\d+)"\\s*/>`, "g");
  let match = pattern.exec(xml);
  let last = null;
  while (match) {
    last = {
      missed: Number.parseInt(match[1], 10),
      covered: Number.parseInt(match[2], 10),
    };
    match = pattern.exec(xml);
  }

  return last;
}

function readBackendCoverage(projectRoot) {
  const jacocoPath = path.join(
    projectRoot,
    "src",
    "backend",
    "springboot",
    "target",
    "site",
    "jacoco-aggregate",
    "jacoco.xml",
  );

  if (!fs.existsSync(jacocoPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(jacocoPath, "utf8");
    const lineMetrics = computeCounterMetrics(extractJacocoCounter(raw, "LINE"));
    const branchMetrics = computeCounterMetrics(extractJacocoCounter(raw, "BRANCH"));

    return {
      source: "jacoco-aggregate",
      reportPath: toPosixPath(path.relative(projectRoot, jacocoPath)),
      line: lineMetrics,
      branch: branchMetrics,
    };
  } catch (_) {
    return null;
  }
}

function readFrontendCoverage(projectRoot) {
  const coverageSummaryPath = path.join(
    projectRoot,
    "src",
    "frontend",
    "web",
    "react",
    "coverage",
    "coverage-summary.json",
  );
  if (!fs.existsSync(coverageSummaryPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));
    const total = parsed && typeof parsed.total === "object" ? parsed.total : {};
    const lines = total && typeof total.lines === "object" ? total.lines : null;
    const branches = total && typeof total.branches === "object" ? total.branches : null;

    const toMetrics = (entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const covered = Number(entry.covered);
      const totalValue = Number(entry.total);
      if (!Number.isFinite(covered) || !Number.isFinite(totalValue)) {
        return null;
      }
      const missed = Math.max(totalValue - covered, 0);
      const pct = Number.isFinite(Number(entry.pct))
        ? Number(entry.pct)
        : (totalValue > 0 ? (covered * 100) / totalValue : 0);
      return {
        covered,
        missed,
        total: totalValue,
        pct: Number(pct.toFixed(2)),
      };
    };

    return {
      source: "vitest-coverage-summary",
      reportPath: toPosixPath(path.relative(projectRoot, coverageSummaryPath)),
      line: toMetrics(lines),
      branch: toMetrics(branches),
    };
  } catch (_) {
    return null;
  }
}

function computeOverallLineCoverage(backendCoverage, frontendCoverage) {
  const sources = [backendCoverage?.line, frontendCoverage?.line].filter((entry) => entry);
  if (sources.length === 0) {
    return null;
  }

  const covered = sources.reduce((sum, entry) => sum + entry.covered, 0);
  const total = sources.reduce((sum, entry) => sum + entry.total, 0);
  const missed = Math.max(total - covered, 0);
  const pct = total > 0 ? (covered * 100) / total : 0;

  return {
    covered,
    missed,
    total,
    pct: Number(pct.toFixed(2)),
  };
}

function evaluateCoverageGates(coverage, options = {}) {
  const requireCoverageReports = normalizeBoolean(options.requireCoverageReports, false);
  const thresholds = {
    backendLinePct: normalizePositiveNumber(options.backendLinePct, 60),
    frontendLinePct: normalizePositiveNumber(options.frontendLinePct, null),
    overallLinePct: normalizePositiveNumber(options.overallLinePct, 60),
  };

  const failures = [];
  const warnings = [];

  if (requireCoverageReports && !coverage.backend && !coverage.frontend) {
    failures.push("No coverage reports were found after quality-gate execution.");
  }

  if (thresholds.backendLinePct != null) {
    if (!coverage.backend?.line) {
      failures.push("Backend line coverage report is missing while backend threshold is configured.");
    } else if (coverage.backend.line.pct < thresholds.backendLinePct) {
      failures.push(
        `Backend line coverage ${coverage.backend.line.pct}% is below threshold ${thresholds.backendLinePct}%.`,
      );
    }
  }

  if (thresholds.frontendLinePct != null) {
    if (!coverage.frontend?.line) {
      failures.push("Frontend line coverage report is missing while frontend threshold is configured.");
    } else if (coverage.frontend.line.pct < thresholds.frontendLinePct) {
      failures.push(
        `Frontend line coverage ${coverage.frontend.line.pct}% is below threshold ${thresholds.frontendLinePct}%.`,
      );
    }
  } else if (!coverage.frontend?.line) {
    warnings.push("Frontend line coverage threshold is disabled because no coverage summary was found.");
  }

  if (thresholds.overallLinePct != null) {
    if (!coverage.overall?.line) {
      failures.push("Overall line coverage could not be computed.");
    } else if (coverage.overall.line.pct < thresholds.overallLinePct) {
      failures.push(
        `Overall line coverage ${coverage.overall.line.pct}% is below threshold ${thresholds.overallLinePct}%.`,
      );
    }
  }

  return {
    passed: failures.length === 0,
    thresholds,
    failures,
    warnings,
    requireCoverageReports,
  };
}

function runQualityGates({
  rootDir,
  workspaceConfig,
  options = {},
}) {
  const projectRoot = resolveGeneratedProjectRoot(rootDir, workspaceConfig);
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const timeoutMs = normalizePositiveNumber(options.commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS);
  const commandDefinitions = resolveQualityCommands(options);
  const commandResults = [];
  let commandsPassed = true;

  for (const definition of commandDefinitions) {
    const result = runQualityCommand(rootDir, definition, timeoutMs);
    commandResults.push(result);
    if (!result.passed) {
      commandsPassed = false;
      break;
    }
  }

  const backendCoverage = readBackendCoverage(projectRoot);
  const frontendCoverage = readFrontendCoverage(projectRoot);
  const overallCoverage = {
    line: computeOverallLineCoverage(backendCoverage, frontendCoverage),
  };
  const coverage = {
    backend: backendCoverage,
    frontend: frontendCoverage,
    overall: overallCoverage,
  };
  const coverageGates = evaluateCoverageGates(
    coverage,
    options.coverageThresholds,
  );

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAtMs;

  return {
    startedAt,
    finishedAt,
    durationMs,
    commandProfile: normalizeString(options.commandProfile || "verify-only").toLowerCase(),
    commands: commandResults,
    coverage,
    coverageGates,
    passed: commandsPassed && coverageGates.passed,
  };
}

function resolveRollbackPlan(previousDeployedVersionNumber, targetVersionNumber) {
  if (previousDeployedVersionNumber == null) {
    return {
      strategy: "UNDEPLOY_CURRENT_VERSION",
      targetVersionNumber: null,
      description: "No previously deployed version existed; rollback will undeploy current version.",
    };
  }

  if (Number(previousDeployedVersionNumber) === Number(targetVersionNumber)) {
    return {
      strategy: "NO_OP",
      targetVersionNumber: Number(targetVersionNumber),
      description: "Target version was already deployed before promotion.",
    };
  }

  return {
    strategy: "REDEPLOY_PREVIOUS_VERSION",
    targetVersionNumber: Number(previousDeployedVersionNumber),
    description: `Rollback will redeploy previous version ${previousDeployedVersionNumber}.`,
  };
}

function runProcessPromotionPipeline({
  rootDir,
  workspaceConfig,
  modelKey,
  versionNumber,
  options = {},
}) {
  const promotionId = toPromotionId();
  const requestedAt = new Date().toISOString();
  const runSimulation = normalizeBoolean(options.runSimulation, true);
  const runQualityGateChecks = normalizeBoolean(options.runQualityGates, true);
  const deployOnPass = normalizeBoolean(options.deployOnPass, true);
  const strictWarnings = normalizeBoolean(options.strictWarnings, false);

  const {
    normalizedModelKey,
    normalizedVersion,
    model,
  } = requireModelAndVersion(rootDir, modelKey, versionNumber);
  const previousDeployedVersion = model.versions.find((entry) => entry.status === "DEPLOYED") || null;

  let simulation = null;
  let qualityGates = null;
  let deployment = null;
  const blockedReasons = [];

  if (runSimulation) {
    simulation = simulateProcessModelVersion({
      rootDir,
      modelKey: normalizedModelKey,
      versionNumber: normalizedVersion,
      options: {
        strictWarnings,
        maxTimelineSteps: options.maxTimelineSteps,
      },
    });

    if (simulation.outcome === "FAIL") {
      blockedReasons.push("Simulation failed.");
    }
  }

  if (runQualityGateChecks) {
    qualityGates = runQualityGates({
      rootDir,
      workspaceConfig,
      options: {
        commandProfile: options.commandProfile,
        commandTimeoutMs: options.commandTimeoutMs,
        coverageThresholds: options.coverageThresholds,
      },
    });

    if (!qualityGates.passed) {
      blockedReasons.push("Quality gates failed.");
    }
  }

  let status = "READY";
  let message = "Promotion pipeline passed.";
  if (blockedReasons.length > 0) {
    status = "BLOCKED";
    message = "Promotion pipeline blocked by simulation or quality gates.";
  } else if (deployOnPass) {
    const deploymentResult = deployProcessModelVersion({
      rootDir,
      workspaceConfig,
      modelKey: normalizedModelKey,
      versionNumber: normalizedVersion,
    });
    deployment = deploymentResult.deployment;
    status = "PROMOTED";
    message = "Promotion pipeline passed and deployment completed.";
  } else {
    status = "READY_FOR_DEPLOYMENT";
    message = "Promotion pipeline passed. Deployment was skipped by request.";
  }

  const rollbackPlan = resolveRollbackPlan(
    previousDeployedVersion?.versionNumber ?? null,
    normalizedVersion,
  );
  const completedAt = new Date().toISOString();

  const record = {
    schemaVersion: 1,
    promotionId,
    modelKey: normalizedModelKey,
    versionNumber: normalizedVersion,
    requestedAt,
    completedAt,
    status,
    message,
    options: {
      runSimulation,
      runQualityGates: runQualityGateChecks,
      deployOnPass,
      strictWarnings,
      commandProfile: normalizeString(options.commandProfile || "verify-only").toLowerCase(),
      commandTimeoutMs: normalizePositiveNumber(options.commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS),
      coverageThresholds: {
        backendLinePct: normalizePositiveNumber(options?.coverageThresholds?.backendLinePct, 60),
        frontendLinePct: normalizePositiveNumber(options?.coverageThresholds?.frontendLinePct, null),
        overallLinePct: normalizePositiveNumber(options?.coverageThresholds?.overallLinePct, 60),
        requireCoverageReports: normalizeBoolean(options?.coverageThresholds?.requireCoverageReports, false),
      },
    },
    blockedReasons,
    simulation,
    qualityGates,
    deployment,
    rollbackPlan,
    rollback: null,
  };

  writePromotionRecord(rootDir, normalizedModelKey, promotionId, record);

  const refreshedModel = loadProcessModel(rootDir, normalizedModelKey);
  const refreshedVersion = refreshedModel
    ? refreshedModel.versions.find((entry) => entry.versionNumber === normalizedVersion)
    : null;

  return {
    message,
    status,
    model: refreshedModel ? toPublicModel(refreshedModel) : null,
    version: refreshedVersion ? toPublicVersion(refreshedVersion, { includeBpmn: true }) : null,
    promotion: record,
  };
}

function rollbackProcessPromotion({
  rootDir,
  workspaceConfig,
  modelKey,
  versionNumber,
  options = {},
}) {
  const force = normalizeBoolean(options.force, false);
  const normalizedModelKey = normalizeModelKey(modelKey);
  const normalizedVersion = normalizeVersionNumber(versionNumber);

  let record = null;
  const requestedPromotionId = normalizeString(options.promotionId);
  if (requestedPromotionId) {
    record = readPromotionRecord(rootDir, normalizedModelKey, requestedPromotionId);
    if (!record) {
      throw createCatalogError(
        404,
        `Promotion '${requestedPromotionId}' was not found for model '${normalizedModelKey}'.`,
      );
    }
  } else {
    const records = listPromotionRecords(rootDir, normalizedModelKey);
    record = findLatestRollbackCandidate(records, normalizedVersion);
    if (!record) {
      throw createCatalogError(
        404,
        `No promotion rollback candidate was found for model '${normalizedModelKey}' version ${normalizedVersion}.`,
      );
    }
  }

  if (record.status !== "PROMOTED") {
    throw createCatalogError(
      409,
      `Promotion '${record.promotionId}' is not in PROMOTED state and cannot be rolled back.`,
    );
  }

  if (record.rollback?.completedAt) {
    throw createCatalogError(409, `Promotion '${record.promotionId}' is already rolled back.`);
  }

  const rollbackPlan = record.rollbackPlan || {};
  const current = requireModelAndVersion(rootDir, normalizedModelKey, record.versionNumber);
  const currentDeployedVersion = current.model.versions.find((entry) => entry.status === "DEPLOYED") || null;
  if (
    rollbackPlan.strategy !== "NO_OP"
    && !force
    && Number(currentDeployedVersion?.versionNumber) !== Number(record.versionNumber)
  ) {
    throw createCatalogError(
      409,
      "Current deployed version does not match promotion target. Use force=true to rollback anyway.",
    );
  }

  const rollbackStartedAt = new Date().toISOString();
  let rollbackResult = null;

  if (rollbackPlan.strategy === "REDEPLOY_PREVIOUS_VERSION") {
    const targetModel = loadProcessModel(rootDir, normalizedModelKey);
    const targetVersion = targetModel?.versions?.find(
      (entry) => entry.versionNumber === rollbackPlan.targetVersionNumber,
    );

    if (targetVersion?.status === "RETIRED") {
      transitionProcessModelVersion(
        rootDir,
        normalizedModelKey,
        rollbackPlan.targetVersionNumber,
        "VALIDATED",
      );
    }

    rollbackResult = deployProcessModelVersion({
      rootDir,
      workspaceConfig,
      modelKey: normalizedModelKey,
      versionNumber: rollbackPlan.targetVersionNumber,
    });
  } else if (rollbackPlan.strategy === "UNDEPLOY_CURRENT_VERSION") {
    rollbackResult = undeployProcessModelVersion({
      rootDir,
      workspaceConfig,
      modelKey: normalizedModelKey,
      versionNumber: record.versionNumber,
    });
  } else {
    rollbackResult = {
      noOp: true,
      message: "Rollback plan resolved to no-op.",
    };
  }

  const rollbackCompletedAt = new Date().toISOString();
  record = {
    ...record,
    rollback: {
      requestedAt: rollbackStartedAt,
      completedAt: rollbackCompletedAt,
      force,
      strategy: rollbackPlan.strategy || "NO_OP",
      targetVersionNumber: rollbackPlan.targetVersionNumber ?? null,
      result: rollbackResult,
    },
  };
  writePromotionRecord(rootDir, normalizedModelKey, record.promotionId, record);

  const refreshedModel = loadProcessModel(rootDir, normalizedModelKey);
  const refreshedVersion = refreshedModel
    ? refreshedModel.versions.find((entry) => entry.versionNumber === normalizedVersion)
    : null;

  return {
    message: "Promotion rollback completed.",
    status: "ROLLED_BACK",
    model: refreshedModel ? toPublicModel(refreshedModel) : null,
    version: refreshedVersion ? toPublicVersion(refreshedVersion, { includeBpmn: true }) : null,
    promotion: record,
    rollback: record.rollback,
  };
}

module.exports = {
  simulateProcessModelVersion,
  runProcessPromotionPipeline,
  rollbackProcessPromotion,
};
