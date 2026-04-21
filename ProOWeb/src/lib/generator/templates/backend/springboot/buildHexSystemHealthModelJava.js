function buildHexSystemHealthModelJava() {
  return `package com.prooweb.generated.system.domain.model;

public record SystemHealth(String status) {
}
`;
}

module.exports = {
  buildHexSystemHealthModelJava,
};
