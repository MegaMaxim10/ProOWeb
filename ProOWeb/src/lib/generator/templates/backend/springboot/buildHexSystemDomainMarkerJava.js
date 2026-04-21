function buildHexSystemDomainMarkerJava() {
  return `package com.prooweb.generated.system.domain;

public final class SystemDomainMarker {
  private SystemDomainMarker() {
  }
}
`;
}

module.exports = {
  buildHexSystemDomainMarkerJava,
};
