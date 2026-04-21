function buildFrontendSystemSnapshotModelJs(defaultTitle) {
  const serializedTitle = JSON.stringify(defaultTitle);

  return `export const DEFAULT_SITE_TITLE = ${serializedTitle};

export function createSystemSnapshot() {
  return {
    meta: {
      siteTitle: DEFAULT_SITE_TITLE,
      backend: "springboot",
      database: "postgresql",
      swaggerEnabled: false,
      swaggerProfiles: [],
    },
    health: {
      status: "unknown",
    },
  };
}
`;
}

module.exports = {
  buildFrontendSystemSnapshotModelJs,
};
