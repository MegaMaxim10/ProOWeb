function buildFrontendAssignIdentityRolePortJs() {
  return `export function ensureAssignIdentityRolePort(port) {
  if (typeof port !== "function") {
    throw new Error("AssignIdentityRolePort must be a function");
  }
  return port;
}
`;
}

module.exports = {
  buildFrontendAssignIdentityRolePortJs,
};
