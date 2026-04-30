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
  "workspace-dashboard": "Information: Workspace summary, stack snapshot, and quick operational actions.",
  "workspace-platform-info": "Information: Platform details, administrator bootstrap metadata, and capability configuration snapshot.",
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

const TOOLTIP_ATTRIBUTE = "data-prooweb-tooltip";
const TOOLTIP_LAYER_ID = "prooweb-tooltip-layer";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferExpectedValue(control, labelText) {
  const placeholder = normalizeText(control?.getAttribute("placeholder") || "");
  if (placeholder) {
    return placeholder;
  }

  const type = normalizeText(control?.getAttribute("type") || "").toLowerCase();
  if (type === "email") {
    return "A valid email address used by the generated platform.";
  }
  if (type === "url") {
    return "A full URL including protocol (for example https://...).";
  }
  if (type === "number") {
    const min = normalizeText(control?.getAttribute("min") || "");
    const max = normalizeText(control?.getAttribute("max") || "");
    if (min || max) {
      return `A numeric value${min ? ` >= ${min}` : ""}${max ? ` and <= ${max}` : ""}.`;
    }
    return "A numeric value.";
  }
  if (type === "password") {
    return "A secure secret value.";
  }
  if (control?.tagName?.toLowerCase() === "select") {
    return "Select the option that best matches your project policy.";
  }
  if (control?.tagName?.toLowerCase() === "textarea") {
    return "Structured content expected by this action.";
  }

  return `A value for ${labelText || "this field"}.`;
}

function inferSourceHint(fieldName, formId) {
  const name = normalizeText(fieldName).toLowerCase();
  const form = normalizeText(formId).toLowerCase();

  if (name.includes("email")) {
    return "Usually provided by your organization or identity provider settings.";
  }
  if (name.includes("issuer") || name.includes("client") || name.includes("secret")) {
    return "Provided by your IAM provider registration console.";
  }
  if (name.includes("basepackage")) {
    return "Defined by your Java naming conventions and repository architecture.";
  }
  if (name.includes("roles")) {
    return "Use role codes already defined in your RBAC design.";
  }
  if (name.includes("changelog") || name.includes("liquibase")) {
    return "Taken from your database migration structure in the repository.";
  }
  if (form.includes("process")) {
    return "Derived from your process model design and runtime governance rules.";
  }
  if (form.includes("template")) {
    return "Comes from your override strategy and target source file location.";
  }

  return "Comes from your project requirements and platform governance choices.";
}

function inferFormatHint(control) {
  const type = normalizeText(control?.getAttribute("type") || "").toLowerCase();
  const step = normalizeText(control?.getAttribute("step") || "");
  const required = control?.required;

  if (type === "checkbox") {
    return "Toggle on/off according to the feature policy.";
  }
  if (type === "number") {
    return `Use digits only${step ? ` (step ${step})` : ""}.`;
  }
  if (type === "email") {
    return "Must follow the email format local-part@domain.";
  }
  if (type === "url") {
    return "Must include protocol and host.";
  }
  if (control?.tagName?.toLowerCase() === "textarea") {
    return "Use the exact syntax shown in the placeholder or examples.";
  }
  if (control?.tagName?.toLowerCase() === "select") {
    return "Choose one predefined value.";
  }

  return required ? "Required field." : "Optional field.";
}

function resolveFieldDescription(name, labelText, required, control, formId = "") {
  const predefined = FIELD_INFORMATION[name];
  const summary = predefined || `Configure ${labelText ? labelText.toLowerCase() : name}.`;
  const expected = inferExpectedValue(control, labelText);
  const source = inferSourceHint(name, formId);
  const format = inferFormatHint(control);

  if (predefined) {
    return [
      `Information: ${summary}`,
      `Expected: ${expected}`,
      `Source: ${source}`,
      `Format: ${format}`,
      required ? "Requirement: This field is mandatory." : "Requirement: This field is optional.",
    ].join("\n");
  }

  return [
    `Information: ${summary}`,
    `Expected: ${expected}`,
    `Source: ${source}`,
    `Format: ${format}`,
    required ? "Requirement: This field is mandatory." : "Requirement: This field is optional.",
  ].join("\n");
}

function setTooltipDescriptor(element, tooltipText) {
  if (!element) {
    return;
  }

  const text = normalizeText(tooltipText);
  if (!text) {
    element.removeAttribute(TOOLTIP_ATTRIBUTE);
    return;
  }

  element.setAttribute(TOOLTIP_ATTRIBUTE, tooltipText);
  element.removeAttribute("title");
}

function ensureInfoBadge(hostElement, tooltipText, documentRef) {
  if (!hostElement || hostElement.querySelector(":scope > .info-tooltip-badge")) {
    return;
  }

  const badge = documentRef.createElement("span");
  badge.className = "info-tooltip-badge";
  badge.tabIndex = 0;
  badge.setAttribute("role", "note");
  badge.setAttribute("aria-label", tooltipText);
  setTooltipDescriptor(badge, tooltipText);
  badge.textContent = "i";

  const isInlineRow = hostElement.classList.contains("pw-inline-row")
    || hostElement.classList.contains("inline-row");
  const firstControl = !isInlineRow && hostElement.querySelector(":scope > input, :scope > select, :scope > textarea");
  const isLeadingToggle = firstControl
    && (firstControl.matches('input[type="checkbox"]') || firstControl.matches('input[type="radio"]'));
  if (firstControl && !isLeadingToggle) {
    hostElement.insertBefore(badge, firstControl);
  } else {
    hostElement.appendChild(badge);
  }
}

function ensureRequiredMarker(labelElement, documentRef) {
  if (!labelElement || labelElement.querySelector(":scope > .required-indicator")) {
    return;
  }

  const marker = documentRef.createElement("span");
  marker.className = "required-indicator";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "*";

  const isInlineRow = labelElement.classList.contains("pw-inline-row")
    || labelElement.classList.contains("inline-row");
  const firstControl = !isInlineRow && labelElement.querySelector(":scope > input, :scope > select, :scope > textarea");
  const isLeadingToggle = firstControl
    && (firstControl.matches('input[type="checkbox"]') || firstControl.matches('input[type="radio"]'));
  if (firstControl && !isLeadingToggle) {
    labelElement.insertBefore(marker, firstControl);
  } else {
    labelElement.appendChild(marker);
  }
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
    setTooltipDescriptor(toggle, toggleConfig.lockMessage);

    const fieldset = toggle.closest("fieldset");
    if (fieldset) {
      setTooltipDescriptor(fieldset, toggleConfig.lockMessage);
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
    const formId = normalizeText(control.closest("form")?.id || "");

    const labelText = resolveLabelText(labelElement);
    const tooltip = resolveFieldDescription(name, labelText, Boolean(control.required), control, formId);
    setTooltipDescriptor(labelElement, tooltip);
    setTooltipDescriptor(control, tooltip);
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
    return [
      byId,
      "Purpose: Group related actions so you can complete one development concern at a time.",
      "How to use: Read each form/action from top to bottom and run the related command.",
    ].join("\n");
  }

  const heading = blockElement.querySelector(":scope > h2, :scope > h3, :scope > h4");
  const headingText = normalizeText(heading?.textContent || blockElement.id || "this block");
  return [
    `Information: This action block manages ${headingText.toLowerCase()}.`,
    "Purpose: Keep workflow actions grouped by concern.",
    "How to use: Fill required fields, execute, and review feedback before moving on.",
  ].join("\n");
}

function applyBlockTooltips(documentRef) {
  const blocks = Array.from(
    documentRef.querySelectorAll("main.content section.panel, .process-studio, .process-card, .panel.form-panel"),
  );
  for (const block of blocks) {
    const tooltip = resolveBlockTooltip(block);
    setTooltipDescriptor(block, tooltip);

    const heading = block.querySelector(":scope > h2, :scope > h3, :scope > h4");
    if (heading) {
      setTooltipDescriptor(heading, tooltip);
      ensureInfoBadge(heading, tooltip, documentRef);
    }
  }
}

function applyActionElementTooltips(documentRef) {
  const actionElements = Array.from(
    documentRef.querySelectorAll("button, a.nav-link, a.secondary-link"),
  );

  for (const element of actionElements) {
    if (normalizeText(element.getAttribute(TOOLTIP_ATTRIBUTE))) {
      continue;
    }

    const label = normalizeText(element.textContent || "");
    if (!label) {
      continue;
    }

    setTooltipDescriptor(element, `Information: ${label}.`);
  }
}

function wireTooltipLayer(documentRef) {
  const body = documentRef.body;
  if (!body || body.dataset.proowebTooltipWired === "true") {
    return;
  }
  body.dataset.proowebTooltipWired = "true";

  const windowRef = documentRef.defaultView || window;
  const tooltipLayer = documentRef.createElement("div");
  tooltipLayer.id = TOOLTIP_LAYER_ID;
  tooltipLayer.className = "prooweb-tooltip-layer";
  tooltipLayer.setAttribute("role", "tooltip");
  tooltipLayer.setAttribute("aria-hidden", "true");
  body.appendChild(tooltipLayer);

  let activeTarget = null;

  function hideTooltip() {
    activeTarget = null;
    tooltipLayer.classList.remove("is-visible");
    tooltipLayer.setAttribute("aria-hidden", "true");
  }

  function positionTooltip(targetElement) {
    if (!targetElement) {
      return;
    }

    const margin = 10;
    const rect = targetElement.getBoundingClientRect();
    const viewportWidth = Math.max(windowRef.innerWidth || 0, 320);
    const viewportHeight = Math.max(windowRef.innerHeight || 0, 240);
    const tooltipWidth = tooltipLayer.offsetWidth || 320;
    const tooltipHeight = tooltipLayer.offsetHeight || 48;

    let left = rect.left + (rect.width / 2);
    left = left - tooltipWidth / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));

    let top = rect.top - tooltipHeight - margin;
    if (top < margin) {
      top = rect.bottom + margin;
    }
    if (top + tooltipHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - tooltipHeight - margin);
    }

    tooltipLayer.style.left = `${Math.round(left)}px`;
    tooltipLayer.style.top = `${Math.round(top)}px`;
  }

  function showTooltip(targetElement) {
    const tooltipText = targetElement?.getAttribute(TOOLTIP_ATTRIBUTE);
    if (!normalizeText(tooltipText)) {
      hideTooltip();
      return;
    }

    activeTarget = targetElement;
    tooltipLayer.textContent = tooltipText;
    tooltipLayer.classList.add("is-visible");
    tooltipLayer.setAttribute("aria-hidden", "false");
    positionTooltip(targetElement);
  }

  function toggleTooltip(targetElement) {
    if (activeTarget === targetElement && tooltipLayer.classList.contains("is-visible")) {
      hideTooltip();
      return;
    }
    showTooltip(targetElement);
  }

  documentRef.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const badge = target?.closest(".info-tooltip-badge") || null;
    if (!badge) {
      hideTooltip();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleTooltip(badge);
  }, true);

  documentRef.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const badge = target?.closest(".info-tooltip-badge") || null;
    if (badge && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleTooltip(badge);
      return;
    }

    if (event.key === "Escape") {
      hideTooltip();
    }
  });

  documentRef.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const badge = target?.closest(".info-tooltip-badge") || null;
    if (badge) {
      return;
    }
    hideTooltip();
  }, true);

  documentRef.addEventListener("contextmenu", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const badge = target?.closest(".info-tooltip-badge") || null;
    if (badge) {
      return;
    }
    hideTooltip();
  }, true);

  windowRef.addEventListener("scroll", hideTooltip, true);
  windowRef.addEventListener("resize", () => {
    if (activeTarget) {
      positionTooltip(activeTarget);
    }
  });
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
  wireTooltipLayer(documentRef);
  wirePasswordConfirmations(documentRef);
  wireNativeFormValidation(documentRef);
}
