function buildGatewayIdentityAdminControllerJava() {
  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.identity.application.port.in.AssignRoleToIdentityUserUseCase;
import com.prooweb.generated.identity.application.port.in.CreateIdentityRoleUseCase;
import com.prooweb.generated.identity.application.port.in.CreateIdentityUserUseCase;
import com.prooweb.generated.identity.application.port.in.ReadIdentityRolesUseCase;
import com.prooweb.generated.identity.application.port.in.ReadIdentityUsersUseCase;
import com.prooweb.generated.identity.domain.model.CreateRoleCommand;
import com.prooweb.generated.identity.domain.model.CreateUserCommand;
import com.prooweb.generated.identity.domain.model.Role;
import com.prooweb.generated.identity.domain.model.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/identity")
public class IdentityAdminController {
  private final ReadIdentityUsersUseCase readIdentityUsersUseCase;
  private final CreateIdentityUserUseCase createIdentityUserUseCase;
  private final AssignRoleToIdentityUserUseCase assignRoleToIdentityUserUseCase;
  private final ReadIdentityRolesUseCase readIdentityRolesUseCase;
  private final CreateIdentityRoleUseCase createIdentityRoleUseCase;

  public IdentityAdminController(
    ReadIdentityUsersUseCase readIdentityUsersUseCase,
    CreateIdentityUserUseCase createIdentityUserUseCase,
    AssignRoleToIdentityUserUseCase assignRoleToIdentityUserUseCase,
    ReadIdentityRolesUseCase readIdentityRolesUseCase,
    CreateIdentityRoleUseCase createIdentityRoleUseCase
  ) {
    this.readIdentityUsersUseCase = readIdentityUsersUseCase;
    this.createIdentityUserUseCase = createIdentityUserUseCase;
    this.assignRoleToIdentityUserUseCase = assignRoleToIdentityUserUseCase;
    this.readIdentityRolesUseCase = readIdentityRolesUseCase;
    this.createIdentityRoleUseCase = createIdentityRoleUseCase;
  }

  @Operation(summary = "List users with roles and permissions")
  @GetMapping("/users")
  @PreAuthorize("hasAnyAuthority('IDENTITY_USER_READ', 'IDENTITY_SUPER_ADMIN')")
  public Map<String, Object> listUsers() {
    List<Map<String, Object>> users = readIdentityUsersUseCase.readUsers().stream()
      .map(this::toUserPayload)
      .toList();
    return Map.of("users", users);
  }

  @Operation(summary = "Create a user account")
  @PostMapping("/users")
  @PreAuthorize("hasAnyAuthority('IDENTITY_USER_CREATE', 'IDENTITY_SUPER_ADMIN')")
  public Map<String, Object> createUser(@RequestBody CreateUserPayload payload) {
    UserAccount createdUser = createIdentityUserUseCase.createUser(
      new CreateUserCommand(
        payload.displayName(),
        payload.email(),
        payload.username(),
        payload.password(),
        payload.active() == null || payload.active(),
        payload.roleCodes() == null ? List.of() : payload.roleCodes()
      )
    );

    return Map.of("user", toUserPayload(createdUser));
  }

  @Operation(summary = "Assign role to user")
  @PostMapping("/users/{username}/roles/{roleCode}")
  @PreAuthorize("hasAnyAuthority('IDENTITY_ROLE_ASSIGN', 'IDENTITY_SUPER_ADMIN')")
  public Map<String, Object> assignRole(
    @PathVariable("username") String username,
    @PathVariable("roleCode") String roleCode
  ) {
    UserAccount updatedUser = assignRoleToIdentityUserUseCase.assignRoleToUser(username, roleCode);
    return Map.of("user", toUserPayload(updatedUser));
  }

  @Operation(summary = "List available roles")
  @GetMapping("/roles")
  @PreAuthorize("hasAnyAuthority('IDENTITY_ROLE_READ', 'IDENTITY_SUPER_ADMIN')")
  public Map<String, Object> listRoles() {
    List<Map<String, Object>> roles = readIdentityRolesUseCase.readRoles().stream()
      .map(this::toRolePayload)
      .toList();
    return Map.of("roles", roles);
  }

  @Operation(summary = "Create a role")
  @PostMapping("/roles")
  @PreAuthorize("hasAnyAuthority('IDENTITY_ROLE_CREATE', 'IDENTITY_SUPER_ADMIN')")
  public Map<String, Object> createRole(@RequestBody CreateRolePayload payload) {
    Role createdRole = createIdentityRoleUseCase.createRole(
      new CreateRoleCommand(
        payload.code(),
        payload.description(),
        payload.active() == null || payload.active(),
        payload.permissionCodes() == null ? List.of() : payload.permissionCodes()
      )
    );

    return Map.of("role", toRolePayload(createdRole));
  }

  private Map<String, Object> toUserPayload(UserAccount user) {
    return Map.of(
      "id", user.id(),
      "displayName", user.displayName(),
      "email", user.email(),
      "username", user.username(),
      "active", user.active(),
      "roles", user.roles(),
      "permissions", user.permissions()
    );
  }

  private Map<String, Object> toRolePayload(Role role) {
    return Map.of(
      "id", role.id(),
      "code", role.code(),
      "description", role.description(),
      "active", role.active(),
      "permissions", role.permissions().stream().map((permission) -> permission.code()).toList()
    );
  }

  public record CreateUserPayload(
    String displayName,
    String email,
    String username,
    String password,
    Boolean active,
    List<String> roleCodes
  ) {
  }

  public record CreateRolePayload(
    String code,
    String description,
    Boolean active,
    List<String> permissionCodes
  ) {
  }
}
`;
}

module.exports = {
  buildGatewayIdentityAdminControllerJava,
};
