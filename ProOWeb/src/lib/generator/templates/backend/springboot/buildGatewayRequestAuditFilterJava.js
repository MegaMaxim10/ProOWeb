function buildGatewayRequestAuditFilterJava() {
  return `package com.prooweb.generated.gateway.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class GatewayRequestAuditFilter extends OncePerRequestFilter {
  private static final Logger HTTP_AUDIT_LOGGER = LoggerFactory.getLogger("HTTP_AUDIT");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    long startedAt = System.currentTimeMillis();
    String requestId = resolveRequestId(request.getHeader("X-Request-Id"));
    String method = sanitize(request.getMethod());
    String path = sanitize(request.getRequestURI());
    String actor = request.getUserPrincipal() == null ? "anonymous" : request.getUserPrincipal().getName();
    String actorHash = anonymize(actor);
    String remoteHash = anonymize(request.getRemoteAddr());

    MDC.put("requestId", requestId);
    response.setHeader("X-Request-Id", requestId);
    HTTP_AUDIT_LOGGER.info(
      "HTTP_REQUEST requestId={} method={} path={} actorHash={} remoteHash={}",
      requestId,
      method,
      path,
      actorHash,
      remoteHash
    );

    try {
      filterChain.doFilter(request, response);
    } finally {
      long durationMs = System.currentTimeMillis() - startedAt;
      HTTP_AUDIT_LOGGER.info(
        "HTTP_RESPONSE requestId={} method={} path={} status={} durationMs={}",
        requestId,
        method,
        path,
        Integer.valueOf(response.getStatus()),
        Long.valueOf(durationMs)
      );
      MDC.remove("requestId");
    }
  }

  private String resolveRequestId(String candidate) {
    String normalized = sanitize(candidate);
    if (!normalized.isBlank()) {
      return normalized;
    }
    return "req-" + UUID.randomUUID();
  }

  private String sanitize(String value) {
    String normalized = String.valueOf(value == null ? "" : value)
      .replace("\\r", " ")
      .replace("\\n", " ")
      .trim();
    if (normalized.length() <= 240) {
      return normalized;
    }
    return normalized.substring(0, 240);
  }

  private String anonymize(String value) {
    String normalized = sanitize(value);
    if (normalized.isBlank()) {
      return "anonymous";
    }

    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder();
      int maxBytes = Math.min(hash.length, 8);
      for (int index = 0; index < maxBytes; index += 1) {
        builder.append(String.format("%02x", Integer.valueOf(hash[index] & 0xff)));
      }
      return builder.toString();
    } catch (NoSuchAlgorithmException exception) {
      return "hash_error";
    }
  }
}
`;
}

module.exports = {
  buildGatewayRequestAuditFilterJava,
};
