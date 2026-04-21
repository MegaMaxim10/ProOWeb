function buildHexSystemMetadataControllerJava() {
  return `package com.prooweb.generated.system.infrastructure.adapter.in.api;

import com.prooweb.generated.system.application.port.in.ReadSystemHealthUseCase;
import com.prooweb.generated.system.application.port.in.ReadSystemMetadataUseCase;
import com.prooweb.generated.system.domain.model.SystemMetadata;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SystemMetadataController {
  private final ReadSystemMetadataUseCase readSystemMetadataUseCase;
  private final ReadSystemHealthUseCase readSystemHealthUseCase;

  public SystemMetadataController(
    ReadSystemMetadataUseCase readSystemMetadataUseCase,
    ReadSystemHealthUseCase readSystemHealthUseCase
  ) {
    this.readSystemMetadataUseCase = readSystemMetadataUseCase;
    this.readSystemHealthUseCase = readSystemHealthUseCase;
  }

  @GetMapping("/meta")
  public Map<String, Object> readMeta() {
    SystemMetadata metadata = readSystemMetadataUseCase.read();

    return Map.of(
      "siteTitle", metadata.siteTitle(),
      "backend", metadata.backend(),
      "database", metadata.database(),
      "swaggerEnabled", metadata.swaggerEnabled(),
      "swaggerProfiles", metadata.swaggerProfiles()
    );
  }

  @GetMapping("/system-health")
  public Map<String, String> readSystemHealth() {
    return Map.of("status", readSystemHealthUseCase.read().status());
  }
}
`;
}

module.exports = {
  buildHexSystemMetadataControllerJava,
};
