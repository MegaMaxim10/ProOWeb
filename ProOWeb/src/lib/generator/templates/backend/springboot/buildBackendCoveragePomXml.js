const { escapeXml } = require("../../_shared/escape");

function buildBackendCoveragePomXml(projectSlug, options = {}) {
  const cucumberAggregatePlugin = options.cucumberBddEnabled
    ? `
      <plugin>
        <groupId>net.masterthought</groupId>
        <artifactId>maven-cucumber-reporting</artifactId>
        <version>5.7.8</version>
        <executions>
          <execution>
            <id>cucumber-aggregate</id>
            <phase>verify</phase>
            <goals>
              <goal>generate</goal>
            </goals>
            <configuration>
              <projectName>ProOWeb Generated Platform</projectName>
              <outputDirectory>\${project.basedir}/../../target/site/cucumber-report</outputDirectory>
              <inputDirectory>\${project.basedir}/../..</inputDirectory>
              <jsonFiles>
                <param>**/target/cucumber/cucumber.json</param>
              </jsonFiles>
              <skip>\${skipTests}</skip>
            </configuration>
          </execution>
        </executions>
      </plugin>`
    : "";

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
      </plugin>${cucumberAggregatePlugin}
    </plugins>
  </build>
</project>
`;
}

module.exports = {
  buildBackendCoveragePomXml,
};
