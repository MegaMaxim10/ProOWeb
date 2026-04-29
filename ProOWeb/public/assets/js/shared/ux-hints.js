const FIELD_INFORMATION = {
  projectTitle: "Name of the generated application and project workspace.",
  basePackage: "Root Java package used for generated backend modules and namespaces.",
  gitRepositoryUrl: "Remote Git repository where the generated project should be published.",
  backendTech: "Backend technology stack for generated server code.",
  frontendWebTech: "Web frontend technology stack for generated client code.",
  frontendMobileTech: "Mobile frontend technology option.",
  databaseTech: "Primary relational database engine used by generated services.",
  superAdminName: "Full name of the bootstrap platform administrator.",
  superAdminEmail: "Email address of the bootstrap platform administrator.",
  superAdminUsername: "Login username of the bootstrap platform administrator.",
  superAdminPassword: "Initial secret used by the bootstrap platform administrator.",
  superAdminPasswordConfirm: "Confirmation value for the administrator password.",
  swaggerUiEnabled: "Enable or disable Swagger UI exposure in selected non-production profiles.",
  swaggerProfiles: "Non-production profiles where Swagger UI endpoints are exposed.",
  externalIamEnabled: "Enable authentication delegation to external IAM providers.",
  externalIamProviderId: "Technical identifier of the external IAM provider.",
  externalIamIssuerUri: "OpenID Connect issuer URL used to validate tokens.",
  externalIamClientId: "Client identifier registered in the external IAM provider.",
  externalIamClientSecret: "Client secret used for external IAM token exchange.",
  externalIamClientSecretConfirm: "Confirmation value for the external IAM client secret.",
  externalIamSharedSecret: "Shared signing secret used for HS-based token validation.",
  externalIamSharedSecretConfirm: "Confirmation value for the external IAM shared secret.",
  externalIamUsernameClaim: "JWT claim used to resolve username from IAM tokens.",
  externalIamEmailClaim: "JWT claim used to resolve email from IAM tokens.",
  sessionSecurityEnabled: "Enable session risk detection based on user device activity.",
  sessionSecurityWindowMinutes: "Time window used for suspicious session analysis.",
  sessionSecurityMaxDistinctDevices: "Maximum tolerated distinct devices per analysis window.",
  organizationHierarchyEnabled: "Organization hierarchy module used by assignment strategies.",
  organizationDefaultAssignmentStrategy: "Default runtime strategy used for hierarchy-aware task assignment.",
  organizationMaxTraversalDepth: "Maximum hierarchy depth explored during user resolution.",
  notificationsEnabled: "Email notification workflows and auditing channel.",
  notificationsSenderAddress: "Default sender email address used for generated notifications.",
  notificationsAuditEnabled: "Enable persistence of notification events for traceability.",
  liquibaseEnabled: "Enable Liquibase-driven database migration baseline.",
  liquibaseChangelogPath: "Master Liquibase changelog location loaded at runtime.",
  liquibaseContexts: "Liquibase execution contexts separated by comma.",
  processModelingEnabled: "Enable ProOWeb BPMN model catalog and source generation lifecycle.",
  processVersioningStrategy: "Versioning policy used for process model evolution.",
  processMaxVersionsPerModel: "Maximum retained versions per process model.",
  processAllowDirectDeployment: "Allow direct deployment from draft state.",
  backendBddCucumberEnabled: "Generate Spring Boot Cucumber BDD end-to-end test scaffolding.",
  frontendE2eCypressEnabled: "Generate Cypress end-to-end frontend test scaffolding.",
  mode: "Reconfiguration scope. Full mode updates application and infrastructure artifacts.",
  id: "Optional existing override identifier for update operations.",
  targetPath: "Generated project file path targeted by this template override.",
  sourcePath: "Optional source file storing override content under .prooweb.",
  strategy: "Patch strategy applied during generation.",
  priority: "Execution priority. Higher values are applied earlier.",
  enabled: "Enable or disable this override rule.",
  matchText: "Text fragment used as replacement anchor for replace-block strategy.",
  replacementText: "Inline replacement text for replace-block strategy.",
  description: "Human-readable purpose of this override.",
  sourceContent: "Template content persisted and injected during generation.",
  modelKey: "Unique process model technical key.",
  title: "Human-readable process model name.",
  summary: "Version or snapshot summary shown in process lifecycle history.",
  bpmnXml: "BPMN XML source used to create or update a process version.",
  sourceVersion: "Source version used for comparison.",
  targetVersion: "Target version used for comparison.",
  versionNumber: "Process model version number.",
  targetStatus: "Desired lifecycle status for selected process version.",
  strictWarnings: "Treat simulation warnings as blocking conditions.",
  maxTimelineSteps: "Maximum timeline entries computed during simulation preview.",
  runSimulation: "Run simulation gate before promotion.",
  runQualityGates: "Run automated quality gates and coverage checks.",
  deployOnPass: "Automatically deploy when promotion gates pass.",
  commandProfile: "Verification command profile used by promotion pipeline.",
  backendLinePct: "Minimum backend line coverage percentage required to pass.",
  frontendLinePct: "Minimum frontend line coverage percentage required to pass.",
  overallLinePct: "Minimum aggregate line coverage percentage required to pass.",
  requireCoverageReports: "Require explicit coverage reports to validate quality gates.",
  promotionId: "Optional explicit promotion identifier for rollback.",
  force: "Force rollback even when deployment head changed.",
  processActivityId: "Technical BPMN activity identifier currently selected in the diagram.",
  processActivityKind: "BPMN element type of the selected activity.",
  processActivityType: "Execution mode of the selected activity (manual or automatic).",
  processCandidateRoles: "Roles allowed to execute the selected manual activity.",
  processAssignmentMode: "Assignment mode for task allocation (automatic or manual assignment).",
  processAssignmentStrategy: "Strategy used to resolve concrete assignees from roles and hierarchy.",
  processAllowPreviouslyAssigned: "Allow assignment to users already assigned earlier in this process instance.",
  processManualAssignerRoles: "Roles authorized to manually assign task execution to users.",
  processMaxAssignees: "Maximum assignee count considered for this activity resolution.",
  processAutomaticTaskType: "Automatic task type from the maintained ProOWeb task catalog.",
  processAutomaticHandlerRef: "Generated runtime handler reference for automatic execution.",
  processAutomaticTriggerMode: "Trigger policy for automatic tasks (manual, immediate, or deferred).",
  processAutomaticDelayMinutes: "Delay in minutes before deferred automatic execution.",
  processAutomaticConfigurationJson: "Task-type specific configuration payload stored with this activity.",
  processInputSources: "Source resolution rules feeding input data into this activity.",
  processOutputStorage: "Storage target for produced output data (instance, shared, or both).",
  processOutputMappings: "Output mapping rules from activity results to storage targets.",
  processActivityViewerRoles: "Roles allowed to view the activity in process timelines.",
  processDataViewerRoles: "Roles allowed to view data produced by this activity.",
  processAutoTaskKey: "Unique key of the automatic task type in the shared catalog.",
  processAutoTaskDisplay: "Human-readable name displayed in automatic task pickers.",
  processAutoTaskKind: "Task type nature: built-in runtime behavior or custom source-backed.",
  processAutoTaskCategory: "Logical category used to organize automatic task types.",
  processAutoTaskEnabled: "Enable or disable this automatic task type for modelers.",
  processAutoTaskDescription: "Functional description of what this automatic task type executes.",
  processAutoTaskDependencies: "Comma-separated library keys required by this automatic task type.",
  processAutoTaskInputSources: "Allowed input source types consumed by this task type.",
  processAutoTaskMinSources: "Minimum number of input sources required by this task type.",
  processAutoTaskOutputStorage: "Default output storage strategy used by this task type.",
  processAutoTaskConfigSchema: "JSON schema defining configuration keys required by this task type.",
};

const BLOCK_INFORMATION = {
  "workspace-overview": "Information: Workspace summary, stack snapshot, and quick operational actions.",
  management: "Information: Migration controls to align generated sources with the current editor version.",
  reconfigure: "Information: Platform capability settings and managed regeneration options.",
  "template-governance": "Information: Override registry used to customize generated templates safely.",
  "process-model": "Information: BPMN modeling, version lifecycle, simulation, promotion, and deployment actions.",
  codegen: "Information: Developer command shortcuts for build, test, and runtime execution.",
  deployment: "Information: Generated repository layout and managed artifact structure.",
};

const REQUIRED_FIELD_NAMES_BY_FORM = {
  "init-form": [
    "projectTitle",
    "basePackage",
    "backendTech",
    "frontendWebTech",
    "frontendMobileTech",
    "databaseTech",
    "superAdminName",
    "superAdminEmail",
    "superAdminUsername",
    "superAdminPassword",
    "superAdminPasswordConfirm",
    "organizationDefaultAssignmentStrategy",
    "organizationMaxTraversalDepth",
    "notificationsSenderAddress",
    "processVersioningStrategy",
    "processMaxVersionsPerModel",
    "liquibaseChangelogPath",
    "liquibaseContexts",
  ],
  "reconfigure-form": [
    "basePackage",
    "mode",
    "organizationDefaultAssignmentStrategy",
    "organizationMaxTraversalDepth",
    "notificationsSenderAddress",
    "liquibaseChangelogPath",
    "liquibaseContexts",
    "processVersioningStrategy",
    "processMaxVersionsPerModel",
  ],
  "template-override-form": ["targetPath", "strategy", "priority"],
  "process-model-create-form": ["modelKey", "title"],
  "process-model-version-form": ["modelKey"],
  "process-model-diff-form": ["modelKey", "sourceVersion", "targetVersion"],
  "process-model-transition-form": ["modelKey", "versionNumber", "targetStatus"],
  "process-model-deploy-form": ["modelKey", "versionNumber"],
  "process-model-simulate-form": ["modelKey", "versionNumber", "maxTimelineSteps"],
  "process-model-promote-form": [
    "modelKey",
    "versionNumber",
    "commandProfile",
    "backendLinePct",
    "overallLinePct",
  ],
  "process-model-rollback-form": ["modelKey", "versionNumber"],
  "process-model-undeploy-form": ["modelKey", "versionNumber"],
  "process-model-runtime-contract-form": ["modelKey", "versionNumber"],
  "process-model-data-contract-form": ["modelKey", "versionNumber"],
  "process-auto-task-form": ["processAutoTaskKey", "processAutoTaskDisplay"],
};

const ALWAYS_ENABLED_TOGGLES = [
  {
    id: "organization-hierarchy-toggle",
    fieldName: "organizationHierarchyEnabled",
    lockMessage:
      "Information: Organization hierarchy is mandatory in ProOWeb and remains enabled by design.",
  },
  {
    id: "notifications-toggle",
    fieldName: "notificationsEnabled",
    lockMessage:
      "Information: Notification workflows are mandatory in ProOWeb and remain enabled by design.",
  },
  {
    id: "process-modeling-toggle",
    fieldName: "processModelingEnabled",
    lockMessage:
      "Information: BPMN process catalog and process versioning are mandatory in ProOWeb and remain enabled by design.",
  },
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function resolveFieldDescription(name, labelText, required) {
  const predefined = FIELD_INFORMATION[name];
  if (predefined) {
    return `Information: ${predefined}${required ? " This field is required." : ""}`;
  }

  const defaultLabel = labelText ? labelText.toLowerCase() : name;
  return `Information: Configure ${defaultLabel}.${required ? " This field is required." : ""}`;
}

function ensureInfoBadge(hostElement, tooltipText, documentRef) {
  if (!hostElement || hostElement.querySelector(":scope > .info-tooltip-badge")) {
    return;
  }

  const badge = documentRef.createElement("span");
  badge.className = "info-tooltip-badge";
  badge.tabIndex = 0;
  badge.setAttribute("role", "note");
  badge.title = tooltipText;
  badge.setAttribute("aria-label", tooltipText);
  badge.textContent = "i";
  hostElement.appendChild(badge);
}

function ensureRequiredMarker(labelElement, documentRef) {
  if (!labelElement || labelElement.querySelector(":scope > .required-indicator")) {
    return;
  }

  const marker = documentRef.createElement("span");
  marker.className = "required-indicator";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "*";
  labelElement.appendChild(marker);
}

function resolveLabelText(labelElement) {
  if (!labelElement) {
    return "";
  }

  const clone = labelElement.cloneNode(true);
  for (const control of clone.querySelectorAll("input, select, textarea, .info-tooltip-badge, .required-indicator")) {
    control.remove();
  }

  return normalizeText(clone.textContent || "");
}

function findControlInLabel(labelElement) {
  return labelElement?.querySelector("input[name], select[name], textarea[name]") || null;
}

function enforceRequiredRules(documentRef) {
  for (const [formId, fieldNames] of Object.entries(REQUIRED_FIELD_NAMES_BY_FORM)) {
    const form = documentRef.getElementById(formId);
    if (!form) {
      continue;
    }

    for (const fieldName of fieldNames) {
      const control = form.querySelector(`[name="${fieldName}"]`);
      if (!control) {
        continue;
      }
      control.required = true;
      control.setAttribute("aria-required", "true");
    }
  }
}

function enforceAlwaysEnabledToggles(documentRef) {
  for (const toggleConfig of ALWAYS_ENABLED_TOGGLES) {
    const toggle = documentRef.getElementById(toggleConfig.id);
    if (!toggle) {
      continue;
    }

    toggle.checked = true;
    toggle.disabled = true;
    toggle.setAttribute("aria-disabled", "true");
    toggle.title = toggleConfig.lockMessage;

    const fieldset = toggle.closest("fieldset");
    if (fieldset) {
      fieldset.title = toggleConfig.lockMessage;
    }

    const label = toggle.closest("label");
    if (label) {
      ensureInfoBadge(label, toggleConfig.lockMessage, documentRef);
    }
  }
}

function applyFieldTooltips(documentRef) {
  const labels = Array.from(documentRef.querySelectorAll("form label"));
  for (const labelElement of labels) {
    const control = findControlInLabel(labelElement);
    if (!control) {
      continue;
    }

    const name = String(control.getAttribute("name") || "");
    if (!name) {
      continue;
    }

    const labelText = resolveLabelText(labelElement);
    const tooltip = resolveFieldDescription(name, labelText, Boolean(control.required));
    labelElement.title = tooltip;
    control.title = tooltip;
    ensureInfoBadge(labelElement, tooltip, documentRef);

    if (control.required) {
      ensureRequiredMarker(labelElement, documentRef);
    }
  }
}

function resolveBlockTooltip(blockElement) {
  if (!blockElement) {
    return "";
  }

  const byId = BLOCK_INFORMATION[blockElement.id];
  if (byId) {
    return byId;
  }

  const heading = blockElement.querySelector(":scope > h2, :scope > h3, :scope > h4");
  const headingText = normalizeText(heading?.textContent || blockElement.id || "this block");
  return `Information: This action block manages ${headingText.toLowerCase()}.`;
}

function applyBlockTooltips(documentRef) {
  const blocks = Array.from(
    documentRef.querySelectorAll("main.content section.panel, .process-studio, .process-card, .panel.form-panel"),
  );
  for (const block of blocks) {
    const tooltip = resolveBlockTooltip(block);
    block.title = tooltip;

    const heading = block.querySelector(":scope > h2, :scope > h3, :scope > h4");
    if (heading) {
      heading.title = tooltip;
      ensureInfoBadge(heading, tooltip, documentRef);
    }
  }
}

function applyActionElementTooltips(documentRef) {
  const actionElements = Array.from(
    documentRef.querySelectorAll("button, a.nav-link, a.secondary-link"),
  );

  for (const element of actionElements) {
    if (normalizeText(element.getAttribute("title"))) {
      continue;
    }

    const label = normalizeText(element.textContent || "");
    if (!label) {
      continue;
    }

    element.title = `Information: ${label}.`;
  }
}

function wireNativeFormValidation(documentRef) {
  const forms = Array.from(documentRef.querySelectorAll("form"));
  for (const form of forms) {
    if (form.dataset.validationWired === "true") {
      continue;
    }
    form.dataset.validationWired = "true";

    form.addEventListener(
      "submit",
      (event) => {
        if (form.checkValidity()) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid && typeof firstInvalid.reportValidity === "function") {
          firstInvalid.reportValidity();
        }

        const feedback = form.querySelector(".feedback");
        if (feedback) {
          feedback.classList.remove("success");
          feedback.classList.add("error");
          feedback.textContent = "Please complete all required fields and fix invalid values.";
        }
      },
      true,
    );
  }
}

function wirePasswordConfirmations(documentRef) {
  const confirmationFields = Array.from(
    documentRef.querySelectorAll('input[type="password"][data-confirm-for]'),
  );

  for (const confirmationField of confirmationFields) {
    if (confirmationField.dataset.confirmationWired === "true") {
      continue;
    }
    confirmationField.dataset.confirmationWired = "true";

    const targetName = String(confirmationField.getAttribute("data-confirm-for") || "");
    if (!targetName) {
      continue;
    }

    const form = confirmationField.closest("form");
    const targetField = form?.querySelector(`input[type="password"][name="${targetName}"]`) || null;
    if (!targetField) {
      continue;
    }

    const sync = () => {
      const sourceValue = String(targetField.value || "");
      const confirmValue = String(confirmationField.value || "");
      const hasMandatoryConstraint = targetField.required || confirmationField.required;
      const hasAnyValue = sourceValue.length > 0 || confirmValue.length > 0;
      const shouldValidate = hasMandatoryConstraint || hasAnyValue;
      const matches = sourceValue === confirmValue;

      if (!shouldValidate || matches) {
        confirmationField.setCustomValidity("");
        return;
      }

      confirmationField.setCustomValidity("Password confirmation must match.");
    };

    targetField.addEventListener("input", sync);
    targetField.addEventListener("change", sync);
    confirmationField.addEventListener("input", sync);
    confirmationField.addEventListener("change", sync);
    sync();
  }
}

export function applyWorkspaceUxHints({ documentRef = document } = {}) {
  enforceRequiredRules(documentRef);
  enforceAlwaysEnabledToggles(documentRef);
  applyFieldTooltips(documentRef);
  applyBlockTooltips(documentRef);
  applyActionElementTooltips(documentRef);
  wirePasswordConfirmations(documentRef);
  wireNativeFormValidation(documentRef);
}
