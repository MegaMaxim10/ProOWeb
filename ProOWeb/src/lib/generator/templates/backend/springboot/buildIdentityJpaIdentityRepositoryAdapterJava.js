function buildIdentityJpaIdentityRepositoryAdapterJava() {
  return `package com.prooweb.generated.identity.infrastructure.adapter.out.persistence;

import com.prooweb.generated.identity.domain.model.CreateRoleCommand;
import com.prooweb.generated.identity.domain.model.CreateUserCommand;
import com.prooweb.generated.identity.domain.model.Permission;
import com.prooweb.generated.identity.domain.model.Role;
import com.prooweb.generated.identity.domain.model.UserAccount;
import com.prooweb.generated.identity.domain.model.UserCredentials;
import com.prooweb.generated.identity.domain.port.out.AssignRoleToUserPort;
import com.prooweb.generated.identity.domain.port.out.CreateRolePort;
import com.prooweb.generated.identity.domain.port.out.CreateUserPort;
import com.prooweb.generated.identity.domain.port.out.LoadRolesPort;
import com.prooweb.generated.identity.domain.port.out.LoadUserCredentialsPort;
import com.prooweb.generated.identity.domain.port.out.LoadUsersPort;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityRoleJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityUserJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.entity.RoleEntity;
import com.prooweb.generated.identity.infrastructure.persistence.entity.UserAccountEntity;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class JpaIdentityRepositoryAdapter
  implements LoadUsersPort, CreateUserPort, AssignRoleToUserPort, LoadRolesPort, CreateRolePort, LoadUserCredentialsPort {

  private final IdentityUserJpaRepository userRepository;
  private final IdentityRoleJpaRepository roleRepository;
  private final PasswordEncoder passwordEncoder;

  public JpaIdentityRepositoryAdapter(
    IdentityUserJpaRepository userRepository,
    IdentityRoleJpaRepository roleRepository,
    PasswordEncoder passwordEncoder
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  @Transactional(readOnly = true)
  public List<UserAccount> loadUsers() {
    return userRepository.findAll(Sort.by(Sort.Direction.ASC, "username")).stream()
      .map(this::toUserAccount)
      .toList();
  }

  @Override
  public UserAccount createUser(CreateUserCommand command) {
    String username = normalizeUsername(command.username());
    String email = requireNonBlank(command.email(), "email");

    if (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
      throw new IllegalArgumentException("Username already exists: " + username);
    }

    if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
      throw new IllegalArgumentException("Email already exists: " + email);
    }

    UserAccountEntity entity = new UserAccountEntity();
    entity.setUsername(username);
    entity.setEmail(email);
    entity.setDisplayName(requireNonBlank(command.displayName(), "displayName"));
    entity.setPasswordDigest(passwordEncoder.encode(requireNonBlank(command.rawPassword(), "rawPassword")));
    entity.setActive(command.active());
    entity.setRoles(resolveRoles(command.roleCodes()));

    return toUserAccount(userRepository.save(entity));
  }

  @Override
  public UserAccount assignRoleToUser(String username, String roleCode) {
    UserAccountEntity user = userRepository.findByUsernameIgnoreCase(normalizeUsername(username))
      .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

    RoleEntity role = roleRepository.findByCodeIgnoreCase(normalizeCode(roleCode, "roleCode"))
      .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleCode));

    user.getRoles().add(role);
    return toUserAccount(userRepository.save(user));
  }

  @Override
  @Transactional(readOnly = true)
  public List<Role> loadRoles() {
    return roleRepository.findAll(Sort.by(Sort.Direction.ASC, "code")).stream()
      .map(this::toRole)
      .toList();
  }

  @Override
  public Role createRole(CreateRoleCommand command) {
    String code = normalizeCode(command.code(), "code");

    if (roleRepository.findByCodeIgnoreCase(code).isPresent()) {
      throw new IllegalArgumentException("Role already exists: " + code);
    }

    RoleEntity entity = new RoleEntity();
    entity.setCode(code);
    entity.setDescription(requireNonBlank(command.description(), "description"));
    entity.setActive(command.active());
    entity.setPermissionCodes(normalizeCodes(command.permissionCodes()));
    return toRole(roleRepository.save(entity));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UserCredentials> loadByUsername(String username) {
    return userRepository.findByUsernameIgnoreCase(normalizeUsername(username))
      .map(this::toUserCredentials);
  }

  private Set<RoleEntity> resolveRoles(List<String> roleCodes) {
    Set<String> normalizedCodes = normalizeCodes(roleCodes);
    if (normalizedCodes.isEmpty()) {
      return new LinkedHashSet<>();
    }

    Set<RoleEntity> resolvedRoles = new LinkedHashSet<>();
    for (String code : normalizedCodes) {
      RoleEntity role = roleRepository.findByCodeIgnoreCase(code)
        .orElseThrow(() -> new IllegalArgumentException("Role not found: " + code));
      resolvedRoles.add(role);
    }

    return resolvedRoles;
  }

  private Role toRole(RoleEntity entity) {
    List<Permission> permissions = entity.getPermissionCodes().stream()
      .sorted()
      .map((permissionCode) -> new Permission(permissionCode, permissionCode.replace('_', ' ')))
      .toList();

    return new Role(
      entity.getId() == null ? -1L : entity.getId(),
      entity.getCode(),
      entity.getDescription(),
      entity.isActive(),
      permissions
    );
  }

  private UserAccount toUserAccount(UserAccountEntity entity) {
    List<String> roleCodes = entity.getRoles().stream()
      .map(RoleEntity::getCode)
      .distinct()
      .sorted()
      .toList();

    List<String> permissionCodes = entity.getRoles().stream()
      .filter(RoleEntity::isActive)
      .flatMap((role) -> role.getPermissionCodes().stream())
      .distinct()
      .sorted()
      .toList();

    return new UserAccount(
      entity.getId() == null ? -1L : entity.getId(),
      entity.getDisplayName(),
      entity.getEmail(),
      entity.getUsername(),
      entity.isActive(),
      roleCodes,
      permissionCodes
    );
  }

  private UserCredentials toUserCredentials(UserAccountEntity entity) {
    List<String> authorities = entity.getRoles().stream()
      .filter(RoleEntity::isActive)
      .flatMap((role) -> {
        Set<String> roleAuthorities = new LinkedHashSet<>();
        roleAuthorities.add("ROLE_" + role.getCode());
        roleAuthorities.addAll(role.getPermissionCodes());
        return roleAuthorities.stream();
      })
      .distinct()
      .sorted()
      .toList();

    return new UserCredentials(
      entity.getUsername(),
      entity.getPasswordDigest(),
      entity.isActive(),
      authorities
    );
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

  private static String normalizeCode(String value, String fieldName) {
    String normalized = requireNonBlank(value, fieldName)
      .toUpperCase(Locale.ROOT)
      .replaceAll("[^A-Z0-9_]+", "_");

    if (normalized.isBlank()) {
      throw new IllegalArgumentException("Invalid code for field: " + fieldName);
    }

    return normalized;
  }

  private static Set<String> normalizeCodes(List<String> values) {
    if (values == null) {
      return new LinkedHashSet<>();
    }

    return values.stream()
      .map((entry) -> normalizeCode(entry, "code"))
      .collect(Collectors.toCollection(LinkedHashSet::new));
  }
}
`;
}

module.exports = {
  buildIdentityJpaIdentityRepositoryAdapterJava,
};
