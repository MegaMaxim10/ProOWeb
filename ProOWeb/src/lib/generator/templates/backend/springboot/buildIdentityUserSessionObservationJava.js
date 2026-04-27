function buildIdentityUserSessionObservationJava() {
  return `package com.prooweb.generated.identity.domain.model;

import java.time.Instant;

public record UserSessionObservation(
  String sessionId,
  String username,
  String deviceFingerprint,
  String ipAddress,
  String userAgent,
  Instant authenticatedAt,
  boolean active,
  boolean suspicious,
  String suspiciousReason
) {
}
`;
}

module.exports = {
  buildIdentityUserSessionObservationJava,
};

