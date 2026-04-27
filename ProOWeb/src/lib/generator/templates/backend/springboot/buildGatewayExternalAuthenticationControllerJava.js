function buildGatewayExternalAuthenticationControllerJava() {
  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.identity.application.port.in.AuthenticateExternalIdentityUseCase;
import com.prooweb.generated.identity.domain.model.ExternalAuthenticationResult;
import io.swagger.v3.oas.annotations.Operation;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/external")
public class ExternalAuthenticationController {
  private final AuthenticateExternalIdentityUseCase authenticateExternalIdentityUseCase;

  public ExternalAuthenticationController(AuthenticateExternalIdentityUseCase authenticateExternalIdentityUseCase) {
    this.authenticateExternalIdentityUseCase = authenticateExternalIdentityUseCase;
  }

  @Operation(summary = "Authenticate a user with an external OIDC ID token")
  @PostMapping("/oidc/login")
  public Map<String, Object> authenticateWithExternalIam(@RequestBody ExternalOidcLoginPayload payload) {
    ExternalAuthenticationResult result = authenticateExternalIdentityUseCase.authenticateWithIdToken(
      payload.providerId(),
      payload.idToken()
    );

    return Map.of(
      "status", result.status(),
      "message", result.message(),
      "accessToken", result.accessToken() == null ? "" : result.accessToken(),
      "providerId", result.providerId() == null ? "" : result.providerId(),
      "username", result.username() == null ? "" : result.username(),
      "email", result.email() == null ? "" : result.email()
    );
  }

  public record ExternalOidcLoginPayload(
    String providerId,
    String idToken
  ) {
  }
}
`;
}

module.exports = {
  buildGatewayExternalAuthenticationControllerJava,
};

