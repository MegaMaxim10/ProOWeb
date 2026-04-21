export function wireSwaggerControls(form) {
  const toggle = form.querySelector("#swagger-toggle");
  const profileInputs = Array.from(form.querySelectorAll('input[name="swaggerProfiles"]'));

  function syncState() {
    const enabled = Boolean(toggle?.checked);

    for (const input of profileInputs) {
      input.disabled = !enabled;
      if (!enabled) {
        input.checked = false;
      }
    }
  }

  toggle?.addEventListener("change", syncState);
  syncState();
}
