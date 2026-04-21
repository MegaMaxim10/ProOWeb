function buildHexReadSystemHealthUseCaseJava() {
  return `package com.prooweb.generated.system.application.port.in;

import com.prooweb.generated.system.domain.model.SystemHealth;

public interface ReadSystemHealthUseCase {
  SystemHealth read();
}
`;
}

module.exports = {
  buildHexReadSystemHealthUseCaseJava,
};
