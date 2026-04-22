function buildKernelInfrastructureMarkerJava() {
  return `package com.prooweb.generated.kernel.infrastructure;

public final class KernelInfrastructureMarker {
  private KernelInfrastructureMarker() {
  }
}
`;
}

module.exports = {
  buildKernelInfrastructureMarkerJava,
};
