function buildOrganizationInMemoryHierarchyRepositoryAdapterJava() {
  return `package com.prooweb.generated.organization.infrastructure.adapter.out.hierarchy;

import com.prooweb.generated.organization.domain.model.OrganizationUnit;
import com.prooweb.generated.organization.domain.port.out.OrganizationHierarchyRepositoryPort;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Component;

@Component
public class InMemoryOrganizationHierarchyRepositoryAdapter implements OrganizationHierarchyRepositoryPort {
  private final ConcurrentMap<String, OrganizationUnit> unitsByCode = new ConcurrentHashMap<>();

  @Override
  public List<OrganizationUnit> loadUnits() {
    return unitsByCode.values().stream()
      .sorted(Comparator.comparing(OrganizationUnit::code))
      .toList();
  }

  @Override
  public Optional<OrganizationUnit> findUnitByCode(String code) {
    return Optional.ofNullable(unitsByCode.get(normalizeCode(code)));
  }

  @Override
  public OrganizationUnit saveUnit(OrganizationUnit unit) {
    OrganizationUnit normalizedUnit = new OrganizationUnit(
      normalizeCode(unit.code()),
      normalizeName(unit.name()),
      normalizeOptionalCode(unit.parentCode()),
      normalizeOptionalUsername(unit.supervisorUsername()),
      unit.memberUsernames().stream()
        .map(this::normalizeOptionalUsername)
        .filter((entry) -> entry != null && !entry.isBlank())
        .distinct()
        .sorted()
        .toList()
    );

    unitsByCode.put(normalizedUnit.code(), normalizedUnit);
    return normalizedUnit;
  }

  private String normalizeCode(String value) {
    if (value == null) {
      return "";
    }
    return value.trim().toUpperCase().replaceAll("[^A-Z0-9_]+", "_");
  }

  private String normalizeOptionalCode(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return normalizeCode(value);
  }

  private String normalizeName(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeOptionalUsername(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim().toLowerCase();
  }
}
`;
}

module.exports = {
  buildOrganizationInMemoryHierarchyRepositoryAdapterJava,
};

