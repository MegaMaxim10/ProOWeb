function buildBackendProcessRuntimeCucumberItJava({ basePackage }) {
  return `package ${basePackage}.tests.system;

import io.cucumber.junit.platform.engine.Cucumber;

@Cucumber
public class CucumberIT {
}
`;
}

module.exports = {
  buildBackendProcessRuntimeCucumberItJava,
};
