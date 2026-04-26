function buildIdentityUserAccountEntityJava() {
  return `package com.prooweb.generated.identity.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "identity_users")
public class UserAccountEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "display_name", nullable = false, length = 160)
  private String displayName;

  @Column(name = "email", nullable = false, unique = true, length = 190)
  private String email;

  @Column(name = "username", nullable = false, unique = true, length = 120)
  private String username;

  @Column(name = "password_digest", nullable = false, length = 255)
  private String passwordDigest;

  @Column(name = "activation_token", unique = true, length = 64)
  private String activationToken;

  @Column(name = "password_reset_token", unique = true, length = 64)
  private String passwordResetToken;

  @Column(name = "mfa_mode", nullable = false, length = 16)
  private String mfaMode = "NONE";

  @Column(name = "mfa_totp_secret", length = 128)
  private String mfaTotpSecret;

  @Column(name = "mfa_otp_code", length = 16)
  private String mfaOtpCode;

  @Column(name = "active", nullable = false)
  private boolean active = true;

  @ManyToMany(fetch = FetchType.EAGER)
  @JoinTable(
    name = "identity_user_roles",
    joinColumns = @JoinColumn(name = "user_id"),
    inverseJoinColumns = @JoinColumn(name = "role_id")
  )
  private Set<RoleEntity> roles = new LinkedHashSet<>();

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
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

  public String getPasswordDigest() {
    return passwordDigest;
  }

  public void setPasswordDigest(String passwordDigest) {
    this.passwordDigest = passwordDigest;
  }

  public String getActivationToken() {
    return activationToken;
  }

  public void setActivationToken(String activationToken) {
    this.activationToken = activationToken;
  }

  public String getPasswordResetToken() {
    return passwordResetToken;
  }

  public void setPasswordResetToken(String passwordResetToken) {
    this.passwordResetToken = passwordResetToken;
  }

  public String getMfaMode() {
    return mfaMode;
  }

  public void setMfaMode(String mfaMode) {
    this.mfaMode = mfaMode;
  }

  public String getMfaTotpSecret() {
    return mfaTotpSecret;
  }

  public void setMfaTotpSecret(String mfaTotpSecret) {
    this.mfaTotpSecret = mfaTotpSecret;
  }

  public String getMfaOtpCode() {
    return mfaOtpCode;
  }

  public void setMfaOtpCode(String mfaOtpCode) {
    this.mfaOtpCode = mfaOtpCode;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }

  public Set<RoleEntity> getRoles() {
    return roles;
  }

  public void setRoles(Set<RoleEntity> roles) {
    this.roles = roles;
  }
}
`;
}

module.exports = {
  buildIdentityUserAccountEntityJava,
};
