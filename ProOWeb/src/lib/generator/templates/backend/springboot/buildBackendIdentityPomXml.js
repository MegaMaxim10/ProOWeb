const { escapeXml } = require("../../_shared/escape");

function buildBackendIdentityPomXml(projectSlug) {
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

  <artifactId>identity</artifactId>
  <packaging>pom</packaging>

  <modules>
    <module>identity-domain</module>
    <module>identity-application</module>
    <module>identity-infrastructure</module>
  </modules>
</project>
`;
}

module.exports = {
  buildBackendIdentityPomXml,
};
