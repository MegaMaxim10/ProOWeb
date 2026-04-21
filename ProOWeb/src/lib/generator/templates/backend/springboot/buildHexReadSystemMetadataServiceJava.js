function buildHexReadSystemMetadataServiceJava() {
  return `package com.prooweb.generated.system.application.service;

import com.prooweb.generated.system.application.port.in.ReadSystemMetadataUseCase;
import com.prooweb.generated.system.domain.model.SystemMetadata;
import com.prooweb.generated.system.domain.port.out.LoadSystemMetadataPort;

public class ReadSystemMetadataService implements ReadSystemMetadataUseCase {
  private final LoadSystemMetadataPort loadSystemMetadataPort;

  public ReadSystemMetadataService(LoadSystemMetadataPort loadSystemMetadataPort) {
    this.loadSystemMetadataPort = loadSystemMetadataPort;
  }

  @Override
  public SystemMetadata read() {
    return loadSystemMetadataPort.load();
  }
}
`;
}

module.exports = {
  buildHexReadSystemMetadataServiceJava,
};
