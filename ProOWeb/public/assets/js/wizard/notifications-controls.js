function toggleNotificationsInputs(configContainer, enabled) {
  const inputs = configContainer.querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    input.disabled = !enabled;
  }
}

export function wireNotificationsControls(form) {
  if (!form) {
    return;
  }

  const toggle = form.querySelector("#notifications-toggle");
  const configContainer = form.querySelector("#notifications-config");
  if (!toggle || !configContainer) {
    return;
  }

  const sync = () => {
    toggleNotificationsInputs(configContainer, toggle.checked);
  };

  toggle.addEventListener("change", sync);
  sync();
}

