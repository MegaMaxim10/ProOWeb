function buildIdentityObserveUserSessionUseCaseJava() {
  return `package com.prooweb.generated.identity.application.port.in;

import com.prooweb.generated.identity.domain.model.UserSessionObservation;
import java.util.List;

public interface ObserveUserSessionUseCase {
  UserSessionObservation observeAuthenticatedSession(
    String username,
    String accessToken,
    String deviceFingerprint,
    String ipAddress,
    String userAgent
  );

  List<UserSessionObservation> readActiveSessions(String username);

  boolean revokeSession(String username, String sessionId);
}
`;
}

module.exports = {
  buildIdentityObserveUserSessionUseCaseJava,
};

