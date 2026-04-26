function buildBackendApplicationJava() {
  return `package com.prooweb.generated.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.prooweb.generated")
@EntityScan(basePackages = "com.prooweb.generated")
@EnableJpaRepositories(basePackages = "com.prooweb.generated")
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
