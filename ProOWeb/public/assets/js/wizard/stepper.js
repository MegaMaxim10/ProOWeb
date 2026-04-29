function clampStep(index, total) {
  if (index < 0) {
    return 0;
  }

  if (index >= total) {
    return total - 1;
  }

  return index;
}

function getStepTitle(trackButtons, index) {
  const button = trackButtons[index];
  const label = button?.textContent || "";
  return label.replace(/^\s*\d+\.\s*/, "").trim() || `Step ${index + 1}`;
}

function validateStep(stepElement) {
  if (!stepElement) {
    return true;
  }

  const controls = Array.from(stepElement.querySelectorAll("input, select, textarea"));
  for (const control of controls) {
    if (control.disabled || typeof control.checkValidity !== "function") {
      continue;
    }

    if (!control.checkValidity()) {
      if (typeof control.reportValidity === "function") {
        control.reportValidity();
      }
      return false;
    }
  }

  return true;
}

export function createWizardStepper({
  form,
  trackElement,
  progressLabel,
  previousButton,
  nextButton,
  submitButton,
  onStepChange,
} = {}) {
  const steps = Array.from(form?.querySelectorAll("[data-wizard-step]") || []);
  const trackButtons = Array.from(trackElement?.querySelectorAll("[data-step-jump]") || []);

  if (!form || steps.length === 0) {
    return {
      validateAllSteps: () => true,
    };
  }

  let currentStepIndex = 0;
  const stepTitles = steps.map((_, index) => getStepTitle(trackButtons, index));

  function emitStepChange() {
    if (typeof onStepChange !== "function") {
      return;
    }

    onStepChange({
      currentStepIndex,
      totalSteps: steps.length,
      stepTitle: stepTitles[currentStepIndex] || `Step ${currentStepIndex + 1}`,
      stepTitles,
    });
  }

  function renderStepState(stepIndex, { focusFirstField = false } = {}) {
    currentStepIndex = clampStep(stepIndex, steps.length);

    for (let index = 0; index < steps.length; index += 1) {
      const isActive = index === currentStepIndex;
      const step = steps[index];
      step.hidden = !isActive;
      step.classList.toggle("is-active", isActive);
      step.setAttribute("aria-hidden", String(!isActive));
    }

    for (let index = 0; index < trackButtons.length; index += 1) {
      const button = trackButtons[index];
      const isActive = index === currentStepIndex;
      const isComplete = index < currentStepIndex;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-complete", isComplete);
      if (isActive) {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
    }

    if (previousButton) {
      previousButton.disabled = currentStepIndex === 0;
    }

    if (nextButton) {
      nextButton.hidden = currentStepIndex === steps.length - 1;
    }

    if (submitButton) {
      submitButton.hidden = currentStepIndex !== steps.length - 1;
    }

    if (progressLabel) {
      progressLabel.textContent = `Step ${currentStepIndex + 1} of ${steps.length}: ${getStepTitle(trackButtons, currentStepIndex)}`;
    }

    if (focusFirstField) {
      const firstField = steps[currentStepIndex].querySelector("input, select, textarea");
      if (firstField && typeof firstField.focus === "function") {
        firstField.focus();
      }
    }

    emitStepChange();
  }

  function canReachStep(targetStepIndex) {
    const safeTarget = clampStep(targetStepIndex, steps.length);
    if (safeTarget <= currentStepIndex) {
      return true;
    }

    for (let index = currentStepIndex; index < safeTarget; index += 1) {
      if (!validateStep(steps[index])) {
        renderStepState(index, { focusFirstField: true });
        return false;
      }
    }

    return true;
  }

  function goToStep(stepIndex, { focusFirstField = false } = {}) {
    const safeIndex = clampStep(stepIndex, steps.length);
    if (!canReachStep(safeIndex)) {
      return false;
    }

    renderStepState(safeIndex, { focusFirstField });
    return true;
  }

  previousButton?.addEventListener("click", () => {
    renderStepState(currentStepIndex - 1, { focusFirstField: true });
  });

  nextButton?.addEventListener("click", () => {
    goToStep(currentStepIndex + 1, { focusFirstField: true });
  });

  for (const button of trackButtons) {
    button.addEventListener("click", () => {
      const targetIndex = Number.parseInt(button.dataset.stepJump || "0", 10);
      goToStep(targetIndex, { focusFirstField: true });
    });
  }

  renderStepState(0);

  return {
    getCurrentStepIndex() {
      return currentStepIndex;
    },
    getTotalSteps() {
      return steps.length;
    },
    getStepTitles() {
      return stepTitles.slice();
    },
    validateAllSteps() {
      for (let index = 0; index < steps.length; index += 1) {
        if (!validateStep(steps[index])) {
          renderStepState(index, { focusFirstField: true });
          return false;
        }
      }
      return true;
    },
  };
}
