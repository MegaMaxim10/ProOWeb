const path = require("node:path");

function resolveProjectRoot(rootDir, generatedRoot) {
  const normalized = String(generatedRoot || "").trim() || "root";
  return normalized === "root" ? path.resolve(rootDir) : path.join(rootDir, normalized);
}

module.exports = {
  resolveProjectRoot,
};
