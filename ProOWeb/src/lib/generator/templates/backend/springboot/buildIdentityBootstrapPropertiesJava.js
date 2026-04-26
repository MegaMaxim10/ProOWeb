function buildIdentityBootstrapPropertiesJava() {
  return `package com.prooweb.generated.identity.infrastructure.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.identity.bootstrap")
public class IdentityBootstrapProperties {
  private boolean enabled = true;
  private SuperAdmin superAdmin = new SuperAdmin();

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public SuperAdmin getSuperAdmin() {
    return superAdmin;
  }

  public void setSuperAdmin(SuperAdmin superAdmin) {
    this.superAdmin = superAdmin;
  }

  public static class SuperAdmin {
    private String name = "ProOWeb Super Admin";
    private String email = "admin@prooweb.local";
    private String username = "superadmin";
    private String passwordHash = "";
    private String passwordSalt = "";
    private String roleCode = "PLATFORM_SUPER_ADMIN";
    private String roleDescription = "Platform super administrator";
    private List<String> permissions = new ArrayList<>();

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getEmail() {
      return email;
    }

    public void setEmail(String email) {
      this.email = email;
    }

    public String getUsername() {
      return username;
    }

    public void setUsername(String username) {
      this.username = username;
    }

    public String getPasswordHash() {
      return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
      this.passwordHash = passwordHash;
    }

    public String getPasswordSalt() {
      return passwordSalt;
    }

    public void setPasswordSalt(String passwordSalt) {
      this.passwordSalt = passwordSalt;
    }

    public String getRoleCode() {
      return roleCode;
    }

    public void setRoleCode(String roleCode) {
      this.roleCode = roleCode;
    }

    public String getRoleDescription() {
      return roleDescription;
    }

    public void setRoleDescription(String roleDescription) {
      this.roleDescription = roleDescription;
    }

    public List<String> getPermissions() {
      return permissions;
    }

    public void setPermissions(List<String> permissions) {
      this.permissions = permissions;
    }
  }
}
`;
}

module.exports = {
  buildIdentityBootstrapPropertiesJava,
};
