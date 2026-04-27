function toggleLiquibaseInputs(configContainer, enabled) {
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
  }
}

export function wireLiquibaseControls(form) {
  if (!form) {
    return;
  }

  const toggle = form.querySelector("#liquibase-toggle");
  const configContainer = form.querySelector("#liquibase-config");
  if (!toggle || !configContainer) {
    return;
  }

  const sync = () => {
    toggleLiquibaseInputs(configContainer, toggle.checked);
  };

  toggle.addEventListener("change", sync);
  sync();
}

