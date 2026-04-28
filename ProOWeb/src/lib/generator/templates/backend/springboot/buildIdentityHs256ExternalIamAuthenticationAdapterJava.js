function buildIdentityHs256ExternalIamAuthenticationAdapterJava() {
  return `package com.prooweb.generated.identity.infrastructure.adapter.out.iam;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prooweb.generated.identity.domain.model.ExternalAuthenticationResult;
import com.prooweb.generated.identity.domain.port.out.AuthenticateExternalIdentityPort;
import com.prooweb.generated.identity.infrastructure.config.ExternalIamProperties;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityUserJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.entity.UserAccountEntity;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional(readOnly = true)
public class Hs256ExternalIamAuthenticationAdapter implements AuthenticateExternalIdentityPort {
  private final ExternalIamProperties externalIamProperties;
  private final IdentityUserJpaRepository userRepository;
  private final ObjectMapper objectMapper;

  public Hs256ExternalIamAuthenticationAdapter(
    ExternalIamProperties externalIamProperties,
    IdentityUserJpaRepository userRepository,
    ObjectMapper objectMapper
  ) {
    this.externalIamProperties = externalIamProperties;
    this.userRepository = userRepository;
    this.objectMapper = objectMapper;
  }

  @Override
  public ExternalAuthenticationResult authenticateWithIdToken(String providerId, String idToken) {
    if (!externalIamProperties.isEnabled()) {
      return ExternalAuthenticationResult.info(
        "EXTERNAL_IAM_DISABLED",
        "External IAM authentication is disabled.",
        providerId,
        null,
        null
      );
    }

    String safeProviderId = normalizeLower(providerId);
    String safeToken = trimValue(idToken);
    if (safeProviderId.isBlank() || safeToken.isBlank()) {
      return ExternalAuthenticationResult.info(
        "INVALID_REQUEST",
        "providerId and idToken are required.",
        safeProviderId,
        null,
        null
      );
    }

    ExternalIamProperties.Provider provider = externalIamProperties.getProviders().stream()
      .filter((candidate) -> safeProviderId.equals(normalizeLower(candidate.getId())))
      .findFirst()
      .orElse(null);
    if (provider == null) {
      return ExternalAuthenticationResult.info(
        "UNKNOWN_PROVIDER",
        "Unknown external IAM provider: " + safeProviderId,
        safeProviderId,
        null,
        null
      );
    }

    JsonNode payload;
    JsonNode header;
    try {
      DecodedJwt decoded = decodeJwt(safeToken);
      header = decoded.header();
      payload = decoded.payload();
      if (!"HS256".equalsIgnoreCase(header.path("alg").asText())) {
        return ExternalAuthenticationResult.info(
          "UNSUPPORTED_TOKEN_ALGORITHM",
          "Only HS256 tokens are supported by the generated implementation.",
          safeProviderId,
          null,
          null
        );
      }

      String signingSecret = resolveSigningSecret(provider);
      if (signingSecret.isBlank()) {
        return ExternalAuthenticationResult.info(
          "PROVIDER_SECRET_MISSING",
          "Provider secret is missing. Configure client-secret or shared-secret.",
          safeProviderId,
          null,
          null
        );
      }

      if (!verifyHs256Signature(decoded.headerSegment(), decoded.payloadSegment(), decoded.signatureSegment(), signingSecret)) {
        return ExternalAuthenticationResult.info(
          "INVALID_TOKEN_SIGNATURE",
          "ID token signature is invalid.",
          safeProviderId,
          null,
          null
        );
      }
    } catch (IllegalArgumentException error) {
      return ExternalAuthenticationResult.info(
        "INVALID_TOKEN_FORMAT",
        error.getMessage(),
        safeProviderId,
        null,
        null
      );
    }

    if (!providerMatchesClaims(provider, payload)) {
      return ExternalAuthenticationResult.info(
        "TOKEN_PROVIDER_MISMATCH",
        "Token issuer or audience does not match provider configuration.",
        safeProviderId,
        null,
        null
      );
    }

    if (!tokenIsStillValid(payload)) {
      return ExternalAuthenticationResult.info(
        "TOKEN_EXPIRED",
        "ID token is expired.",
        safeProviderId,
        null,
        null
      );
    }

    String usernameClaim = trimValue(provider.getUsernameClaim());
    String emailClaim = trimValue(provider.getEmailClaim());
    String username = readClaim(payload, usernameClaim.isBlank() ? "preferred_username" : usernameClaim);
    if (username.isBlank()) {
      username = readClaim(payload, "sub");
    }

    String email = readClaim(payload, emailClaim.isBlank() ? "email" : emailClaim);

    Optional<UserAccountEntity> localUser = username.isBlank()
      ? Optional.empty()
      : userRepository.findByUsernameIgnoreCase(username);
    if (localUser.isEmpty() && !email.isBlank()) {
      localUser = userRepository.findByEmailIgnoreCase(email);
    }
    if (localUser.isEmpty()) {
      return ExternalAuthenticationResult.info(
        "LOCAL_ACCOUNT_NOT_FOUND",
        "No local RBAC account matches this external identity.",
        safeProviderId,
        username,
        email
      );
    }

    UserAccountEntity user = localUser.get();
    if (!user.isActive()) {
      return ExternalAuthenticationResult.info(
        "LOCAL_ACCOUNT_INACTIVE",
        "Matching local account is not active.",
        safeProviderId,
        user.getUsername(),
        user.getEmail()
      );
    }

    return ExternalAuthenticationResult.success(
      "External authentication successful.",
      UUID.randomUUID().toString().replace("-", ""),
      safeProviderId,
      user.getUsername(),
      user.getEmail()
    );
  }

  private boolean providerMatchesClaims(ExternalIamProperties.Provider provider, JsonNode payload) {
    String expectedIssuer = trimValue(provider.getIssuerUri());
    String expectedClientId = trimValue(provider.getClientId());
    String issuer = readClaim(payload, "iss");
    if (!expectedIssuer.isBlank() && !expectedIssuer.equals(issuer)) {
      return false;
    }

    JsonNode aud = payload.path("aud");
    if (expectedClientId.isBlank()) {
      return true;
    }

    if (aud.isTextual()) {
      return expectedClientId.equals(trimValue(aud.asText()));
    }

    if (aud.isArray()) {
      for (JsonNode entry : aud) {
        if (expectedClientId.equals(trimValue(entry.asText()))) {
          return true;
        }
      }
      return false;
    }

    return false;
  }

  private boolean tokenIsStillValid(JsonNode payload) {
    long exp = payload.path("exp").asLong(0L);
    if (exp <= 0L) {
      return false;
    }
    return exp > Instant.now().getEpochSecond();
  }

  private String readClaim(JsonNode payload, String claimName) {
    String safeClaimName = trimValue(claimName);
    if (safeClaimName.isBlank()) {
      return "";
    }

    JsonNode node = payload.path(safeClaimName);
    return node.isMissingNode() ? "" : trimValue(node.asText());
  }

  private DecodedJwt decodeJwt(String rawJwt) {
    String[] parts = rawJwt.split("\\\\.");
    if (parts.length != 3) {
      throw new IllegalArgumentException("JWT must contain exactly 3 parts.");
    }

    JsonNode header = parseJson(base64UrlDecode(parts[0]));
    JsonNode payload = parseJson(base64UrlDecode(parts[1]));

    return new DecodedJwt(parts[0], parts[1], parts[2], header, payload);
  }

  private JsonNode parseJson(byte[] bytes) {
    try {
      return objectMapper.readTree(bytes);
    } catch (Exception error) {
      throw new IllegalArgumentException("JWT contains invalid JSON.");
    }
  }

  private boolean verifyHs256Signature(String headerPart, String payloadPart, String signaturePart, String secret) {
    try {
      byte[] expected = signHs256(headerPart + "." + payloadPart, secret);
      byte[] actual = base64UrlDecode(signaturePart);
      return MessageDigest.isEqual(expected, actual);
    } catch (GeneralSecurityException | IllegalArgumentException error) {
      return false;
    }
  }

  private byte[] signHs256(String message, String secret) throws GeneralSecurityException {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
  }

  private byte[] base64UrlDecode(String value) {
    try {
      return Base64.getUrlDecoder().decode(value);
    } catch (IllegalArgumentException error) {
      throw new IllegalArgumentException("JWT contains invalid base64url encoding.");
    }
  }

  private String resolveSigningSecret(ExternalIamProperties.Provider provider) {
    String sharedSecret = trimValue(provider.getSharedSecret());
    if (!sharedSecret.isBlank()) {
      return sharedSecret;
    }
    return trimValue(provider.getClientSecret());
  }

  private String trimValue(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeLower(String value) {
    return trimValue(value).toLowerCase(Locale.ROOT);
  }

  private record DecodedJwt(
    String headerSegment,
    String payloadSegment,
    String signatureSegment,
    JsonNode header,
    JsonNode payload
  ) {
  }
}
`;
}

module.exports = {
  buildIdentityHs256ExternalIamAuthenticationAdapterJava,
};
