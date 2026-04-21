function buildBackendTestJava() {
  return `package com.prooweb.generated;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ProowebApplicationTests {

  @Test
  void contextLoads() {
  }
}
`;
}

module.exports = {
  buildBackendTestJava,
};
