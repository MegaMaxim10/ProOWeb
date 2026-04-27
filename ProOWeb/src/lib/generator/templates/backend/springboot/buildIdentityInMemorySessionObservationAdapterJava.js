function buildIdentityInMemorySessionObservationAdapterJava() {
  return `package com.prooweb.generated.identity.infrastructure.adapter.out.session;

import com.prooweb.generated.identity.domain.model.UserSessionObservation;
import com.prooweb.generated.identity.domain.port.out.ObserveUserSessionPort;
import com.prooweb.generated.identity.infrastructure.config.SessionSecurityProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class InMemorySessionObservationAdapter implements ObserveUserSessionPort {
  private static final int MAX_SESSIONS_PER_USER = 200;

  private final SessionSecurityProperties sessionSecurityProperties;
  private final Map<String, List<SessionEntry>> sessionsByUser = new ConcurrentHashMap<>();

  public InMemorySessionObservationAdapter(SessionSecurityProperties sessionSecurityProperties) {
    this.sessionSecurityProperties = sessionSecurityProperties;
  }

  @Override
  public UserSessionObservation observeAuthenticatedSession(
    String username,
    String accessToken,
    String deviceFingerprint,
    String ipAddress,
    String userAgent
  ) {
    String safeUsername = normalizeLower(username);
    if (safeUsername.isBlank()) {
      throw new IllegalArgumentException("username is required for session observation");
    }

    String safeSessionId = normalize(accessToken).isBlank()
      ? UUID.randomUUID().toString().replace("-", "")
      : normalize(accessToken);
    String safeDeviceFingerprint = normalize(deviceFingerprint).isBlank()
      ? "unknown-device"
      : normalize(deviceFingerprint);
    Instant now = Instant.now();
    List<SessionEntry> sessions = sessionsByUser.computeIfAbsent(safeUsername, (key) -> new ArrayList<>());

    synchronized (sessions) {
      sessions.removeIf((entry) -> !entry.active && entry.authenticatedAt.isBefore(now.minus(Duration.ofDays(30))));

      Set<String> distinctDevices = computeDistinctActiveDevicesInWindow(sessions, now);
      distinctDevices.add(safeDeviceFingerprint);
      boolean suspicious = sessionSecurityProperties.isEnabled()
        && distinctDevices.size() > maxDistinctDevicesThreshold();
      String suspiciousReason = suspicious
        ? "Distinct active devices in last " + suspiciousWindowMinutes() + " minutes: " + distinctDevices.size()
        : "";

      SessionEntry entry = new SessionEntry(
        safeSessionId,
        safeUsername,
        safeDeviceFingerprint,
        normalize(ipAddress),
        normalize(userAgent),
        now,
        true,
        suspicious,
        suspiciousReason
      );

      sessions.add(entry);
      if (sessions.size() > MAX_SESSIONS_PER_USER) {
        sessions.sort(Comparator.comparing((SessionEntry session) -> session.authenticatedAt).reversed());
        sessions.subList(MAX_SESSIONS_PER_USER, sessions.size()).clear();
      }

      return entry.toObservation();
    }
  }

  @Override
  public List<UserSessionObservation> readActiveSessions(String username) {
    String safeUsername = normalizeLower(username);
    if (safeUsername.isBlank()) {
      return List.of();
    }

    List<SessionEntry> sessions = sessionsByUser.getOrDefault(safeUsername, List.of());
    synchronized (sessions) {
      return sessions.stream()
        .filter((entry) -> entry.active)
        .sorted(Comparator.comparing((SessionEntry session) -> session.authenticatedAt).reversed())
        .map(SessionEntry::toObservation)
        .toList();
    }
  }

  @Override
  public boolean revokeSession(String username, String sessionId) {
    String safeUsername = normalizeLower(username);
    String safeSessionId = normalize(sessionId);
    if (safeUsername.isBlank() || safeSessionId.isBlank()) {
      return false;
    }

    List<SessionEntry> sessions = sessionsByUser.getOrDefault(safeUsername, List.of());
    synchronized (sessions) {
      for (SessionEntry session : sessions) {
        if (session.sessionId.equals(safeSessionId) && session.active) {
          session.active = false;
          return true;
        }
      }
    }

    return false;
  }

  private Set<String> computeDistinctActiveDevicesInWindow(List<SessionEntry> sessions, Instant now) {
    Instant floor = now.minus(Duration.ofMinutes(suspiciousWindowMinutes()));
    Set<String> devices = new LinkedHashSet<>();
    for (SessionEntry session : sessions) {
      if (!session.active) {
        continue;
      }
      if (session.authenticatedAt.isBefore(floor)) {
        continue;
      }
      devices.add(session.deviceFingerprint);
    }
    return devices;
  }

  private int suspiciousWindowMinutes() {
    return Math.max(1, sessionSecurityProperties.getSuspiciousWindowMinutes());
  }

  private int maxDistinctDevicesThreshold() {
    return Math.max(1, sessionSecurityProperties.getMaxDistinctDevices());
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeLower(String value) {
    return normalize(value).toLowerCase(Locale.ROOT);
  }

  private static class SessionEntry {
    private final String sessionId;
    private final String username;
    private final String deviceFingerprint;
    private final String ipAddress;
    private final String userAgent;
    private final Instant authenticatedAt;
    private boolean active;
    private final boolean suspicious;
    private final String suspiciousReason;

    private SessionEntry(
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
      this.sessionId = sessionId;
      this.username = username;
      this.deviceFingerprint = deviceFingerprint;
      this.ipAddress = ipAddress;
      this.userAgent = userAgent;
      this.authenticatedAt = authenticatedAt;
      this.active = active;
      this.suspicious = suspicious;
      this.suspiciousReason = suspiciousReason;
    }

    private UserSessionObservation toObservation() {
      return new UserSessionObservation(
        sessionId,
        username,
        deviceFingerprint,
        ipAddress,
        userAgent,
        authenticatedAt,
        active,
        suspicious,
        suspiciousReason
      );
    }
  }
}
`;
}

module.exports = {
  buildIdentityInMemorySessionObservationAdapterJava,
};

