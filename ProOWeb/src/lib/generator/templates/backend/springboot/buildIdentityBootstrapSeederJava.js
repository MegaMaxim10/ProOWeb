function buildIdentityBootstrapSeederJava() {
  return `package com.prooweb.generated.identity.infrastructure.bootstrap;

import com.prooweb.generated.identity.infrastructure.config.IdentityBootstrapProperties;
import com.prooweb.generated.identity.infrastructure.config.IdentityBootstrapProperties.SuperAdmin;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityRoleJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityUserJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.entity.RoleEntity;
import com.prooweb.generated.identity.infrastructure.persistence.entity.UserAccountEntity;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

public class IdentityBootstrapSeeder {
  private final IdentityUserJpaRepository userRepository;
  private final IdentityRoleJpaRepository roleRepository;
  private final IdentityBootstrapProperties properties;

  public IdentityBootstrapSeeder(
    IdentityUserJpaRepository userRepository,
    IdentityRoleJpaRepository roleRepository,
    IdentityBootstrapProperties properties
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.properties = properties;
  }

  @Transactional
  public void seed() {
    if (!properties.isEnabled()) {
      return;
    }

    SuperAdmin admin = properties.getSuperAdmin();
    String username = normalize(admin.getUsername());
    String passwordHash = normalize(admin.getPasswordHash());
    String passwordSalt = normalize(admin.getPasswordSalt());

    if (username.isBlank() || passwordHash.isBlank() || passwordSalt.isBlank()) {
      return;
    }

    String roleCode = normalizeCode(admin.getRoleCode());
    Set<String> permissionCodes = normalizeCodes(admin.getPermissions());

    RoleEntity role = roleRepository.findByCodeIgnoreCase(roleCode).orElseGet(() -> {
      RoleEntity created = new RoleEntity();
      created.setCode(roleCode);
      created.setDescription(nonBlank(admin.getRoleDescription(), "Platform super administrator"));
      created.setActive(true);
      created.setPermissionCodes(permissionCodes);
      return roleRepository.save(created);
    });

    UserAccountEntity user = userRepository.findByUsernameIgnoreCase(username).orElseGet(() -> {
      UserAccountEntity created = new UserAccountEntity();
      created.setDisplayName(nonBlank(admin.getName(), "ProOWeb Super Admin"));
      created.setEmail(nonBlank(admin.getEmail(), username + "@prooweb.local"));
      created.setUsername(username);
      created.setPasswordDigest(passwordSalt + "$" + passwordHash);
      created.setActive(true);
      created.getRoles().add(role);
      return created;
    });

    if (!user.getRoles().contains(role)) {
      user.getRoles().add(role);
    }

    userRepository.save(user);
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private static String nonBlank(String value, String fallback) {
    String normalized = normalize(value);
    return normalized.isBlank() ? fallback : normalized;
  }

  private static String normalizeCode(String rawValue) {
    String candidate = normalize(rawValue).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]+", "_");
    return candidate.isBlank() ? "PLATFORM_SUPER_ADMIN" : candidate;
  }

  private static Set<String> normalizeCodes(Set<String> rawCodes) {
    if (rawCodes == null || rawCodes.isEmpty()) {
      return Set.of(
        "IDENTITY_SUPER_ADMIN",
        "IDENTITY_USER_READ",
        "IDENTITY_USER_CREATE",
        "IDENTITY_ROLE_READ",
        "IDENTITY_ROLE_CREATE",
        "IDENTITY_ROLE_ASSIGN"
      );
    }

    return rawCodes.stream()
      .map((entry) -> normalizeCode(entry))
      .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private static Set<String> normalizeCodes(java.util.List<String> rawCodes) {
    if (rawCodes == null) {
      return normalizeCodes(Set.<String>of());
    }

    return normalizeCodes(new LinkedHashSet<>(rawCodes));
  }
}
`;
}

module.exports = {
  buildIdentityBootstrapSeederJava,
};
