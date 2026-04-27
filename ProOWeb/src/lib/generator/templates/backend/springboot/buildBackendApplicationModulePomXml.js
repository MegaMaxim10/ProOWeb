const { escapeXml } = require("../../_shared/escape");

function buildBackendApplicationModulePomXml(projectSlug, swaggerEnabled, options = {}) {
  const swaggerDependency = swaggerEnabled
    ? `
    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>\${springdoc.version}</version>
    </dependency>`
    : "";
  const identityInfrastructureDependency = options.identityEnabled
    ? `
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>identity-infrastructure</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>`
    : "";
  const organizationInfrastructureDependency = options.organizationEnabled
    ? `
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>organization-infrastructure</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>com.prooweb.generated</groupId>
    <artifactId>${escapeXml(projectSlug)}-platform</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <relativePath>../pom.xml</relativePath>
  </parent>

  <artifactId>${escapeXml(projectSlug)}-application</artifactId>

  <dependencies>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>gateway</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>kernel-infrastructure</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>common-infrastructure</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>system-infrastructure</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>${identityInfrastructureDependency}${organizationInfrastructureDependency}

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-mail</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>${swaggerDependency}

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <classifier>exec</classifier>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`;
}

module.exports = {
  buildBackendApplicationModulePomXml,
};
