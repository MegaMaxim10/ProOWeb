function buildIdentityExternalIamPropertiesJava() {
  return `package com.prooweb.generated.identity.infrastructure.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.identity.external-iam")
public class ExternalIamProperties {
  private boolean enabled;
  private List<Provider> providers = new ArrayList<>();

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public List<Provider> getProviders() {
    return providers;
  }

  public void setProviders(List<Provider> providers) {
    this.providers = providers == null ? new ArrayList<>() : providers;
  }

  public static class Provider {
    private String id;
    private String issuerUri;
    private String clientId;
    private String clientSecret;
    private String sharedSecret;
    private String usernameClaim;
    private String emailClaim;

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getIssuerUri() {
      return issuerUri;
    }

    public void setIssuerUri(String issuerUri) {
      this.issuerUri = issuerUri;
    }

    public String getClientId() {
      return clientId;
    }

    public void setClientId(String clientId) {
      this.clientId = clientId;
    }

    public String getClientSecret() {
      return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
      this.clientSecret = clientSecret;
    }

    public String getSharedSecret() {
      return sharedSecret;
    }

    public void setSharedSecret(String sharedSecret) {
      this.sharedSecret = sharedSecret;
    }

    public String getUsernameClaim() {
      return usernameClaim;
    }

    public void setUsernameClaim(String usernameClaim) {
      this.usernameClaim = usernameClaim;
    }

    public String getEmailClaim() {
      return emailClaim;
    }

    public void setEmailClaim(String emailClaim) {
      this.emailClaim = emailClaim;
    }
  }
}
`;
}

module.exports = {
  buildIdentityExternalIamPropertiesJava,
};

