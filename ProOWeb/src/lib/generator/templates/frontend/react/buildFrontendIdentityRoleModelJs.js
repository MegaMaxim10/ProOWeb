function buildFrontendIdentityRoleModelJs() {
  return `export function createIdentityRole(value = {}) {
  return {
    id: value.id ?? null,
    code: value.code || "",
    description: value.description || "",
    active: value.active !== false,
    permissions: Array.isArray(value.permissions) ? value.permissions.filter(Boolean) : [],
  };
}
`;
}

module.exports = {
  buildFrontendIdentityRoleModelJs,
};
