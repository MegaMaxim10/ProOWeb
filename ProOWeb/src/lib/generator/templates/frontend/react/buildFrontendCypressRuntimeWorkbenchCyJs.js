function buildFrontendCypressRuntimeWorkbenchCyJs() {
  return `describe("Generated runtime workbench", () => {
  it("renders the shell and process runtime settings panels", () => {
    cy.visit("/");
    cy.contains("Process Runtime Workbench");
    cy.contains("User settings");
    cy.contains("Credentials and MFA quick actions");
  });

  it("exposes runtime catalog section", () => {
    cy.visit("/");
    cy.contains("Runtime catalogs");
    cy.contains("Startable process entries:");
  });
});
`;
}

module.exports = {
  buildFrontendCypressRuntimeWorkbenchCyJs,
};
