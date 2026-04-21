function buildHexSystemMetadataModelJava() {
  return `package com.prooweb.generated.system.domain.model;

import java.util.List;

public record SystemMetadata(
  String siteTitle,
  String backend,
  String database,
  boolean swaggerEnabled,
  List<String> swaggerProfiles
) {
}
`;
}

module.exports = {
  buildHexSystemMetadataModelJava,
};
