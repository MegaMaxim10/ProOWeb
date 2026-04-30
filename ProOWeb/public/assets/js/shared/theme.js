const THEME_STORAGE_KEY = "prooweb:studio-theme";
const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};

function resolveLocalStorage(windowRef) {
  try {
    return windowRef?.localStorage || null;
  } catch (_) {
    return null;
  }
}

function detectPreferredTheme(windowRef) {
  if (windowRef?.matchMedia?.("(prefers-color-scheme: dark)")?.matches) {
    return THEMES.DARK;
  }
  return THEMES.LIGHT;
}

function normalizeTheme(theme) {
  return theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
}

function readStoredTheme(storage) {
  if (!storage) {
    return null;
  }
  const value = storage.getItem(THEME_STORAGE_KEY);
  if (value !== THEMES.DARK && value !== THEMES.LIGHT) {
    return null;
  }
  return value;
}

function persistTheme(storage, theme) {
  if (!storage) {
    return;
  }
  storage.setItem(THEME_STORAGE_KEY, theme);
}

function updateButtonLabel(button, theme) {
  if (!button) {
    return;
  }
  const isDark = theme === THEMES.DARK;
  const nextLabel = isDark ? "Light theme" : "Dark theme";
  button.setAttribute("aria-label", `Switch to ${nextLabel.toLowerCase()}`);
  button.title = `Switch ProOWeb visual theme to ${nextLabel.toLowerCase()}.`;
  // Update icon visibility if the button has sun/moon icons
  const sunIcon = button.querySelector(".theme-icon-sun");
  const moonIcon = button.querySelector(".theme-icon-moon");
  const labelSpan = button.querySelector(".theme-label");
  if (sunIcon) sunIcon.classList.toggle("hidden", !isDark);
  if (moonIcon) moonIcon.classList.toggle("hidden", isDark);
  if (labelSpan) labelSpan.textContent = nextLabel;
}

export function initializeTheme({ documentRef = document, windowRef = window } = {}) {
  const storage = resolveLocalStorage(windowRef);
  const preferredTheme = detectPreferredTheme(windowRef);
  const initialTheme = normalizeTheme(readStoredTheme(storage) || preferredTheme);
  const rootElement = documentRef.documentElement || documentRef.body;
  const toggleButton = documentRef.getElementById("theme-toggle-button");

  function applyTheme(theme) {
    const normalized = normalizeTheme(theme);
    if (normalized === THEMES.DARK) {
      rootElement.classList.add("dark");
    } else {
      rootElement.classList.remove("dark");
    }
    updateButtonLabel(toggleButton, normalized);
    persistTheme(storage, normalized);
    return normalized;
  }

  let currentTheme = applyTheme(initialTheme);

  if (toggleButton && toggleButton.dataset.themeWired !== "true") {
    toggleButton.dataset.themeWired = "true";
    toggleButton.addEventListener("click", () => {
      currentTheme = applyTheme(currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
    });
  }

  return {
    getTheme() {
      return currentTheme;
    },
    setTheme(theme) {
      currentTheme = applyTheme(theme);
      return currentTheme;
    },
  };
}
