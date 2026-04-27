function buildNotificationWorkflowsItJava() {
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
    "spring.datasource.url=jdbc:h2:mem:prooweb-notification-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.liquibase.enabled=false",
    "app.notifications.enabled=true",
    "app.notifications.audit-enabled=true"
  }
)
@AutoConfigureMockMvc
class NotificationWorkflowsIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldExposeNotificationTemplatesDispatchAndAudit() throws Exception {
    MvcResult registerResult = mockMvc.perform(
      post("/api/auth/register")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "displayName": "Notifications Admin",
            "email": "notifications.admin@example.com",
            "username": "notifications.admin",
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
      get("/api/admin/notifications/templates")
        .header("Authorization", basic("notifications.admin", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templates").isArray())
      .andExpect(jsonPath("$.templates[0].code").isNotEmpty());

    mockMvc.perform(
      post("/api/admin/notifications/dispatch")
        .header("Authorization", basic("notifications.admin", "Password123!"))
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "templateCode": "ACCOUNT_ACTIVATION",
            "recipient": "john.doe@example.com",
            "variables": {
              "displayName": "John Doe",
              "activationToken": "TOKEN-123"
            }
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.auditEntry.status").value("SENT"))
      .andExpect(jsonPath("$.auditEntry.templateCode").value("ACCOUNT_ACTIVATION"));

    mockMvc.perform(
      get("/api/admin/notifications/audit")
        .header("Authorization", basic("notifications.admin", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.entries").isArray())
      .andExpect(jsonPath("$.entries[0].templateCode").value("ACCOUNT_ACTIVATION"));
  }

  private static String basic(String username, String password) {
    String raw = username + ":" + password;
    return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }
}
`;
}

module.exports = {
  buildNotificationWorkflowsItJava,
};

