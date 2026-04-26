function buildFrontendLoadIdentityRolesPortJs() {
  return `export function ensureLoadIdentityRolesPort(port) {
  if (typeof port !== "function") {
    throw new Error("LoadIdentityRolesPort must be a function");
  }
  return port;
}
`;
}

module.exports = {
  buildFrontendLoadIdentityRolesPortJs,
};
