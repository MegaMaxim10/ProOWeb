function buildHexStaticSystemHealthAdapterJava() {
  return `package com.prooweb.generated.system.infrastructure.adapter.out.health;

import com.prooweb.generated.system.domain.model.SystemHealth;
import com.prooweb.generated.system.domain.port.out.LoadSystemHealthPort;
import org.springframework.stereotype.Component;

@Component
public class StaticSystemHealthAdapter implements LoadSystemHealthPort {
  @Override
  public SystemHealth load() {
    return new SystemHealth("UP");
  }
}
`;
}

module.exports = {
  buildHexStaticSystemHealthAdapterJava,
};
