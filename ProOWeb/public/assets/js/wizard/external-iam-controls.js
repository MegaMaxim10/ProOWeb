function toggleExternalIamInputs(configContainer, enabled) {
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
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

