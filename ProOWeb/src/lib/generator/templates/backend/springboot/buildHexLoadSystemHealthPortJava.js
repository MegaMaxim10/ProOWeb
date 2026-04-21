function buildHexLoadSystemHealthPortJava() {
  return `package com.prooweb.generated.system.domain.port.out;

import com.prooweb.generated.system.domain.model.SystemHealth;

public interface LoadSystemHealthPort {
  SystemHealth load();
}
`;
}

module.exports = {
  buildHexLoadSystemHealthPortJava,
};
