function buildOrganizationHierarchyServiceJava() {
  return `package com.prooweb.generated.organization.application.service;

import com.prooweb.generated.organization.application.port.in.ManageOrganizationHierarchyUseCase;
import com.prooweb.generated.organization.application.port.in.ReadOrganizationHierarchyUseCase;
import com.prooweb.generated.organization.application.port.in.ResolveHierarchyAssignmentUseCase;
import com.prooweb.generated.organization.domain.model.OrganizationUnit;
import com.prooweb.generated.organization.domain.port.out.OrganizationHierarchyRepositoryPort;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class OrganizationHierarchyService
  implements ReadOrganizationHierarchyUseCase, ManageOrganizationHierarchyUseCase, ResolveHierarchyAssignmentUseCase {

  private final OrganizationHierarchyRepositoryPort repository;
  private final String defaultAssignmentStrategy;
  private final int maxTraversalDepth;

  public OrganizationHierarchyService(
    OrganizationHierarchyRepositoryPort repository,
    String defaultAssignmentStrategy,
    int maxTraversalDepth
  ) {
    this.repository = repository;
    this.defaultAssignmentStrategy = normalizeStrategy(defaultAssignmentStrategy);
    this.maxTraversalDepth = Math.max(1, maxTraversalDepth);
  }

  @Override
  public List<OrganizationUnit> readUnits() {
    return repository.loadUnits();
  }

  @Override
  public OrganizationUnit createUnit(String code, String name, String parentCode) {
    String normalizedCode = normalizeCode(code, "code");
    String normalizedName = requireNonBlank(name, "name");
    String normalizedParentCode = normalizeOptionalCode(parentCode);

    if (repository.findUnitByCode(normalizedCode).isPresent()) {
      throw new IllegalArgumentException("Organization unit already exists: " + normalizedCode);
    }

    if (normalizedParentCode != null) {
      if (normalizedParentCode.equals(normalizedCode)) {
        throw new IllegalArgumentException("A unit cannot be its own parent.");
      }

      repository.findUnitByCode(normalizedParentCode)
        .orElseThrow(() -> new IllegalArgumentException("Parent unit not found: " + normalizedParentCode));
    }

    return repository.saveUnit(new OrganizationUnit(normalizedCode, normalizedName, normalizedParentCode, null, List.of()));
  }

  @Override
  public OrganizationUnit assignSupervisor(String unitCode, String supervisorUsername) {
    OrganizationUnit unit = loadUnitRequired(unitCode);
    String normalizedSupervisor = normalizeOptionalUsername(supervisorUsername);

    return repository.saveUnit(
      new OrganizationUnit(
        unit.code(),
        unit.name(),
        unit.parentCode(),
        normalizedSupervisor,
        unit.memberUsernames()
      )
    );
  }

  @Override
  public OrganizationUnit assignMember(String unitCode, String username) {
    OrganizationUnit unit = loadUnitRequired(unitCode);
    String normalizedUsername = normalizeUsername(username, "username");

    Set<String> members = new LinkedHashSet<>(unit.memberUsernames());
    members.add(normalizedUsername);

    return repository.saveUnit(
      new OrganizationUnit(
        unit.code(),
        unit.name(),
        unit.parentCode(),
        unit.supervisorUsername(),
        new ArrayList<>(members)
      )
    );
  }

  @Override
  public List<String> resolveAssignees(String unitCode, String strategy) {
    OrganizationUnit unit = loadUnitRequired(unitCode);
    String effectiveStrategy = normalizeStrategy(strategy == null || strategy.isBlank() ? defaultAssignmentStrategy : strategy);

    return switch (effectiveStrategy) {
      case "UNIT_MEMBERS" -> resolveMembers(unit);
      case "SUPERVISOR_ONLY" -> resolveSupervisorOnly(unit);
      case "SUPERVISOR_THEN_ANCESTORS" -> resolveSupervisorThenAncestors(unit);
      default -> resolveSupervisorThenAncestors(unit);
    };
  }

  private List<String> resolveMembers(OrganizationUnit unit) {
    Set<String> result = new LinkedHashSet<>();
    for (String member : unit.memberUsernames()) {
      String normalized = normalizeOptionalUsername(member);
      if (normalized != null) {
        result.add(normalized);
      }
    }
    return new ArrayList<>(result);
  }

  private List<String> resolveSupervisorOnly(OrganizationUnit unit) {
    String supervisor = normalizeOptionalUsername(unit.supervisorUsername());
    if (supervisor == null) {
      return List.of();
    }

    return List.of(supervisor);
  }

  private List<String> resolveSupervisorThenAncestors(OrganizationUnit unit) {
    Set<String> assignees = new LinkedHashSet<>();
    Set<String> visitedUnits = new LinkedHashSet<>();
    OrganizationUnit cursor = unit;
    int depth = 0;

    while (cursor != null && depth < maxTraversalDepth) {
      if (!visitedUnits.add(cursor.code())) {
        break;
      }

      String supervisor = normalizeOptionalUsername(cursor.supervisorUsername());
      if (supervisor != null) {
        assignees.add(supervisor);
      }

      if (cursor.parentCode() == null || cursor.parentCode().isBlank()) {
        break;
      }

      cursor = repository.findUnitByCode(cursor.parentCode()).orElse(null);
      depth++;
    }

    return new ArrayList<>(assignees);
  }

  private OrganizationUnit loadUnitRequired(String unitCode) {
    String normalized = normalizeCode(unitCode, "unitCode");
    return repository.findUnitByCode(normalized)
      .orElseThrow(() -> new IllegalArgumentException("Organization unit not found: " + normalized));
  }

  private static String requireNonBlank(String value, String fieldName) {
    String normalized = value == null ? "" : value.trim();
    if (normalized.isBlank()) {
      throw new IllegalArgumentException("Missing required field: " + fieldName);
    }
    return normalized;
  }

  private static String normalizeCode(String value, String fieldName) {
    String normalized = requireNonBlank(value, fieldName)
      .toUpperCase(Locale.ROOT)
      .replaceAll("[^A-Z0-9_]+", "_");

    if (normalized.isBlank()) {
      throw new IllegalArgumentException("Invalid code for field: " + fieldName);
    }

    return normalized;
  }

  private static String normalizeOptionalCode(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }

    return normalizeCode(value, "parentCode");
  }

  private static String normalizeUsername(String value, String fieldName) {
    return requireNonBlank(value, fieldName).toLowerCase(Locale.ROOT);
  }

  private static String normalizeOptionalUsername(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }

    return value.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizeStrategy(String value) {
    String normalized = requireNonBlank(value, "strategy")
      .toUpperCase(Locale.ROOT)
      .replaceAll("[^A-Z0-9]+", "_");

    return switch (normalized) {
      case "SUPERVISOR_ONLY", "SUPERVISOR_THEN_ANCESTORS", "UNIT_MEMBERS" -> normalized;
      default -> "SUPERVISOR_THEN_ANCESTORS";
    };
  }
}
`;
}

module.exports = {
  buildOrganizationHierarchyServiceJava,
};

