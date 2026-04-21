function buildHexLoadSystemMetadataPortJava() {
  return `package com.prooweb.generated.system.domain.port.out;

import com.prooweb.generated.system.domain.model.SystemMetadata;

public interface LoadSystemMetadataPort {
  SystemMetadata load();
}
`;
}

module.exports = {
  buildHexLoadSystemMetadataPortJava,
};
