function buildHexAppPropertiesSystemMetadataAdapterJava() {
  return `package com.prooweb.generated.system.infrastructure.adapter.out.config;

import com.prooweb.generated.system.domain.model.SystemMetadata;
import com.prooweb.generated.system.domain.port.out.LoadSystemMetadataPort;
import java.util.Arrays;
import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class AppPropertiesSystemMetadataAdapter implements LoadSystemMetadataPort {
  private final Environment environment;

  public AppPropertiesSystemMetadataAdapter(Environment environment) {
    this.environment = environment;
  }

  @Override
  public SystemMetadata load() {
    String siteTitle = environment.getProperty("app.site-title", "ProOWeb Generated App");
    String backend = environment.getProperty("app.stack.backend", "springboot");
    String database = environment.getProperty("app.stack.database", "postgresql");
    boolean swaggerEnabled = Boolean.parseBoolean(environment.getProperty("app.backend.swagger-ui.enabled", "false"));
    String rawProfiles = environment.getProperty("app.backend.swagger-ui.profiles", "");

    List<String> swaggerProfiles = Arrays
      .stream(rawProfiles.split(","))
      .map(String::trim)
      .filter(value -> !value.isEmpty())
      .toList();

    return new SystemMetadata(siteTitle, backend, database, swaggerEnabled, swaggerProfiles);
  }
}
`;
}

module.exports = {
  buildHexAppPropertiesSystemMetadataAdapterJava,
};
