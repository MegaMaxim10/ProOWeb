function buildGatewayPbkdf2WorkspacePasswordEncoderJava() {
  return `package com.prooweb.generated.gateway.security;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.security.crypto.password.PasswordEncoder;

public class Pbkdf2WorkspacePasswordEncoder implements PasswordEncoder {
  private static final int ITERATIONS = 120000;
  private static final int KEY_LENGTH = 256;
  private static final int SALT_SIZE_BYTES = 16;

  @Override
  public String encode(CharSequence rawPassword) {
    byte[] salt = new byte[SALT_SIZE_BYTES];
    new SecureRandom().nextBytes(salt);
    byte[] hash = derive(rawPassword, salt);
    return toHex(salt) + "$" + toHex(hash);
  }

  @Override
  public boolean matches(CharSequence rawPassword, String encodedPassword) {
    if (encodedPassword == null || !encodedPassword.contains("$")) {
      return false;
    }

    String[] parts = encodedPassword.split("\\\\$", 2);
    if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
      return false;
    }

    byte[] salt = fromHex(parts[0]);
    byte[] expectedHash = fromHex(parts[1]);
    byte[] candidateHash = derive(rawPassword, salt);

    return MessageDigest.isEqual(expectedHash, candidateHash);
  }

  private static byte[] derive(CharSequence rawPassword, byte[] salt) {
    try {
      PBEKeySpec spec = new PBEKeySpec(
        rawPassword.toString().toCharArray(),
        salt,
        ITERATIONS,
        KEY_LENGTH
      );
      SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
      return factory.generateSecret(spec).getEncoded();
    } catch (GeneralSecurityException error) {
      throw new IllegalStateException("Unable to compute PBKDF2 digest", error);
    }
  }

  private static String toHex(byte[] bytes) {
    StringBuilder builder = new StringBuilder(bytes.length * 2);
    for (byte item : bytes) {
      builder.append(String.format("%02x", item));
    }
    return builder.toString();
  }

  private static byte[] fromHex(String hex) {
    if (hex.length() % 2 != 0) {
      throw new IllegalArgumentException("Invalid hex payload");
    }

    byte[] result = new byte[hex.length() / 2];
    for (int index = 0; index < hex.length(); index += 2) {
      result[index / 2] = (byte) Integer.parseInt(hex.substring(index, index + 2), 16);
    }
    return result;
  }
}
`;
}

module.exports = {
  buildGatewayPbkdf2WorkspacePasswordEncoderJava,
};
