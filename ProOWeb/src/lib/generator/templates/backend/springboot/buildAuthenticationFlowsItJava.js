function buildAuthenticationFlowsItJava() {
  return `package com.prooweb.generated.tests.system;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prooweb.generated.app.ProowebApplication;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
  classes = ProowebApplication.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=jdbc:h2:mem:prooweb-auth-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
  }
)
@AutoConfigureMockMvc
class AuthenticationFlowsIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldCoverRegistrationActivationLoginResetAndMfaFlows() throws Exception {
    MvcResult registerResult = mockMvc.perform(
      post("/api/auth/register")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "displayName": "Alice Tester",
            "email": "alice@example.com",
            "username": "alice",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("REGISTERED"))
      .andExpect(jsonPath("$.activationToken").isNotEmpty())
      .andReturn();

    JsonNode registerPayload = objectMapper.readTree(registerResult.getResponse().getContentAsString());
    String activationToken = registerPayload.path("activationToken").asText();

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "alice",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("ACCOUNT_INACTIVE"));

    mockMvc.perform(
      post("/api/auth/activate")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"activationToken\\": \\"" + activationToken + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("ACTIVATED"));

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "alice",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"))
      .andExpect(jsonPath("$.accessToken").isNotEmpty());

    MvcResult resetRequestResult = mockMvc.perform(
      post("/api/auth/password-reset/request")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"principal\\": \\"alice\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("PASSWORD_RESET_REQUESTED"))
      .andExpect(jsonPath("$.passwordResetToken").isNotEmpty())
      .andReturn();

    JsonNode resetRequestPayload = objectMapper.readTree(resetRequestResult.getResponse().getContentAsString());
    String resetToken = resetRequestPayload.path("passwordResetToken").asText();

    mockMvc.perform(
      post("/api/auth/password-reset/confirm")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"resetToken\\": \\"" + resetToken + "\\", \\"newPassword\\": \\"NewPassword123!\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("PASSWORD_RESET_CONFIRMED"));

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "alice",
            "password": "Password123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("INVALID_CREDENTIALS"));

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "alice",
            "password": "NewPassword123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"));

    MvcResult otpSetupResult = mockMvc.perform(
      post("/api/account/mfa/otp/setup")
        .header("Authorization", basic("alice", "NewPassword123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("MFA_CONFIGURED"))
      .andExpect(jsonPath("$.mfaMode").value("OTP"))
      .andExpect(jsonPath("$.otpCode").isNotEmpty())
      .andReturn();

    JsonNode otpSetupPayload = objectMapper.readTree(otpSetupResult.getResponse().getContentAsString());
    String otpCode = otpSetupPayload.path("otpCode").asText();

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "alice",
            "password": "NewPassword123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("MFA_REQUIRED"))
      .andExpect(jsonPath("$.mfaMode").value("OTP"));

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"username\\": \\"alice\\", \\"password\\": \\"NewPassword123!\\", \\"mfaCode\\": \\"" + otpCode + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"));

    MvcResult totpSetupResult = mockMvc.perform(
      post("/api/account/mfa/totp/setup")
        .header("Authorization", basic("alice", "NewPassword123!"))
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("MFA_CONFIGURED"))
      .andExpect(jsonPath("$.mfaMode").value("TOTP"))
      .andExpect(jsonPath("$.totpSecret").isNotEmpty())
      .andReturn();

    JsonNode totpSetupPayload = objectMapper.readTree(totpSetupResult.getResponse().getContentAsString());
    String totpSecret = totpSetupPayload.path("totpSecret").asText();
    String totpCode = generateTotpCode(totpSecret, Instant.now().getEpochSecond());

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "username": "alice",
            "password": "NewPassword123!"
          }
          """)
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("MFA_REQUIRED"))
      .andExpect(jsonPath("$.mfaMode").value("TOTP"));

    mockMvc.perform(
      post("/api/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"username\\": \\"alice\\", \\"password\\": \\"NewPassword123!\\", \\"mfaCode\\": \\"" + totpCode + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"));
  }

  private static String basic(String username, String password) {
    String raw = username + ":" + password;
    return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }

  private static String generateTotpCode(String secret, long unixSeconds) throws GeneralSecurityException {
    byte[] key = Base64.getDecoder().decode(secret);
    long counter = Math.floorDiv(unixSeconds, 30L);
    byte[] counterBytes = ByteBuffer.allocate(8).putLong(counter).array();

    Mac mac = Mac.getInstance("HmacSHA1");
    mac.init(new SecretKeySpec(key, "HmacSHA1"));
    byte[] hash = mac.doFinal(counterBytes);

    int offset = hash[hash.length - 1] & 0x0F;
    int binary = ((hash[offset] & 0x7F) << 24)
      | ((hash[offset + 1] & 0xFF) << 16)
      | ((hash[offset + 2] & 0xFF) << 8)
      | (hash[offset + 3] & 0xFF);

    int otp = binary % 1_000_000;
    return String.format("%06d", otp);
  }
}
`;
}

module.exports = {
  buildAuthenticationFlowsItJava,
};
