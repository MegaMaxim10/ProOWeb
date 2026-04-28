function buildBackendProcessRuntimeFeatureFile() {
  return `Feature: Process runtime capabilities

  Scenario: System health endpoint is available
    When I request system health
    Then the HTTP response status is 200
    And the response contains field "status"

  Scenario: System metadata endpoint is available
    When I request system metadata
    Then the HTTP response status is 200
    And the response contains field "siteTitle"
`;
}

module.exports = {
  buildBackendProcessRuntimeFeatureFile,
};
