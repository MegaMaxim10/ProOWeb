function buildKernelApplicationMarkerJava() {
  return `package com.prooweb.generated.kernel.application;

public final class KernelApplicationMarker {
  private KernelApplicationMarker() {
  }
}
`;
}

module.exports = {
  buildKernelApplicationMarkerJava,
};
