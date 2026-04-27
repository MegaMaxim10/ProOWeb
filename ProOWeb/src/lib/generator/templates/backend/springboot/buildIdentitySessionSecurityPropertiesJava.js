function buildIdentitySessionSecurityPropertiesJava() {
  return `package com.prooweb.generated.identity.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.identity.session-security")
public class SessionSecurityProperties {
  private boolean enabled;
  private int suspiciousWindowMinutes = 60;
  private int maxDistinctDevices = 3;

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public int getSuspiciousWindowMinutes() {
    return suspiciousWindowMinutes;
  }

  public void setSuspiciousWindowMinutes(int suspiciousWindowMinutes) {
    this.suspiciousWindowMinutes = suspiciousWindowMinutes;
  }

  public int getMaxDistinctDevices() {
    return maxDistinctDevices;
  }

  public void setMaxDistinctDevices(int maxDistinctDevices) {
    this.maxDistinctDevices = maxDistinctDevices;
  }
}
`;
}

module.exports = {
  buildIdentitySessionSecurityPropertiesJava,
};

