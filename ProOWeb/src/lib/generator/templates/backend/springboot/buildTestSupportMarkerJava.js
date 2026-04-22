function buildTestSupportMarkerJava() {
  return `package com.prooweb.generated.tests.support;

public final class TestSupportMarker {
  private TestSupportMarker() {
  }
}
`;
}

module.exports = {
  buildTestSupportMarkerJava,
};
