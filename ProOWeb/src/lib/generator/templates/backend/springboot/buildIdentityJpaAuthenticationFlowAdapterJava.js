function buildIdentityJpaAuthenticationFlowAdapterJava() {
  return `package com.prooweb.generated.identity.infrastructure.adapter.out.persistence;

import com.prooweb.generated.identity.domain.model.AuthenticationFlowResult;
import com.prooweb.generated.identity.domain.port.out.RunAuthenticationFlowPort;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityRoleJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityUserJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.entity.RoleEntity;
import com.prooweb.generated.identity.infrastructure.persistence.entity.UserAccountEntity;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class JpaAuthenticationFlowAdapter implements RunAuthenticationFlowPort {
  private static final int OTP_DIGITS = 6;

  private final IdentityUserJpaRepository userRepository;
  private final IdentityRoleJpaRepository roleRepository;
  private final PasswordEncoder passwordEncoder;
  private final SecureRandom secureRandom;

  public JpaAuthenticationFlowAdapter(
    IdentityUserJpaRepository userRepository,
    IdentityRoleJpaRepository roleRepository,
    PasswordEncoder passwordEncoder
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.passwordEncoder = passwordEncoder;
    this.secureRandom = new SecureRandom();
  }

  @Override
  public AuthenticationFlowResult registerAccount(String displayName, String email, String username, String rawPassword) {
    String safeUsername = normalizeUsername(username);
    String safeEmail = requireNonBlank(email, "email");

    if (userRepository.findByUsernameIgnoreCase(safeUsername).isPresent()) {
      return AuthenticationFlowResult.info("DUPLICATE_USERNAME", "Username already exists.", null, null, null, null, null);
    }

    if (userRepository.findByEmailIgnoreCase(safeEmail).isPresent()) {
      return AuthenticationFlowResult.info("DUPLICATE_EMAIL", "Email already exists.", null, null, null, null, null);
    }

    RoleEntity defaultRole = roleRepository.findByCodeIgnoreCase("PLATFORM_USER").orElseGet(() -> {
      RoleEntity role = new RoleEntity();
      role.setCode("PLATFORM_USER");
      role.setDescription("Default platform user role");
      role.setActive(true);
      role.setPermissionCodes(Set.of());
      return roleRepository.save(role);
    });

    UserAccountEntity user = new UserAccountEntity();
    user.setDisplayName(requireNonBlank(displayName, "displayName"));
    user.setEmail(safeEmail);
    user.setUsername(safeUsername);
    user.setPasswordDigest(passwordEncoder.encode(requireNonBlank(rawPassword, "rawPassword")));
    user.setActive(false);
    user.setActivationToken(randomToken());
    user.setMfaMode("NONE");
    user.setRoles(new LinkedHashSet<>(Set.of(defaultRole)));

    userRepository.save(user);

    return AuthenticationFlowResult.info(
      "REGISTERED",
      "Account created. Activate the account before login.",
      null,
      user.getActivationToken(),
      null,
      null,
      null
    );
  }

  @Override
  public AuthenticationFlowResult activateAccount(String activationToken) {
    String safeToken = requireNonBlank(activationToken, "activationToken");

    return userRepository.findByActivationToken(safeToken)
      .map((user) -> {
        user.setActive(true);
        user.setActivationToken(null);
        userRepository.save(user);
        return AuthenticationFlowResult.info("ACTIVATED", "Account activated.", null, null, null, null, null);
      })
      .orElseGet(() -> AuthenticationFlowResult.info("INVALID_TOKEN", "Activation token is invalid.", null, null, null, null, null));
  }

  @Override
  public AuthenticationFlowResult login(String username, String rawPassword, String mfaCode) {
    String safeUsername = normalizeUsername(username);
    String safePassword = requireNonBlank(rawPassword, "rawPassword");

    UserAccountEntity user = userRepository.findByUsernameIgnoreCase(safeUsername).orElse(null);
    if (user == null || !passwordEncoder.matches(safePassword, user.getPasswordDigest())) {
      return AuthenticationFlowResult.info("INVALID_CREDENTIALS", "Invalid credentials.", null, null, null, null, null);
    }

    if (!user.isActive()) {
      return AuthenticationFlowResult.info("ACCOUNT_INACTIVE", "Account is not activated yet.", null, null, null, null, null);
    }

    String mfaMode = normalizedMfaMode(user.getMfaMode());
    if ("OTP".equals(mfaMode)) {
      String challengeCode = user.getMfaOtpCode();
      if (challengeCode == null || challengeCode.isBlank()) {
        challengeCode = randomNumericCode();
        user.setMfaOtpCode(challengeCode);
      }
      userRepository.save(user);

      if (mfaCode == null || mfaCode.isBlank()) {
        return AuthenticationFlowResult.info(
          "MFA_REQUIRED",
          "OTP code required to complete login.",
          "OTP",
          null,
          null,
          challengeCode,
          null
        );
      }

      if (!challengeCode.equals(mfaCode.trim())) {
        return AuthenticationFlowResult.info("INVALID_OTP_CODE", "OTP code is invalid.", "OTP", null, null, null, null);
      }

      user.setMfaOtpCode(null);
      userRepository.save(user);
    } else if ("TOTP".equals(mfaMode)) {
      if (mfaCode == null || mfaCode.isBlank()) {
        return AuthenticationFlowResult.info("MFA_REQUIRED", "TOTP code required to complete login.", "TOTP", null, null, null, null);
      }

      if (!isValidTotpCode(user.getMfaTotpSecret(), mfaCode.trim())) {
        return AuthenticationFlowResult.info("INVALID_TOTP_CODE", "TOTP code is invalid.", "TOTP", null, null, null, null);
      }
    }

    return AuthenticationFlowResult.success("AUTHENTICATED", "Authentication successful.", randomToken());
  }

  @Override
  public AuthenticationFlowResult requestPasswordReset(String principal) {
    String safePrincipal = requireNonBlank(principal, "principal");
    UserAccountEntity user = userRepository.findByUsernameIgnoreCase(safePrincipal.toLowerCase(Locale.ROOT))
      .or(() -> userRepository.findByEmailIgnoreCase(safePrincipal))
      .orElse(null);

    if (user == null) {
      return AuthenticationFlowResult.info(
        "PASSWORD_RESET_REQUESTED",
        "If an account exists, a password reset token has been generated.",
        null,
        null,
        null,
        null,
        null
      );
    }

    String resetToken = randomToken();
    user.setPasswordResetToken(resetToken);
    userRepository.save(user);

    return AuthenticationFlowResult.info(
      "PASSWORD_RESET_REQUESTED",
      "Password reset token generated.",
      null,
      null,
      resetToken,
      null,
      null
    );
  }

  @Override
  public AuthenticationFlowResult confirmPasswordReset(String resetToken, String newPassword) {
    String safeToken = requireNonBlank(resetToken, "resetToken");
    String safePassword = requireNonBlank(newPassword, "newPassword");

    return userRepository.findByPasswordResetToken(safeToken)
      .map((user) -> {
        user.setPasswordDigest(passwordEncoder.encode(safePassword));
        user.setPasswordResetToken(null);
        userRepository.save(user);
        return AuthenticationFlowResult.info(
          "PASSWORD_RESET_CONFIRMED",
          "Password reset confirmed.",
          null,
          null,
          null,
          null,
          null
        );
      })
      .orElseGet(() -> AuthenticationFlowResult.info("INVALID_TOKEN", "Reset token is invalid.", null, null, null, null, null));
  }

  @Override
  public AuthenticationFlowResult configureOtpMfa(String username) {
    UserAccountEntity user = findUserByUsername(username);
    String otpCode = randomNumericCode();
    user.setMfaMode("OTP");
    user.setMfaOtpCode(otpCode);
    user.setMfaTotpSecret(null);
    userRepository.save(user);

    return AuthenticationFlowResult.info(
      "MFA_CONFIGURED",
      "OTP MFA configured.",
      "OTP",
      null,
      null,
      otpCode,
      null
    );
  }

  @Override
  public AuthenticationFlowResult configureTotpMfa(String username) {
    UserAccountEntity user = findUserByUsername(username);
    String secret = randomTotpSecret();
    user.setMfaMode("TOTP");
    user.setMfaTotpSecret(secret);
    user.setMfaOtpCode(null);
    userRepository.save(user);

    return AuthenticationFlowResult.info(
      "MFA_CONFIGURED",
      "TOTP MFA configured.",
      "TOTP",
      null,
      null,
      null,
      secret
    );
  }

  private UserAccountEntity findUserByUsername(String username) {
    String safeUsername = normalizeUsername(username);
    return userRepository.findByUsernameIgnoreCase(safeUsername)
      .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
  }

  private static String requireNonBlank(String value, String fieldName) {
    String normalized = value == null ? "" : value.trim();
    if (normalized.isBlank()) {
      throw new IllegalArgumentException("Missing required field: " + fieldName);
    }
    return normalized;
  }

  private static String normalizeUsername(String value) {
    return requireNonBlank(value, "username").toLowerCase(Locale.ROOT);
  }

  private static String normalizedMfaMode(String value) {
    String mode = value == null ? "NONE" : value.trim().toUpperCase(Locale.ROOT);
    return mode.isBlank() ? "NONE" : mode;
  }

  private String randomToken() {
    return UUID.randomUUID().toString().replace("-", "");
  }

  private String randomNumericCode() {
    int bound = (int) Math.pow(10, OTP_DIGITS);
    int value = secureRandom.nextInt(bound);
    return String.format("%0" + OTP_DIGITS + "d", value);
  }

  private String randomTotpSecret() {
    byte[] bytes = new byte[20];
    secureRandom.nextBytes(bytes);
    return Base64.getEncoder().withoutPadding().encodeToString(bytes);
  }

  private boolean isValidTotpCode(String secret, String providedCode) {
    if (secret == null || secret.isBlank() || providedCode.isBlank()) {
      return false;
    }

    long now = Instant.now().getEpochSecond();
    for (long window = -1; window <= 1; window++) {
      String expectedCode = generateTotpCode(secret, now + (window * 30L));
      if (expectedCode.equals(providedCode)) {
        return true;
      }
    }

    return false;
  }

  private String generateTotpCode(String secret, long unixSeconds) {
    try {
      long counter = Math.floorDiv(unixSeconds, 30L);
      byte[] counterBytes = ByteBuffer.allocate(8).putLong(counter).array();
      byte[] key = Base64.getDecoder().decode(secret);

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
    } catch (GeneralSecurityException | IllegalArgumentException error) {
      return "";
    }
  }
}
`;
}

module.exports = {
  buildIdentityJpaAuthenticationFlowAdapterJava,
};
