function buildLiquibaseBaselineItJava() {
  return `package com.prooweb.generated.tests.system;

import com.prooweb.generated.app.ProowebApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
  classes = ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=jdbc:h2:mem:prooweb-liquibase-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.liquibase.enabled=true",
    "spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.yaml",
    "spring.jpa.hibernate.ddl-auto=validate",
    "app.identity.bootstrap.enabled=false"
  }
)
@AutoConfigureMockMvc
class LiquibaseBaselineIT {
  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private MockMvc mockMvc;

  @Test
  void shouldApplyLiquibaseBaselineAndKeepBackendHealthy() throws Exception {
    Integer roleCount = jdbcTemplate.queryForObject("select count(*) from identity_roles", Integer.class);
    Integer userCount = jdbcTemplate.queryForObject("select count(*) from identity_users", Integer.class);

    assertThat(roleCount).isNotNull();
    assertThat(userCount).isNotNull();

    mockMvc.perform(get("/api/system-health"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("UP"));
  }
}
`;
}

module.exports = {
  buildLiquibaseBaselineItJava,
};

