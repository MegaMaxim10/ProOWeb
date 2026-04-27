function buildExternalIamAuthenticationItJava() {
  return `package com.prooweb.generated.tests.system;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prooweb.generated.app.ProowebApplication;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
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
    "spring.datasource.url=jdbc:h2:mem:prooweb-external-iam-it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.identity.external-iam.enabled=true",
    "app.identity.external-iam.providers[0].id=corporate-oidc",
    "app.identity.external-iam.providers[0].issuer-uri=https://issuer.example.com",
    "app.identity.external-iam.providers[0].client-id=prooweb-client",
    "app.identity.external-iam.providers[0].shared-secret=test-shared-secret",
    "app.identity.external-iam.providers[0].username-claim=preferred_username",
    "app.identity.external-iam.providers[0].email-claim=email"
  }
)
@AutoConfigureMockMvc
class ExternalIamAuthenticationIT {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void shouldAuthenticateWithExternalIamWhenMatchingLocalAccountExists() throws Exception {
    MvcResult registerResult = mockMvc.perform(
      post("/api/auth/register")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "displayName": "External User",
            "email": "external.user@example.com",
            "username": "external.user",
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

    String idToken = buildHs256IdToken(
      "https://issuer.example.com",
      "prooweb-client",
      "external.user",
      "external.user@example.com",
      "test-shared-secret"
    );

    mockMvc.perform(
      post("/api/auth/external/oidc/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\\"providerId\\": \\"corporate-oidc\\", \\"idToken\\": \\"" + idToken + "\\"}")
    )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("AUTHENTICATED"))
      .andExpect(jsonPath("$.providerId").value("corporate-oidc"))
      .andExpect(jsonPath("$.username").value("external.user"))
      .andExpect(jsonPath("$.email").value("external.user@example.com"))
      .andExpect(jsonPath("$.accessToken").isNotEmpty());
  }

  private String buildHs256IdToken(
    String issuer,
    String audience,
    String username,
    String email,
    String secret
  ) throws Exception {
    String headerJson = objectMapper.writeValueAsString(Map.of(
      "alg", "HS256",
      "typ", "JWT"
    ));
    String payloadJson = objectMapper.writeValueAsString(Map.of(
      "iss", issuer,
      "aud", audience,
      "preferred_username", username,
      "email", email,
      "exp", Instant.now().plusSeconds(600L).getEpochSecond()
    ));

    String headerPart = toBase64Url(headerJson.getBytes(StandardCharsets.UTF_8));
    String payloadPart = toBase64Url(payloadJson.getBytes(StandardCharsets.UTF_8));
    String unsignedToken = headerPart + "." + payloadPart;

    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String signaturePart = toBase64Url(mac.doFinal(unsignedToken.getBytes(StandardCharsets.UTF_8)));

    return unsignedToken + "." + signaturePart;
  }

  private String toBase64Url(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
`;
}

module.exports = {
  buildExternalIamAuthenticationItJava,
};

