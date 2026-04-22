function buildKernelDomainMarkerJava() {
  return `package com.prooweb.generated.kernel.domain;

public final class KernelDomainMarker {
  private KernelDomainMarker() {
  }
}
`;
}

module.exports = {
  buildKernelDomainMarkerJava,
};
