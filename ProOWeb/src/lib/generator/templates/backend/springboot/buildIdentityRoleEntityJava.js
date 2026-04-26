function buildIdentityRoleEntityJava() {
  return `package com.prooweb.generated.identity.infrastructure.persistence.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "identity_roles")
public class RoleEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "code", nullable = false, unique = true, length = 96)
  private String code;

  @Column(name = "description", nullable = false, length = 255)
  private String description;

  @Column(name = "active", nullable = false)
  private boolean active = true;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "identity_role_permissions", joinColumns = @JoinColumn(name = "role_id"))
  @Column(name = "permission_code", nullable = false, length = 96)
  private Set<String> permissionCodes = new LinkedHashSet<>();

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }

  public Set<String> getPermissionCodes() {
    return permissionCodes;
  }

  public void setPermissionCodes(Set<String> permissionCodes) {
    this.permissionCodes = permissionCodes;
  }
}
`;
}

module.exports = {
  buildIdentityRoleEntityJava,
};
