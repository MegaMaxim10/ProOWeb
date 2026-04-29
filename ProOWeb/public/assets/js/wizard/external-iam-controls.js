function toggleExternalIamInputs(configContainer, enabled) {
  const requiredNames = new Set([
    "externalIamProviderId",
    "externalIamIssuerUri",
    "externalIamClientId",
    "externalIamUsernameClaim",
    "externalIamEmailClaim",
  ]);
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
    if (requiredNames.has(input.name)) {
      input.required = enabled;
      input.setAttribute("aria-required", enabled ? "true" : "false");
      const label = input.closest("label");
      if (label) {
        const existingMarker = label.querySelector(":scope > .required-indicator.dynamic-required");
        if (enabled && !existingMarker) {
          const marker = label.ownerDocument.createElement("span");
          marker.className = "required-indicator dynamic-required";
          marker.setAttribute("aria-hidden", "true");
          marker.textContent = "*";
          label.appendChild(marker);
        }
        if (!enabled && existingMarker) {
          existingMarker.remove();
        }
      }
    }
  }
}

export function wireExternalIamControls(form) {
  if (!form) {
    return;
  }

  const toggle = form.querySelector("#external-iam-toggle");
  const configContainer = form.querySelector("#external-iam-config");
  if (!toggle || !configContainer) {
    return;
  }

  const sync = () => {
    toggleExternalIamInputs(configContainer, toggle.checked);
  };

  toggle.addEventListener("change", sync);
  sync();
}
