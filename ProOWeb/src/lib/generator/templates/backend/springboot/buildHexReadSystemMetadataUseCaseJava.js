function buildHexReadSystemMetadataUseCaseJava() {
  return `package com.prooweb.generated.system.application.port.in;

import com.prooweb.generated.system.domain.model.SystemMetadata;

public interface ReadSystemMetadataUseCase {
  SystemMetadata read();
}
`;
}

module.exports = {
  buildHexReadSystemMetadataUseCaseJava,
};
