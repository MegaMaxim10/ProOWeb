function buildBackendProcessRuntimeCucumberSpringConfigurationJava({ basePackage }) {
  return `package ${basePackage}.tests.system;

import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

@CucumberContextConfiguration
@SpringBootTest(
  classes = ${basePackage}.app.ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=jdbc:h2:mem:prooweb-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
  }
)
@AutoConfigureMockMvc
public class ProcessRuntimeCucumberSpringConfiguration {
}
`;
}

module.exports = {
  buildBackendProcessRuntimeCucumberSpringConfigurationJava,
};
