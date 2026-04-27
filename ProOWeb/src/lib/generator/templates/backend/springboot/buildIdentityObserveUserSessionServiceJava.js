function buildIdentityObserveUserSessionServiceJava() {
  return `package com.prooweb.generated.identity.application.service;

import com.prooweb.generated.identity.application.port.in.ObserveUserSessionUseCase;
import com.prooweb.generated.identity.domain.model.UserSessionObservation;
import com.prooweb.generated.identity.domain.port.out.ObserveUserSessionPort;
import java.util.List;

public class ObserveUserSessionService implements ObserveUserSessionUseCase {
  private final ObserveUserSessionPort observeUserSessionPort;

  public ObserveUserSessionService(ObserveUserSessionPort observeUserSessionPort) {
    this.observeUserSessionPort = observeUserSessionPort;
  }

  @Override
  public UserSessionObservation observeAuthenticatedSession(
    String username,
    String accessToken,
    String deviceFingerprint,
    String ipAddress,
    String userAgent
  ) {
    return observeUserSessionPort.observeAuthenticatedSession(
      username,
      accessToken,
      deviceFingerprint,
      ipAddress,
      userAgent
    );
  }

  @Override
  public List<UserSessionObservation> readActiveSessions(String username) {
    return observeUserSessionPort.readActiveSessions(username);
  }

  @Override
  public boolean revokeSession(String username, String sessionId) {
    return observeUserSessionPort.revokeSession(username, sessionId);
  }
}
`;
}

module.exports = {
  buildIdentityObserveUserSessionServiceJava,
};

