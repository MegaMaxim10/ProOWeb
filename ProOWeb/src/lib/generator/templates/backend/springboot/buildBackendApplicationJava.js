function buildBackendApplicationJava() {
  return `package com.prooweb.generated.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.prooweb.generated")
public class ProowebApplication {
  public static void main(String[] args) {
    SpringApplication.run(ProowebApplication.class, args);
  }
}
`;
}

module.exports = {
  buildBackendApplicationJava,
};
