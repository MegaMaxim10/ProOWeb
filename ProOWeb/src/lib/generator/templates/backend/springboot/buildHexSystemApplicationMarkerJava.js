function buildHexSystemApplicationMarkerJava() {
  return `package com.prooweb.generated.system.application;

public final class SystemApplicationMarker {
  private SystemApplicationMarker() {
  }
}
`;
}

module.exports = {
  buildHexSystemApplicationMarkerJava,
};
