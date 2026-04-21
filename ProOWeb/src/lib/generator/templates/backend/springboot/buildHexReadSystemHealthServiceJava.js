function buildHexReadSystemHealthServiceJava() {
  return `package com.prooweb.generated.system.application.service;

import com.prooweb.generated.system.application.port.in.ReadSystemHealthUseCase;
import com.prooweb.generated.system.domain.model.SystemHealth;
import com.prooweb.generated.system.domain.port.out.LoadSystemHealthPort;

public class ReadSystemHealthService implements ReadSystemHealthUseCase {
  private final LoadSystemHealthPort loadSystemHealthPort;

  public ReadSystemHealthService(LoadSystemHealthPort loadSystemHealthPort) {
    this.loadSystemHealthPort = loadSystemHealthPort;
  }

  @Override
  public SystemHealth read() {
    return loadSystemHealthPort.load();
  }
}
`;
}

module.exports = {
  buildHexReadSystemHealthServiceJava,
};
