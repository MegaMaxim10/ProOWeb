function buildFrontendTestSetupJs() {
  return `import "@testing-library/jest-dom/vitest";
`;
}

module.exports = {
  buildFrontendTestSetupJs,
};
