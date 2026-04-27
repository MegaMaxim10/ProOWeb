function buildGatewayOrganizationHierarchyControllerJava() {
  return `package com.prooweb.generated.gateway.api;

import com.prooweb.generated.organization.application.port.in.ManageOrganizationHierarchyUseCase;
import com.prooweb.generated.organization.application.port.in.ReadOrganizationHierarchyUseCase;
import com.prooweb.generated.organization.application.port.in.ResolveHierarchyAssignmentUseCase;
import com.prooweb.generated.organization.domain.model.OrganizationUnit;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/organization")
public class OrganizationHierarchyController {
  private final ReadOrganizationHierarchyUseCase readOrganizationHierarchyUseCase;
  private final ManageOrganizationHierarchyUseCase manageOrganizationHierarchyUseCase;
  private final ResolveHierarchyAssignmentUseCase resolveHierarchyAssignmentUseCase;

  public OrganizationHierarchyController(
    ReadOrganizationHierarchyUseCase readOrganizationHierarchyUseCase,
    ManageOrganizationHierarchyUseCase manageOrganizationHierarchyUseCase,
    ResolveHierarchyAssignmentUseCase resolveHierarchyAssignmentUseCase
  ) {
    this.readOrganizationHierarchyUseCase = readOrganizationHierarchyUseCase;
    this.manageOrganizationHierarchyUseCase = manageOrganizationHierarchyUseCase;
    this.resolveHierarchyAssignmentUseCase = resolveHierarchyAssignmentUseCase;
  }

  @Operation(summary = "List organization hierarchy units")
  @GetMapping("/units")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> listUnits() {
    List<Map<String, Object>> units = readOrganizationHierarchyUseCase.readUnits().stream()
      .map(this::toUnitPayload)
      .toList();
    return Map.of("units", units);
  }

  @Operation(summary = "Create an organization unit")
  @PostMapping("/units")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> createUnit(@RequestBody CreateOrganizationUnitPayload payload) {
    OrganizationUnit unit = manageOrganizationHierarchyUseCase.createUnit(
      payload.code(),
      payload.name(),
      payload.parentCode()
    );
    return Map.of("unit", toUnitPayload(unit));
  }

  @Operation(summary = "Assign supervisor to a unit")
  @PostMapping("/units/{unitCode}/supervisor/{username}")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> assignSupervisor(
    @PathVariable("unitCode") String unitCode,
    @PathVariable("username") String username
  ) {
    OrganizationUnit unit = manageOrganizationHierarchyUseCase.assignSupervisor(unitCode, username);
    return Map.of("unit", toUnitPayload(unit));
  }

  @Operation(summary = "Assign a member to a unit")
  @PostMapping("/units/{unitCode}/members/{username}")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> assignMember(
    @PathVariable("unitCode") String unitCode,
    @PathVariable("username") String username
  ) {
    OrganizationUnit unit = manageOrganizationHierarchyUseCase.assignMember(unitCode, username);
    return Map.of("unit", toUnitPayload(unit));
  }

  @Operation(summary = "Resolve hierarchy-aware assignment for a unit")
  @GetMapping("/assignment/resolve")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> resolveAssignment(
    @RequestParam("unitCode") String unitCode,
    @RequestParam(value = "strategy", required = false) String strategy
  ) {
    List<String> assignees = resolveHierarchyAssignmentUseCase.resolveAssignees(unitCode, strategy);
    return Map.of(
      "unitCode", unitCode,
      "strategy", strategy == null || strategy.isBlank() ? "DEFAULT" : strategy,
      "assignees", assignees
    );
  }

  private Map<String, Object> toUnitPayload(OrganizationUnit unit) {
    return Map.of(
      "code", unit.code(),
      "name", unit.name(),
      "parentCode", unit.parentCode() == null ? "" : unit.parentCode(),
      "supervisorUsername", unit.supervisorUsername() == null ? "" : unit.supervisorUsername(),
      "memberUsernames", unit.memberUsernames()
    );
  }

  public record CreateOrganizationUnitPayload(
    String code,
    String name,
    String parentCode
  ) {
  }
}
`;
}

module.exports = {
  buildGatewayOrganizationHierarchyControllerJava,
};

