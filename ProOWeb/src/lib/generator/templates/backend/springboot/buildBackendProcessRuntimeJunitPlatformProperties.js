function buildBackendProcessRuntimeJunitPlatformProperties({ basePackage }) {
  return `cucumber.glue=${basePackage}.tests.system
cucumber.features=classpath:features
cucumber.plugin=pretty,summary,html:target/cucumber/cucumber.html,json:target/cucumber/cucumber.json,junit:target/cucumber/cucumber.xml
`;
}

module.exports = {
  buildBackendProcessRuntimeJunitPlatformProperties,
};
