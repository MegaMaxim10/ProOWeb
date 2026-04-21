function buildHexSystemInfrastructureMarkerJava() {
  return `package com.prooweb.generated.system.infrastructure;

public final class SystemInfrastructureMarker {
  private SystemInfrastructureMarker() {
  }
}
`;
}

module.exports = {
  buildHexSystemInfrastructureMarkerJava,
};
