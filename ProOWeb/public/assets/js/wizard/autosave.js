const DRAFT_STORAGE_KEY = "prooweb:wizard-draft:v1";
const AUTOSAVE_DELAY_MS = 420;
const EXCLUDED_FIELDS = new Set([
  "superAdminPassword",
  "externalIamClientSecret",
  "externalIamSharedSecret",
]);

function safeParseJson(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function resolveStorage(windowRef) {
  try {
    return windowRef?.localStorage || null;
  } catch (_) {
    return null;
  }
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function collectControlsByName(form) {
  const controlsByName = new Map();
  const controls = Array.from(form.querySelectorAll("input[name], select[name], textarea[name]"));
  for (const control of controls) {
    const name = String(control.name || "");
    if (!name || EXCLUDED_FIELDS.has(name)) {
      continue;
    }

    if (!controlsByName.has(name)) {
      controlsByName.set(name, []);
    }
    controlsByName.get(name).push(control);
  }
  return controlsByName;
}

function serializeForm(form) {
  const controlsByName = collectControlsByName(form);
  const values = {};

  for (const [name, controls] of controlsByName) {
    const first = controls[0];
    const type = (first.type || "").toLowerCase();

    if (type === "checkbox" && controls.length > 1) {
      values[name] = controls.filter((control) => control.checked).map((control) => String(control.value || ""));
      continue;
    }

    if (type === "checkbox") {
      values[name] = Boolean(first.checked);
      continue;
    }

    if (type === "radio") {
      const selected = controls.find((control) => control.checked);
      values[name] = selected ? String(selected.value || "") : "";
      continue;
    }

    if (first.tagName === "SELECT" && first.multiple) {
      values[name] = Array.from(first.selectedOptions).map((option) => String(option.value || ""));
      continue;
    }

    values[name] = first.value == null ? "" : String(first.value);
  }

  return values;
}

function restoreForm(form, values) {
  if (!values || typeof values !== "object") {
    return;
  }

  const controlsByName = collectControlsByName(form);
  for (const [name, storedValue] of Object.entries(values)) {
    const controls = controlsByName.get(name);
    if (!controls || controls.length === 0) {
      continue;
    }

    const first = controls[0];
    const type = (first.type || "").toLowerCase();

    if (type === "checkbox" && controls.length > 1) {
      const selectedValues = new Set(Array.isArray(storedValue) ? storedValue.map((value) => String(value)) : []);
      for (const control of controls) {
        control.checked = selectedValues.has(String(control.value || ""));
      }
      continue;
    }

    if (type === "checkbox") {
      first.checked = Boolean(storedValue);
      continue;
    }

    if (type === "radio") {
      const targetValue = storedValue == null ? "" : String(storedValue);
      for (const control of controls) {
        control.checked = String(control.value || "") === targetValue;
      }
      continue;
    }

    if (first.tagName === "SELECT" && first.multiple) {
      const selectedValues = new Set(Array.isArray(storedValue) ? storedValue.map((value) => String(value)) : []);
      for (const option of Array.from(first.options)) {
        option.selected = selectedValues.has(String(option.value || ""));
      }
      continue;
    }

    first.value = storedValue == null ? "" : String(storedValue);
  }
}

function normalizeStepSavedAt(stepSavedAt) {
  if (!stepSavedAt || typeof stepSavedAt !== "object") {
    return {};
  }

  const result = {};
  for (const [key, value] of Object.entries(stepSavedAt)) {
    const parsedKey = Number.parseInt(key, 10);
    if (!Number.isInteger(parsedKey) || parsedKey < 0) {
      continue;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
      continue;
    }
    result[String(parsedKey)] = value;
  }
  return result;
}

function resolveStepIndex(control) {
  const stepElement = control?.closest?.("[data-wizard-step]");
  if (!stepElement) {
    return null;
  }

  const value = Number.parseInt(stepElement.getAttribute("data-wizard-step") || "", 10);
  return Number.isInteger(value) ? value : null;
}

export function createWizardAutosave({
  form,
  trackElement,
  indicatorElement,
  windowRef = window,
} = {}) {
  if (!form) {
    return {
      clear() {},
      flush() {},
      setCurrentStep() {},
    };
  }

  const storage = resolveStorage(windowRef);
  const trackButtons = Array.from(trackElement?.querySelectorAll("[data-step-jump]") || []);

  let timerId = null;
  let pendingStepIndex = null;
  let status = "idle";
  let currentStepIndex = 0;
  let stepSavedAt = {};
  let lastSavedAt = null;

  function renderTrackBadges() {
    for (const button of trackButtons) {
      const stepIndex = Number.parseInt(button.dataset.stepJump || "", 10);
      if (!Number.isInteger(stepIndex)) {
        continue;
      }

      const savedAt = stepSavedAt[String(stepIndex)];
      if (savedAt) {
        button.dataset.draftStatus = "saved";
        button.title = `Draft saved at ${formatTime(savedAt)}`;
      } else {
        delete button.dataset.draftStatus;
        button.removeAttribute("title");
      }
    }
  }

  function renderIndicator() {
    if (!indicatorElement) {
      return;
    }

    indicatorElement.classList.remove("is-saving", "is-saved", "is-error");

    if (status === "saving") {
      indicatorElement.classList.add("is-saving");
      indicatorElement.textContent = "Autosave: saving draft...";
      return;
    }

    if (status === "error") {
      indicatorElement.classList.add("is-error");
      indicatorElement.textContent = "Autosave: unavailable in this browser session.";
      return;
    }

    const currentStepSavedAt = stepSavedAt[String(currentStepIndex)];
    if (currentStepSavedAt) {
      indicatorElement.classList.add("is-saved");
      indicatorElement.textContent = `Autosave: current step saved at ${formatTime(currentStepSavedAt)}.`;
      return;
    }

    if (lastSavedAt) {
      indicatorElement.classList.add("is-saved");
      indicatorElement.textContent = `Autosave: draft available (last save ${formatTime(lastSavedAt)}).`;
      return;
    }

    indicatorElement.textContent = "Autosave: no draft saved yet.";
  }

  function saveDraft(stepIndex) {
    if (!storage) {
      status = "error";
      renderIndicator();
      return;
    }

    const now = new Date().toISOString();
    try {
      if (Number.isInteger(stepIndex) && stepIndex >= 0) {
        stepSavedAt[String(stepIndex)] = now;
      }

      const payload = {
        version: 1,
        savedAt: now,
        stepSavedAt,
        values: serializeForm(form),
      };

      storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      status = "saved";
      lastSavedAt = now;
      renderTrackBadges();
      renderIndicator();
    } catch (_) {
      status = "error";
      renderIndicator();
    }
  }

  function scheduleSave(stepIndex) {
    pendingStepIndex = Number.isInteger(stepIndex) ? stepIndex : pendingStepIndex;
    status = "saving";
    renderIndicator();

    if (timerId) {
      windowRef.clearTimeout(timerId);
    }

    timerId = windowRef.setTimeout(() => {
      timerId = null;
      saveDraft(pendingStepIndex);
      pendingStepIndex = null;
    }, AUTOSAVE_DELAY_MS);
  }

  function flush() {
    if (!timerId) {
      return;
    }

    windowRef.clearTimeout(timerId);
    timerId = null;
    saveDraft(pendingStepIndex);
    pendingStepIndex = null;
  }

  function restore() {
    if (!storage) {
      status = "error";
      renderIndicator();
      return;
    }

    const parsed = safeParseJson(storage.getItem(DRAFT_STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") {
      status = "idle";
      renderIndicator();
      return;
    }

    restoreForm(form, parsed.values);
    stepSavedAt = normalizeStepSavedAt(parsed.stepSavedAt);
    lastSavedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : null;
    status = "saved";
    renderTrackBadges();
    renderIndicator();
  }

  function clear() {
    if (timerId) {
      windowRef.clearTimeout(timerId);
      timerId = null;
    }
    pendingStepIndex = null;

    if (storage) {
      try {
        storage.removeItem(DRAFT_STORAGE_KEY);
      } catch (_) {
        // Ignore cleanup errors.
      }
    }

    stepSavedAt = {};
    lastSavedAt = null;
    status = "idle";
    renderTrackBadges();
    renderIndicator();
  }

  function handleUserEdit(event) {
    const control = event.target;
    if (!control || !control.name || EXCLUDED_FIELDS.has(control.name)) {
      return;
    }

    scheduleSave(resolveStepIndex(control));
  }

  form.addEventListener("input", handleUserEdit);
  form.addEventListener("change", handleUserEdit);
  windowRef.addEventListener("beforeunload", flush);

  restore();

  return {
    clear,
    flush,
    setCurrentStep(stepIndex) {
      if (Number.isInteger(stepIndex) && stepIndex >= 0) {
        currentStepIndex = stepIndex;
      }
      renderIndicator();
    },
  };
}
