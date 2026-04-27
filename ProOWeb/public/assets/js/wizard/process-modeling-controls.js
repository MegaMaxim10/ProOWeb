function toggleProcessModelingInputs(configContainer, enabled) {
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
  }
}

export function wireProcessModelingControls(form) {
  if (!form) {
    return;
  }

  const toggle = form.querySelector("#process-modeling-toggle");
  const configContainer = form.querySelector("#process-modeling-config");
  if (!toggle || !configContainer) {
    return;
  }

  const sync = () => {
    toggleProcessModelingInputs(configContainer, toggle.checked);
  };

  toggle.addEventListener("change", sync);
  sync();
}

