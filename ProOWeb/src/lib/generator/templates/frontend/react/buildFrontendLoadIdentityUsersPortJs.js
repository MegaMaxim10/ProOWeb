function buildFrontendLoadIdentityUsersPortJs() {
  return `export function ensureLoadIdentityUsersPort(port) {
  if (typeof port !== "function") {
    throw new Error("LoadIdentityUsersPort must be a function");
  }
  return port;
}
`;
}

module.exports = {
  buildFrontendLoadIdentityUsersPortJs,
};
