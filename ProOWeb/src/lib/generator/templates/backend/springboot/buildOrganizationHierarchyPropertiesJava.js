function buildOrganizationHierarchyPropertiesJava() {
  return `package com.prooweb.generated.organization.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.organization.hierarchy")
public class OrganizationHierarchyProperties {
  private boolean enabled = true;
  private String defaultAssignmentStrategy = "SUPERVISOR_THEN_ANCESTORS";
  private int maxTraversalDepth = 8;

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getDefaultAssignmentStrategy() {
    return defaultAssignmentStrategy;
  }

  public void setDefaultAssignmentStrategy(String defaultAssignmentStrategy) {
    this.defaultAssignmentStrategy = normalizeStrategy(defaultAssignmentStrategy);
  }

  public int getMaxTraversalDepth() {
    return maxTraversalDepth;
  }

  public void setMaxTraversalDepth(int maxTraversalDepth) {
    if (maxTraversalDepth < 1 || maxTraversalDepth > 16) {
      this.maxTraversalDepth = 8;
      return;
    }

    this.maxTraversalDepth = maxTraversalDepth;
  }

  private static String normalizeStrategy(String value) {
    if (value == null || value.isBlank()) {
      return "SUPERVISOR_THEN_ANCESTORS";
    }

    String normalized = value.trim()
      .toUpperCase()
      .replaceAll("[^A-Z0-9]+", "_");

    return switch (normalized) {
      case "SUPERVISOR_ONLY", "SUPERVISOR_THEN_ANCESTORS", "UNIT_MEMBERS" -> normalized;
      default -> "SUPERVISOR_THEN_ANCESTORS";
    };
  }
}
`;
}

module.exports = {
  buildOrganizationHierarchyPropertiesJava,
};

