function buildFrontendOrganizationUnitModelJs() {
  return `export function createOrganizationUnit(value = {}) {
  return {
    code: String(value.code || "").trim(),
    name: String(value.name || "").trim(),
    parentCode: String(value.parentCode || "").trim(),
    supervisorUsername: String(value.supervisorUsername || "").trim(),
    memberUsernames: Array.isArray(value.memberUsernames)
      ? value.memberUsernames.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [],
  };
}
`;
}

module.exports = {
  buildFrontendOrganizationUnitModelJs,
};

