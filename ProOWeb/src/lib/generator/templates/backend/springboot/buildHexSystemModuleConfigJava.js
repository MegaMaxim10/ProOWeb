function buildHexSystemModuleConfigJava() {
  return `package com.prooweb.generated.system.infrastructure.config;

import com.prooweb.generated.system.application.port.in.ReadSystemHealthUseCase;
import com.prooweb.generated.system.application.port.in.ReadSystemMetadataUseCase;
import com.prooweb.generated.system.application.service.ReadSystemHealthService;
import com.prooweb.generated.system.application.service.ReadSystemMetadataService;
import com.prooweb.generated.system.domain.port.out.LoadSystemHealthPort;
import com.prooweb.generated.system.domain.port.out.LoadSystemMetadataPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SystemModuleConfig {
  @Bean
  ReadSystemMetadataUseCase readSystemMetadataUseCase(LoadSystemMetadataPort loadSystemMetadataPort) {
    return new ReadSystemMetadataService(loadSystemMetadataPort);
  }

  @Bean
  ReadSystemHealthUseCase readSystemHealthUseCase(LoadSystemHealthPort loadSystemHealthPort) {
    return new ReadSystemHealthService(loadSystemHealthPort);
  }
}
`;
}

module.exports = {
  buildHexSystemModuleConfigJava,
};
