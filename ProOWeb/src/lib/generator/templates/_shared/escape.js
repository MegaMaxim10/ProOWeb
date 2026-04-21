function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeYamlDoubleQuotes(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

module.exports = {
  escapeXml,
  escapeYamlDoubleQuotes,
};
