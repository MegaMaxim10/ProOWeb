function toggleOrganizationHierarchyInputs(configContainer, enabled) {
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
  }
}

export function wireOrganizationHierarchyControls(form) {
  if (!form) {
    return;
  }

  const toggle = form.querySelector("#organization-hierarchy-toggle");
  const configContainer = form.querySelector("#organization-hierarchy-config");
  if (!toggle || !configContainer) {
    return;
  }

  const sync = () => {
    toggleOrganizationHierarchyInputs(configContainer, toggle.checked);
  };

  toggle.addEventListener("change", sync);
  sync();
}

