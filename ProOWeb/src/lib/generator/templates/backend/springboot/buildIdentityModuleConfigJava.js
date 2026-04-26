function buildIdentityModuleConfigJava(options = {}) {
  const authImports = options.authEnabled
    ? `
import com.prooweb.generated.identity.application.port.in.RunAuthenticationFlowUseCase;
import com.prooweb.generated.identity.application.service.AuthenticationFlowService;
import com.prooweb.generated.identity.domain.port.out.RunAuthenticationFlowPort;`
    : "";
  const authBean = options.authEnabled
    ? `
  @Bean
  RunAuthenticationFlowUseCase runAuthenticationFlowUseCase(RunAuthenticationFlowPort runAuthenticationFlowPort) {
    return new AuthenticationFlowService(runAuthenticationFlowPort);
  }`
    : "";

  return `package com.prooweb.generated.identity.infrastructure.config;

import com.prooweb.generated.identity.application.port.in.AssignRoleToIdentityUserUseCase;
import com.prooweb.generated.identity.application.port.in.CreateIdentityRoleUseCase;
import com.prooweb.generated.identity.application.port.in.CreateIdentityUserUseCase;
import com.prooweb.generated.identity.application.port.in.ReadIdentityRolesUseCase;
import com.prooweb.generated.identity.application.port.in.ReadIdentityUserCredentialsUseCase;
import com.prooweb.generated.identity.application.port.in.ReadIdentityUsersUseCase;
import com.prooweb.generated.identity.application.service.AssignRoleToIdentityUserService;
import com.prooweb.generated.identity.application.service.CreateIdentityRoleService;
import com.prooweb.generated.identity.application.service.CreateIdentityUserService;
import com.prooweb.generated.identity.application.service.ReadIdentityRolesService;
import com.prooweb.generated.identity.application.service.ReadIdentityUserCredentialsService;
import com.prooweb.generated.identity.application.service.ReadIdentityUsersService;
import com.prooweb.generated.identity.domain.port.out.AssignRoleToUserPort;
import com.prooweb.generated.identity.domain.port.out.CreateRolePort;
import com.prooweb.generated.identity.domain.port.out.CreateUserPort;
import com.prooweb.generated.identity.domain.port.out.LoadRolesPort;
import com.prooweb.generated.identity.domain.port.out.LoadUserCredentialsPort;
import com.prooweb.generated.identity.domain.port.out.LoadUsersPort;
import com.prooweb.generated.identity.infrastructure.bootstrap.IdentityBootstrapSeeder;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityRoleJpaRepository;
import com.prooweb.generated.identity.infrastructure.persistence.IdentityUserJpaRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
${authImports}

@Configuration
@EnableConfigurationProperties(IdentityBootstrapProperties.class)
public class IdentityModuleConfig {
  @Bean
  ReadIdentityUsersUseCase readIdentityUsersUseCase(LoadUsersPort loadUsersPort) {
    return new ReadIdentityUsersService(loadUsersPort);
  }

  @Bean
  CreateIdentityUserUseCase createIdentityUserUseCase(CreateUserPort createUserPort) {
    return new CreateIdentityUserService(createUserPort);
  }

  @Bean
  AssignRoleToIdentityUserUseCase assignRoleToIdentityUserUseCase(AssignRoleToUserPort assignRoleToUserPort) {
    return new AssignRoleToIdentityUserService(assignRoleToUserPort);
  }

  @Bean
  ReadIdentityRolesUseCase readIdentityRolesUseCase(LoadRolesPort loadRolesPort) {
    return new ReadIdentityRolesService(loadRolesPort);
  }

  @Bean
  CreateIdentityRoleUseCase createIdentityRoleUseCase(CreateRolePort createRolePort) {
    return new CreateIdentityRoleService(createRolePort);
  }

  @Bean
  ReadIdentityUserCredentialsUseCase readIdentityUserCredentialsUseCase(
    LoadUserCredentialsPort loadUserCredentialsPort
  ) {
    return new ReadIdentityUserCredentialsService(loadUserCredentialsPort);
  }${authBean}

  @Bean
  IdentityBootstrapSeeder identityBootstrapSeeder(
    IdentityUserJpaRepository userRepository,
    IdentityRoleJpaRepository roleRepository,
    IdentityBootstrapProperties properties
  ) {
    return new IdentityBootstrapSeeder(userRepository, roleRepository, properties);
  }

  @Bean
  ApplicationRunner identityBootstrapRunner(IdentityBootstrapSeeder identityBootstrapSeeder) {
    return args -> identityBootstrapSeeder.seed();
  }
}
`;
}

module.exports = {
  buildIdentityModuleConfigJava,
};
