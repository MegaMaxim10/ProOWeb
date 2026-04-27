function toggleSessionSecurityInputs(configContainer, enabled) {
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
  }
}

export function wireSessionSecurityControls(form) {
  if (!form) {
    return;
  }

  const toggle = form.querySelector("#session-security-toggle");
  const configContainer = form.querySelector("#session-security-config");
  if (!toggle || !configContainer) {
    return;
  }

  const sync = () => {
    toggleSessionSecurityInputs(configContainer, toggle.checked);
  };

  toggle.addEventListener("change", sync);
  sync();
}

