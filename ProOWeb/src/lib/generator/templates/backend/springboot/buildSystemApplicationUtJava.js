function buildSystemApplicationUtJava() {
  return `package com.prooweb.generated.tests.unit;

import com.prooweb.generated.system.domain.model.SystemMetadata;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SystemApplicationUT {
  @Test
  void shouldKeepSystemMetadataValues() {
    SystemMetadata metadata = new SystemMetadata("ProOWeb", "springboot", "postgresql", true, List.of("dev", "demo"));

    assertThat(metadata.siteTitle()).isEqualTo("ProOWeb");
    assertThat(metadata.swaggerProfiles()).containsExactly("dev", "demo");
  }
}
`;
}

module.exports = {
  buildSystemApplicationUtJava,
};
