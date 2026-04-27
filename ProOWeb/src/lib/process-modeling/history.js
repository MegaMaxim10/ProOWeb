const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { createCatalogError, normalizeModelKey } = require("./catalog");

const MAX_HISTORY_ENTRIES_DEFAULT = 120;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function hashXml(xml) {
  return crypto.createHash("sha256").update(String(xml || ""), "utf8").digest("hex");
}

function buildHistoryFilePath(rootDir, modelKey) {
  const normalizedKey = normalizeModelKey(modelKey);
  return path.join(rootDir, ".prooweb", "process-models", "history", `${normalizedKey}.json`);
}

function ensureHistoryDirectory(rootDir) {
  const targetDir = path.join(rootDir, ".prooweb", "process-models", "history");
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function createEmptyHistory(modelKey) {
  return {
    schemaVersion: 1,
    modelKey: normalizeModelKey(modelKey),
    pointer: -1,
    entries: [],
    updatedAt: null,
  };
}

function normalizeHistoryEntry(rawEntry = {}) {
  const bpmnXml = String(rawEntry.bpmnXml || "");
  if (!bpmnXml.trim()) {
    throw createCatalogError(400, "History snapshot BPMN XML cannot be empty.");
  }

  return {
    id: normalizeString(rawEntry.id) || `snapshot-${Date.now()}`,
    createdAt: rawEntry.createdAt || new Date().toISOString(),
    source: normalizeString(rawEntry.source) || "manual",
    summary: normalizeString(rawEntry.summary) || "Snapshot",
    versionNumber: rawEntry.versionNumber == null
      ? null
      : Number.parseInt(String(rawEntry.versionNumber), 10),
    sha256: normalizeString(rawEntry.sha256) || hashXml(bpmnXml),
    bpmnXml,
  };
}

function normalizeHistory(rawHistory = {}, modelKey) {
  const normalizedKey = normalizeModelKey(modelKey || rawHistory.modelKey);
  const entries = Array.isArray(rawHistory.entries)
    ? rawHistory.entries.map((entry) => normalizeHistoryEntry(entry))
    : [];
  const rawPointer = Number.parseInt(String(rawHistory.pointer || -1), 10);
  const boundedPointer = entries.length === 0
    ? -1
    : Math.min(Math.max(rawPointer, 0), entries.length - 1);

  return {
    schemaVersion: 1,
    modelKey: normalizedKey,
    pointer: boundedPointer,
    entries,
    updatedAt: rawHistory.updatedAt || null,
  };
}

function loadStudioHistory(rootDir, modelKey) {
  const normalizedKey = normalizeModelKey(modelKey);
  const historyFilePath = buildHistoryFilePath(rootDir, normalizedKey);
  if (!fs.existsSync(historyFilePath)) {
    return createEmptyHistory(normalizedKey);
  }

  const raw = fs.readFileSync(historyFilePath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeHistory(parsed, normalizedKey);
}

function saveStudioHistory(rootDir, history) {
  ensureHistoryDirectory(rootDir);
  const normalized = normalizeHistory(history, history.modelKey);
  normalized.updatedAt = new Date().toISOString();
  const historyFilePath = buildHistoryFilePath(rootDir, normalized.modelKey);
  fs.writeFileSync(historyFilePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function getCurrentSnapshot(history) {
  if (!history || history.pointer < 0 || !Array.isArray(history.entries)) {
    return null;
  }

  return history.entries[history.pointer] || null;
}

function toPublicSnapshot(entry, options = {}) {
  if (!entry) {
    return null;
  }

  const includeXml = Boolean(options.includeXml);
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    source: entry.source,
    summary: entry.summary,
    versionNumber: entry.versionNumber,
    sha256: entry.sha256,
    ...(includeXml ? { bpmnXml: entry.bpmnXml } : {}),
  };
}

function toPublicHistory(history, options = {}) {
  const includeEntriesXml = Boolean(options.includeEntriesXml);
  const includeCurrentXml = Boolean(options.includeCurrentXml);
  const currentSnapshot = getCurrentSnapshot(history);

  return {
    schemaVersion: 1,
    modelKey: history.modelKey,
    pointer: history.pointer,
    updatedAt: history.updatedAt,
    size: Array.isArray(history.entries) ? history.entries.length : 0,
    entries: (history.entries || []).map((entry) =>
      toPublicSnapshot(entry, { includeXml: includeEntriesXml })),
    currentSnapshot: toPublicSnapshot(currentSnapshot, { includeXml: includeCurrentXml }),
  };
}

function pushStudioSnapshot(rootDir, modelKey, payload = {}, options = {}) {
  const normalizedKey = normalizeModelKey(modelKey);
  const history = loadStudioHistory(rootDir, normalizedKey);
  const bpmnXml = String(payload.bpmnXml || "");
  if (!bpmnXml.trim()) {
    throw createCatalogError(400, "bpmnXml is required to create a history snapshot.");
  }

  const snapshotHash = hashXml(bpmnXml);
  const currentSnapshot = getCurrentSnapshot(history);
  if (currentSnapshot && currentSnapshot.sha256 === snapshotHash) {
    return {
      changed: false,
      history,
      snapshot: currentSnapshot,
    };
  }

  const maxEntries = normalizePositiveInteger(options.maxEntries, MAX_HISTORY_ENTRIES_DEFAULT);

  if (history.pointer < history.entries.length - 1) {
    history.entries = history.entries.slice(0, history.pointer + 1);
  }

  const createdAt = new Date().toISOString();
  const snapshot = normalizeHistoryEntry({
    id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    source: payload.source || "manual",
    summary: payload.summary || "Snapshot",
    versionNumber: payload.versionNumber,
    sha256: snapshotHash,
    bpmnXml,
  });

  history.entries.push(snapshot);
  history.pointer = history.entries.length - 1;

  if (history.entries.length > maxEntries) {
    const overflow = history.entries.length - maxEntries;
    history.entries = history.entries.slice(overflow);
    history.pointer = Math.max(history.pointer - overflow, 0);
  }

  const saved = saveStudioHistory(rootDir, history);
  return {
    changed: true,
    history: saved,
    snapshot: getCurrentSnapshot(saved),
  };
}

function undoStudioSnapshot(rootDir, modelKey) {
  const normalizedKey = normalizeModelKey(modelKey);
  const history = loadStudioHistory(rootDir, normalizedKey);
  if (history.entries.length === 0) {
    throw createCatalogError(404, `No history snapshot found for model '${normalizedKey}'.`);
  }

  if (history.pointer <= 0) {
    throw createCatalogError(409, `No undo step available for model '${normalizedKey}'.`);
  }

  history.pointer -= 1;
  const saved = saveStudioHistory(rootDir, history);
  return {
    history: saved,
    snapshot: getCurrentSnapshot(saved),
  };
}

function redoStudioSnapshot(rootDir, modelKey) {
  const normalizedKey = normalizeModelKey(modelKey);
  const history = loadStudioHistory(rootDir, normalizedKey);
  if (history.entries.length === 0) {
    throw createCatalogError(404, `No history snapshot found for model '${normalizedKey}'.`);
  }

  if (history.pointer >= history.entries.length - 1) {
    throw createCatalogError(409, `No redo step available for model '${normalizedKey}'.`);
  }

  history.pointer += 1;
  const saved = saveStudioHistory(rootDir, history);
  return {
    history: saved,
    snapshot: getCurrentSnapshot(saved),
  };
}

module.exports = {
  loadStudioHistory,
  saveStudioHistory,
  getCurrentSnapshot,
  toPublicHistory,
  toPublicSnapshot,
  pushStudioSnapshot,
  undoStudioSnapshot,
  redoStudioSnapshot,
};
