function buildFrontendIdentityUserModelJs() {
  return `export function createIdentityUser(value = {}) {
  return {
    id: value.id ?? null,
    displayName: value.displayName || "",
    email: value.email || "",
    username: value.username || "",
    active: value.active !== false,
    roles: Array.isArray(value.roles) ? value.roles.filter(Boolean) : [],
    permissions: Array.isArray(value.permissions) ? value.permissions.filter(Boolean) : [],
  };
}
`;
}

module.exports = {
  buildFrontendIdentityUserModelJs,
};
