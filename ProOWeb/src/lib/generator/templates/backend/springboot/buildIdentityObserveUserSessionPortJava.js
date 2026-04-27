function buildIdentityObserveUserSessionPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.UserSessionObservation;
import java.util.List;

public interface ObserveUserSessionPort {
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
  buildIdentityObserveUserSessionPortJava,
};

