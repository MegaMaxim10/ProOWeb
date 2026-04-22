const { escapeXml } = require("../../_shared/escape");

function buildBackendGatewayPomXml(projectSlug) {
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

  <artifactId>gateway</artifactId>

  <dependencies>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>system-application</artifactId>
      <version>0.0.1-SNAPSHOT</version>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>io.swagger.core.v3</groupId>
      <artifactId>swagger-annotations-jakarta</artifactId>
      <version>2.2.22</version>
    </dependency>
  </dependencies>
</project>
`;
}

module.exports = {
  buildBackendGatewayPomXml,
};
