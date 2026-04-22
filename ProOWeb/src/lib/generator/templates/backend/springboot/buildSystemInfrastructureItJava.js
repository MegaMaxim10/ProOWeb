function buildSystemInfrastructureItJava() {
  return `package com.prooweb.generated.tests.system;

import com.prooweb.generated.app.ProowebApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
  classes = ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
      + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration"
  }
)
@AutoConfigureMockMvc
class SystemInfrastructureIT {
  @Autowired
  private MockMvc mockMvc;

  @Test
  void shouldExposeSystemHealthAndMetadata() throws Exception {
    mockMvc.perform(get("/api/system-health"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("UP"));

    mockMvc.perform(get("/api/meta"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.siteTitle").isNotEmpty());
  }
}
`;
}

module.exports = {
  buildSystemInfrastructureItJava,
};
