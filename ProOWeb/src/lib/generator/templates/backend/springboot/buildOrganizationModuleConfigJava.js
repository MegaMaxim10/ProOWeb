function buildOrganizationModuleConfigJava() {
  return `package com.prooweb.generated.organization.infrastructure.config;

import com.prooweb.generated.organization.application.port.in.ManageOrganizationHierarchyUseCase;
import com.prooweb.generated.organization.application.port.in.ReadOrganizationHierarchyUseCase;
import com.prooweb.generated.organization.application.port.in.ResolveHierarchyAssignmentUseCase;
import com.prooweb.generated.organization.application.service.OrganizationHierarchyService;
import com.prooweb.generated.organization.domain.port.out.OrganizationHierarchyRepositoryPort;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(OrganizationHierarchyProperties.class)
public class OrganizationModuleConfig {
  @Bean
  OrganizationHierarchyService organizationHierarchyService(
    OrganizationHierarchyRepositoryPort repository,
    OrganizationHierarchyProperties properties
  ) {
    return new OrganizationHierarchyService(
      repository,
      properties.getDefaultAssignmentStrategy(),
      properties.getMaxTraversalDepth()
    );
  }

  @Bean
  ReadOrganizationHierarchyUseCase readOrganizationHierarchyUseCase(OrganizationHierarchyService service) {
    return service;
  }

  @Bean
  ManageOrganizationHierarchyUseCase manageOrganizationHierarchyUseCase(OrganizationHierarchyService service) {
    return service;
  }

  @Bean
  ResolveHierarchyAssignmentUseCase resolveHierarchyAssignmentUseCase(OrganizationHierarchyService service) {
    return service;
  }
}
`;
}

module.exports = {
  buildOrganizationModuleConfigJava,
};

