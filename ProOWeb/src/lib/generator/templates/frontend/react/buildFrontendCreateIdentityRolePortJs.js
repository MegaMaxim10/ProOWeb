function buildFrontendCreateIdentityRolePortJs() {
  return `export function ensureCreateIdentityRolePort(port) {
  if (typeof port !== "function") {
    throw new Error("CreateIdentityRolePort must be a function");
  }
  return port;
}
`;
}

module.exports = {
  buildFrontendCreateIdentityRolePortJs,
};
