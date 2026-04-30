import {
  WORKSPACE_PAGE_VIEWS,
  resolveWorkspacePageByPath,
} from "./page-routes.js";

function normalizeString(value) {
  return String(value || "").trim();
}

function toLower(value) {
  return normalizeString(value).toLowerCase();
}

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

function isEditableElement(target) {
  if (!target) {
    return false;
  }
  const tag = toLower(target.tagName);
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  return Boolean(target.isContentEditable);
}

function resolveLocalStorage(windowRef) {
  try {
    return windowRef?.localStorage || null;
  } catch (_) {
    return null;
  }
}

export function resolveWorkspacePage(windowRef = window) {
  return resolveWorkspacePageByPath(windowRef.location.pathname || "/");
}

function collectCommandEntries(documentRef, windowRef) {
  const entries = [];
  const navLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link"));
  for (const link of navLinks) {
    const href = normalizeString(link.getAttribute("href"));
    const label = normalizeString(link.textContent);
    entries.push({
      type: "navigation",
      label,
      keywords: `${label} ${href}`.trim(),
      run() {
        if (href) {
          windowRef.location.assign(href);
        }
      },
    });
  }

  const shortcutEntries = [
    { label: "Run smart migration", href: "/project/migration-center" },
    { label: "Open process modeling", href: "/processes/new-process-model" },
    { label: "Open shared entities", href: "/data/shared-entities" },
    { label: "Open template governance", href: "/templates" },
  ];

  for (const shortcut of shortcutEntries) {
    entries.push({
      type: "action",
      label: shortcut.label,
      keywords: shortcut.label,
      run() {
        windowRef.location.assign(shortcut.href);
      },
    });
  }

  return entries;
}

function wireTopMenu(documentRef) {
  const groups = Array.from(documentRef.querySelectorAll(".menu-group"));
  if (groups.length === 0) {
    return;
  }

  function isCompactViewport() {
    const viewportWidth = Number(documentRef.defaultView?.innerWidth || 0);
    return viewportWidth <= 539;
  }

  function positionCompactDropdown(group) {
    if (!isCompactViewport() || !(group instanceof Element)) {
      return;
    }
    const dropdown = group.querySelector(":scope > .menu-dropdown");
    if (!(dropdown instanceof HTMLElement)) {
      return;
    }
    // Compact mode is controlled by CSS media query (`top: 48px !important`).
    // Ensure no stale inline top overrides remain from previous sessions.
    dropdown.style.removeProperty("top");
  }

  function refreshOpenDropdownPositions() {
    for (const group of groups) {
      if (group.open) {
        positionCompactDropdown(group);
      }
    }
  }

  function closeOthers(except) {
    for (const group of groups) {
      if (group !== except) {
        group.open = false;
      }
    }
  }

  for (const group of groups) {
    const summary = group.querySelector("summary");
    summary?.addEventListener("click", (event) => {
      if (isCompactViewport()) {
        // Explicit toggle in compact mode to avoid inconsistent native <details>
        // behavior on touch-only / icon-only menu rendering.
        event.preventDefault();
        const willOpen = !group.open;
        closeOthers(group);
        group.open = willOpen;
        if (willOpen) {
          documentRef.defaultView?.requestAnimationFrame(() => {
            positionCompactDropdown(group);
          });
        }
        return;
      }

      closeOthers(group);
      documentRef.defaultView?.requestAnimationFrame(() => {
        if (group.open) {
          positionCompactDropdown(group);
        }
      });
    });
  }

  documentRef.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest(".menu-group")) {
      closeOthers(null);
    }
  });

  documentRef.defaultView?.addEventListener("resize", () => {
    refreshOpenDropdownPositions();
  });
}

function wireContextPage(documentRef, windowRef) {
  const page = resolveWorkspacePage(windowRef);
  const visibleIds = new Set(WORKSPACE_PAGE_VIEWS[page] || WORKSPACE_PAGE_VIEWS["project-dashboard"]);
  documentRef.documentElement?.setAttribute("data-workspace-page", page);
  documentRef.body?.setAttribute("data-workspace-page", page);

  const sections = Array.from(documentRef.querySelectorAll("main.content > section.panel[id]"));
  for (const section of sections) {
    section.classList.toggle("hidden", !visibleIds.has(section.id));
  }

  const navLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link[data-page-link]"));
  for (const link of navLinks) {
    const linkPage = resolveWorkspacePageByPath(link.getAttribute("href") || "");
    link.classList.toggle("is-active", linkPage === page);
  }

  const processSection = documentRef.getElementById("process-model");
  if (processSection) {
    const isDataPage = page === "data-new-shared-entity" || page === "data-shared-entities";
    const isProcessNewPage = page === "processes-new-process-model";
    const isProcessModelsPage = page === "processes-process-models";

    processSection.dataset.mode = isDataPage
      ? "data"
      : (isProcessNewPage ? "new" : (isProcessModelsPage ? "models" : ""));

    const designShells = Array.from(processSection.querySelectorAll(".process-mode-design"));
    const operationShells = Array.from(processSection.querySelectorAll(".process-mode-operations"));
    const sharedEntityStudio = processSection.querySelector(".process-shared-entity-studio");
    const processGrid = processSection.querySelector(".process-grid");
    const processModeNav = processSection.querySelector(".process-mode-nav");

    if (isDataPage) {
      for (const entry of designShells) {
        entry.classList.add("hidden");
      }
      for (const entry of operationShells) {
        entry.classList.add("hidden");
      }
      if (sharedEntityStudio) {
        sharedEntityStudio.classList.remove("hidden");
      }
      if (processGrid) {
        processGrid.classList.add("hidden");
      }
      if (processModeNav) {
        processModeNav.classList.add("hidden");
      }
    } else if (isProcessNewPage) {
      for (const entry of designShells) {
        entry.classList.remove("hidden");
      }
      for (const entry of operationShells) {
        entry.classList.add("hidden");
      }
      if (processGrid) {
        processGrid.classList.remove("hidden");
      }
      if (processModeNav) {
        processModeNav.classList.remove("hidden");
      }
    } else if (isProcessModelsPage) {
      for (const entry of designShells) {
        entry.classList.remove("hidden");
      }
      for (const entry of operationShells) {
        entry.classList.remove("hidden");
      }
      if (processGrid) {
        processGrid.classList.remove("hidden");
      }
      if (processModeNav) {
        processModeNav.classList.remove("hidden");
      }
    }

    const modeLinks = Array.from(processSection.querySelectorAll(".process-mode-nav a[href]"));
    for (const link of modeLinks) {
      const linkPage = resolveWorkspacePageByPath(link.getAttribute("href") || "");
      link.classList.toggle("is-active", linkPage === page);
    }
  }
}

function renderCommandResults(listContainer, entries, query, closeModal) {
  const term = toLower(query);
  const filtered = entries.filter((entry) => {
    if (!term) {
      return true;
    }
    return toLower(entry.label).includes(term) || toLower(entry.keywords).includes(term);
  });

  listContainer.innerHTML = "";

  if (filtered.length === 0) {
    const item = document.createElement("li");
    item.className = "command-empty";
    item.textContent = "No matching action.";
    listContainer.appendChild(item);
    return;
  }

  for (const entry of filtered.slice(0, 24)) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.label;
    button.addEventListener("click", () => {
      closeModal();
      entry.run();
    });
    item.appendChild(button);
    listContainer.appendChild(item);
  }
}

function wireCommandCenter(documentRef, windowRef) {
  const openButton = documentRef.getElementById("command-center-open");
  const closeButton = documentRef.getElementById("command-center-close");
  const modal = documentRef.getElementById("command-center");
  const queryInput = documentRef.getElementById("command-center-query");
  const results = documentRef.getElementById("command-center-results");
  if (!openButton || !closeButton || !modal || !queryInput || !results) {
    return;
  }

  const entries = collectCommandEntries(documentRef, windowRef);
  let previousActiveElement = null;

  const closeModal = () => {
    modal.classList.add("hidden");
    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
  };

  const openModal = () => {
    previousActiveElement = documentRef.activeElement;
    modal.classList.remove("hidden");
    queryInput.value = "";
    renderCommandResults(results, entries, "", closeModal);
    windowRef.setTimeout(() => queryInput.focus(), 0);
  };

  openButton.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  queryInput.addEventListener("input", () => {
    renderCommandResults(results, entries, queryInput.value, closeModal);
  });

  windowRef.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && toLower(event.key) === "k") {
      event.preventDefault();
      if (modal.classList.contains("hidden")) {
        openModal();
      } else {
        closeModal();
      }
      return;
    }

    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      event.preventDefault();
      closeModal();
    }
  });
}

function wireHeaderMigrationProxy(documentRef) {
  const headerMigrateButton = documentRef.getElementById("header-migrate-button");
  const migrateButton = documentRef.getElementById("migrate-button");
  if (!headerMigrateButton || !migrateButton) {
    return;
  }

  const syncState = () => {
    const hidden = migrateButton.classList.contains("hidden");
    headerMigrateButton.classList.toggle("hidden", hidden);
    headerMigrateButton.disabled = hidden || migrateButton.disabled;
  };

  const observer = new MutationObserver(syncState);
  observer.observe(migrateButton, {
    attributes: true,
    attributeFilter: ["class", "disabled"],
  });
  syncState();

  headerMigrateButton.addEventListener("click", () => {
    if (!migrateButton.disabled && !migrateButton.classList.contains("hidden")) {
      migrateButton.click();
    }
  });
}

function wireSectionAccessibilityTitles(documentRef) {
  const sections = Array.from(documentRef.querySelectorAll("main.content section[id]"));
  for (const section of sections) {
    if (!section.getAttribute("aria-label")) {
      const heading = section.querySelector("h2, h3, h4");
      section.setAttribute("aria-label", heading ? normalizeString(heading.textContent) : normalizeString(section.id));
    }
  }
}

function wireSectionCollapsing(documentRef, windowRef) {
  const storage = resolveLocalStorage(windowRef);
  const storageKey = "prooweb:dashboard:collapsed-sections:v2";
  const rawState = storage ? storage.getItem(storageKey) : null;
  const persistedState = safeParseJson(rawState) || {};

  const sections = Array.from(documentRef.querySelectorAll("main.content > section.panel[id]"))
    .filter((section) => section.id !== "workspace-dashboard" && section.id !== "workspace-platform-info");
  if (sections.length === 0) {
    return;
  }

  function persist(sectionId, collapsed) {
    if (!storage) {
      return;
    }
    persistedState[sectionId] = Boolean(collapsed);
    storage.setItem(storageKey, JSON.stringify(persistedState));
  }

  function setSectionCollapsed(section, collapsed) {
    section.classList.toggle("is-collapsed", collapsed);
    const toggle = section.querySelector(".section-collapse-toggle");
    if (!toggle) {
      return;
    }
    toggle.textContent = collapsed ? "Expand" : "Collapse";
    toggle.setAttribute("aria-expanded", String(!collapsed));
  }

  function ensureSectionHeaderRow(section) {
    const heading = section.querySelector(":scope > h2, :scope > h3, :scope > h4");
    if (!heading) {
      return;
    }
    let headingRow = section.querySelector(":scope > .section-heading-row");
    if (!headingRow) {
      headingRow = documentRef.createElement("div");
      headingRow.className = "section-heading-row";
      heading.parentNode.insertBefore(headingRow, heading);
      headingRow.appendChild(heading);
    }

    let toggle = headingRow.querySelector(".section-collapse-toggle");
    if (!toggle) {
      toggle = documentRef.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary-action section-collapse-toggle";
      headingRow.appendChild(toggle);
      toggle.addEventListener("click", () => {
        const collapsed = !section.classList.contains("is-collapsed");
        setSectionCollapsed(section, collapsed);
        persist(section.id, collapsed);
      });
    }
  }

  for (const section of sections) {
    ensureSectionHeaderRow(section);
    setSectionCollapsed(section, Boolean(persistedState[section.id]));
  }

  documentRef.getElementById("collapse-sections-button")?.addEventListener("click", () => {
    for (const section of sections) {
      setSectionCollapsed(section, true);
      persist(section.id, true);
    }
  });
  documentRef.getElementById("expand-sections-button")?.addEventListener("click", () => {
    for (const section of sections) {
      setSectionCollapsed(section, false);
      persist(section.id, false);
    }
  });
}

function wireBackToTop(documentRef, windowRef) {
  const button = documentRef.getElementById("back-to-top-button");
  if (!button) {
    return;
  }
  const syncButton = () => {
    const shouldShow = Number(windowRef.scrollY || 0) > 520;
    button.classList.toggle("hidden", !shouldShow);
  };
  windowRef.addEventListener("scroll", syncButton, { passive: true });
  syncButton();
  button.addEventListener("click", () => {
    windowRef.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function wireMenuKeyboardShortcuts(documentRef) {
  const menuLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .menu-dropdown .nav-link"));
  if (menuLinks.length === 0) {
    return;
  }
  documentRef.defaultView?.addEventListener("keydown", (event) => {
    if (!(event.altKey && !event.ctrlKey && !event.metaKey) || isEditableElement(event.target)) {
      return;
    }
    const key = toLower(event.key);
    const mapping = {
      p: "/project/dashboard",
      d: "/data/shared-entities",
      r: "/processes/new-process-model",
      t: "/templates",
      h: "/help/about",
    };
    if (!mapping[key]) {
      return;
    }
    event.preventDefault();
    documentRef.defaultView.location.assign(mapping[key]);
  });
}

export function wireWorkspaceShell({ documentRef = document, windowRef = window } = {}) {
  wireTopMenu(documentRef);
  wireContextPage(documentRef, windowRef);
  wireMenuKeyboardShortcuts(documentRef);
  wireCommandCenter(documentRef, windowRef);
  wireHeaderMigrationProxy(documentRef);
  wireSectionAccessibilityTitles(documentRef);
  wireSectionCollapsing(documentRef, windowRef);
  wireBackToTop(documentRef, windowRef);
}
