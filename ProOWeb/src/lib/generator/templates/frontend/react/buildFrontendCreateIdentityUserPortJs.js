function buildFrontendCreateIdentityUserPortJs() {
  return `export function ensureCreateIdentityUserPort(port) {
  if (typeof port !== "function") {
    throw new Error("CreateIdentityUserPort must be a function");
  }
  return port;
}
`;
}

module.exports = {
  buildFrontendCreateIdentityUserPortJs,
};
