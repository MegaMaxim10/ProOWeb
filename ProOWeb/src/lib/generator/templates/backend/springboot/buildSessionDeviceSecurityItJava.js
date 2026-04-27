function buildSessionDeviceSecurityItJava() {
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
    "spring.datasource.url=jdbc:h2:mem:prooweb-session-security-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.identity.session-security.enabled=true",
    "app.identity.session-security.suspicious-window-minutes=60",
    "app.identity.session-security.max-distinct-devices=2"
  }
)
@AutoConfigureMockMvc
class SessionDeviceSecurityIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldTrackSessionsDetectRiskAndRevokeSession() throws Exception {
    MvcResult registerResult = mockMvc.perform(
      post("/api/auth/register")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "displayName": "Session User",
            "email": "session.user@example.com",
            "username": "session.user",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("REGISTERED"))
      .andReturn();

    String activationToken = objectMapper.readTree(registerResult.getResponse().getContentAsString())
      .path("activationToken")
      .asText();

    mockMvc.perform(
      post("/api/auth/activate")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"activationToken\\": \\"" + activationToken + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("ACTIVATED"));

    mockMvc.perform(
      post("/api/auth/login")
        .header("X-Device-Fingerprint", "device-alpha")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "session.user",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"))
      .andExpect(jsonPath("$.suspiciousSession").value(false));

    mockMvc.perform(
      post("/api/auth/login")
        .header("X-Device-Fingerprint", "device-beta")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "session.user",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"))
      .andExpect(jsonPath("$.suspiciousSession").value(false));

    MvcResult riskyLoginResult = mockMvc.perform(
      post("/api/auth/login")
        .header("X-Device-Fingerprint", "device-gamma")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "session.user",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"))
      .andExpect(jsonPath("$.suspiciousSession").value(true))
      .andReturn();

    String riskySessionId = objectMapper.readTree(riskyLoginResult.getResponse().getContentAsString())
      .path("sessionId")
      .asText();

    mockMvc.perform(
      get("/api/account/sessions")
        .header("Authorization", basic("session.user", "Password123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("OK"))
      .andExpect(jsonPath("$.suspicious").value(true))
      .andExpect(jsonPath("$.activeSessions").isArray());

    mockMvc.perform(
      post("/api/account/sessions/revoke")
        .header("Authorization", basic("session.user", "Password123!"))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"sessionId\\": \\"" + riskySessionId + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("REVOKED"));
  }

  private static String basic(String username, String password) {
    String raw = username + ":" + password;
    return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }
}
`;
}

module.exports = {
  buildSessionDeviceSecurityItJava,
};

