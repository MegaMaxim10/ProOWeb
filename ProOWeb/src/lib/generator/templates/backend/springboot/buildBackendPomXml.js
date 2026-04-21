const { escapeXml } = require("../../_shared/escape");

function buildBackendPomXml(projectTitle, projectSlug, swaggerEnabled) {
  const swaggerDependency = swaggerEnabled
    ? `\n    <dependency>\n      <groupId>org.springdoc</groupId>\n      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>\n      <version>2.6.0</version>\n    </dependency>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
  </parent>

  <groupId>com.prooweb.generated</groupId>
  <artifactId>${escapeXml(projectSlug)}-backend</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>${escapeXml(projectTitle)} Backend</name>
  <description>Generated backend for ${escapeXml(projectTitle)}</description>

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
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
      </plugin>
    </plugins>
  </build>
</project>
`;
}

module.exports = {
  buildBackendPomXml,
};
