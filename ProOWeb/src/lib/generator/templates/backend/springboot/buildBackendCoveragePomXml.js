const { escapeXml } = require("../../_shared/escape");

function buildBackendCoveragePomXml(projectSlug) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>com.prooweb.generated</groupId>
    <artifactId>tests</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <relativePath>../pom.xml</relativePath>
  </parent>

  <artifactId>coverage</artifactId>
  <packaging>pom</packaging>

  <dependencies>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>gateway</artifactId>
      <version>\${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>${escapeXml(projectSlug)}-application</artifactId>
      <version>\${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>system-application-ut</artifactId>
      <version>\${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.prooweb.generated</groupId>
      <artifactId>system-infrastructure-it</artifactId>
      <version>\${project.version}</version>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.jacoco</groupId>
        <artifactId>jacoco-maven-plugin</artifactId>
        <version>\${jacoco.version}</version>
        <executions>
          <execution>
            <id>report-aggregate</id>
            <phase>verify</phase>
            <goals>
              <goal>report-aggregate</goal>
            </goals>
            <configuration>
              <outputDirectory>\${maven.multiModuleProjectDirectory}/target/site/jacoco-aggregate</outputDirectory>
              <dataFileIncludes>
                <dataFileInclude>**/target/jacoco.exec</dataFileInclude>
              </dataFileIncludes>
              <formats>
                <format>HTML</format>
                <format>XML</format>
                <format>CSV</format>
              </formats>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
`;
}

module.exports = {
  buildBackendCoveragePomXml,
};
