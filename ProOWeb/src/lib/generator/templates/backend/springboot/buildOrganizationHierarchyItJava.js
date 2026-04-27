function buildOrganizationHierarchyItJava() {
  return `package com.prooweb.generated.tests.system;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prooweb.generated.app.ProowebApplication;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
  classes = ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=jdbc:h2:mem:prooweb-organization-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.organization.hierarchy.enabled=true",
    "app.organization.hierarchy.default-assignment-strategy=SUPERVISOR_THEN_ANCESTORS",
    "app.organization.hierarchy.max-traversal-depth=8"
  }
)
@AutoConfigureMockMvc
class OrganizationHierarchyIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldManageOrganizationUnitsAndResolveAssignments() throws Exception {
    MvcResult registerResult = mockMvc.perform(
      post("/api/auth/register")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "displayName": "Org Admin",
            "email": "org.admin@example.com",
            "username": "org.admin",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("REGISTERED"))
      .andReturn();

    JsonNode registerPayload = objectMapper.readTree(registerResult.getResponse().getContentAsString());
    String activationToken = registerPayload.path("activationToken").asText();

    mockMvc.perform(
      post("/api/auth/activate")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"activationToken\\": \\"" + activationToken + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("ACTIVATED"));

    mockMvc.perform(
      post("/api/admin/organization/units")
        .header("Authorization", basic("org.admin", "Password123!"))
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "code": "ROOT_UNIT",
            "name": "Root Unit"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.unit.code").value("ROOT_UNIT"));

    mockMvc.perform(
      post("/api/admin/organization/units")
        .header("Authorization", basic("org.admin", "Password123!"))
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "code": "FINANCE",
            "name": "Finance Department",
            "parentCode": "ROOT_UNIT"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.unit.parentCode").value("ROOT_UNIT"));

    mockMvc.perform(
      post("/api/admin/organization/units/ROOT_UNIT/supervisor/ceo")
        .header("Authorization", basic("org.admin", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.unit.supervisorUsername").value("ceo"));

    mockMvc.perform(
      post("/api/admin/organization/units/FINANCE/supervisor/finance.lead")
        .header("Authorization", basic("org.admin", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.unit.supervisorUsername").value("finance.lead"));

    mockMvc.perform(
      post("/api/admin/organization/units/FINANCE/members/analyst.one")
        .header("Authorization", basic("org.admin", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.unit.memberUsernames[0]").value("analyst.one"));

    mockMvc.perform(
      get("/api/admin/organization/assignment/resolve")
        .header("Authorization", basic("org.admin", "Password123!"))
        .queryParam("unitCode", "FINANCE")
        .queryParam("strategy", "SUPERVISOR_THEN_ANCESTORS")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.assignees[0]").value("finance.lead"))
      .andExpect(jsonPath("$.assignees[1]").value("ceo"));

    mockMvc.perform(
      get("/api/admin/organization/assignment/resolve")
        .header("Authorization", basic("org.admin", "Password123!"))
        .queryParam("unitCode", "FINANCE")
        .queryParam("strategy", "UNIT_MEMBERS")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.assignees[0]").value("analyst.one"));

    mockMvc.perform(
      get("/api/admin/organization/units")
        .header("Authorization", basic("org.admin", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.units").isArray())
      .andExpect(jsonPath("$.units[0].code").isNotEmpty());
  }

  private static String basic(String username, String password) {
    String raw = username + ":" + password;
    return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }
}
`;
}

module.exports = {
  buildOrganizationHierarchyItJava,
};

