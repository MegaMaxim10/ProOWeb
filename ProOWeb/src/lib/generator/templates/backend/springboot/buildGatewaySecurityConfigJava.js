function buildGatewaySecurityConfigJava() {
  return `package com.prooweb.generated.gateway.security;

import com.prooweb.generated.identity.application.port.in.ReadIdentityUserCredentialsUseCase;
import com.prooweb.generated.identity.domain.model.UserCredentials;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class GatewaySecurityConfig {
  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
      .csrf(AbstractHttpConfigurer::disable)
      .authorizeHttpRequests((auth) -> auth
        .requestMatchers("/api/auth/**")
        .permitAll()
        .requestMatchers("/api/meta", "/api/system-health", "/actuator/health", "/error")
        .permitAll()
        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
        .permitAll()
        .anyRequest()
        .authenticated()
      )
      .httpBasic(Customizer.withDefaults());

    return http.build();
  }

  @Bean
  UserDetailsService userDetailsService(ReadIdentityUserCredentialsUseCase readIdentityUserCredentialsUseCase) {
    return (username) -> readIdentityUserCredentialsUseCase.readByUsername(username)
      .map(this::toUserDetails)
      .orElseThrow(() -> new UsernameNotFoundException("Unknown user: " + username));
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new Pbkdf2WorkspacePasswordEncoder();
  }

  private UserDetails toUserDetails(UserCredentials credentials) {
    User.UserBuilder userBuilder = User.withUsername(credentials.username())
      .password(credentials.passwordDigest())
      .authorities(credentials.authorities().toArray(String[]::new));

    if (!credentials.active()) {
      userBuilder.disabled(true);
    }

    return userBuilder.build();
  }
}
`;
}

module.exports = {
  buildGatewaySecurityConfigJava,
};
