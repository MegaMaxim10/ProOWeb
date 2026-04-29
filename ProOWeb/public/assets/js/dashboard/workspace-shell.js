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

  if (target.isContentEditable) {
    return true;
  }

  return false;
}

function resolveLocalStorage(windowRef) {
  try {
    return windowRef?.localStorage || null;
  } catch (_) {
    return null;
  }
}

const WORKSPACE_PAGES = {
  overview: ["workspace-overview", "management"],
  platform: ["workspace-overview", "reconfigure", "template-governance"],
  process: ["workspace-overview", "process-model"],
  developer: ["workspace-overview", "codegen", "deployment"],
};

export function resolveWorkspacePage(windowRef = window) {
  const searchParams = new URLSearchParams(windowRef.location.search || "");
  const candidate = toLower(searchParams.get("page"));
  if (Object.prototype.hasOwnProperty.call(WORKSPACE_PAGES, candidate)) {
    return candidate;
  }

  const pathSegments = windowRef.location.pathname.split("/").filter(Boolean);
  if (pathSegments.length >= 2 && pathSegments[0] === "dashboard") {
    const candidateByPath = toLower(pathSegments[1]);
    if (Object.prototype.hasOwnProperty.call(WORKSPACE_PAGES, candidateByPath)) {
      return candidateByPath;
    }
  }

  return "overview";
}

function extractWorkspacePageFromHref(href, windowRef) {
  try {
    const url = new URL(href, windowRef.location.origin);
    const byQuery = toLower(url.searchParams.get("page"));
    if (Object.prototype.hasOwnProperty.call(WORKSPACE_PAGES, byQuery)) {
      return byQuery;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] === "dashboard") {
      const byPath = toLower(segments[1]);
      if (Object.prototype.hasOwnProperty.call(WORKSPACE_PAGES, byPath)) {
        return byPath;
      }
    }
  } catch (_) {
    return "";
  }

  return "";
}

function resolveSectionTitle(section) {
  if (!section) {
    return "";
  }

  const heading = section.querySelector("h2, h3, h4");
  return heading ? normalizeString(heading.textContent) : normalizeString(section.id);
}

function collectCommandEntries(documentRef, windowRef) {
  const entries = [];
  const navLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link"));
  for (const link of navLinks) {
    const href = normalizeString(link.getAttribute("href"));
    entries.push({
      type: "navigation",
      label: normalizeString(link.textContent),
      keywords: normalizeString(link.textContent),
      run() {
        if (href.startsWith("#")) {
          const target = documentRef.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return;
        }

        if (href) {
          windowRef.location.assign(href);
        }
      },
    });
  }

  const shortcutEntries = [
    {
      label: "Run smart migration",
      keywords: "migration managed files align editor",
      buttonId: "migrate-button",
      sectionId: "management",
    },
    {
      label: "Open process catalog report",
      keywords: "process catalog report runtime",
      sectionId: "process-model-report",
      page: "process",
    },
    {
      label: "Open template governance",
      keywords: "template override customization",
      sectionId: "template-governance",
      page: "platform",
    },
    {
      label: "Open platform configuration",
      keywords: "reconfigure feature packs infrastructure",
      sectionId: "reconfigure",
      page: "platform",
    },
  ];

  for (const shortcut of shortcutEntries) {
    entries.push({
      type: "action",
      label: shortcut.label,
      keywords: shortcut.keywords,
      run() {
        if (shortcut.buttonId) {
          const button = documentRef.getElementById(shortcut.buttonId);
          if (button && !button.classList.contains("hidden") && !button.disabled) {
            button.click();
            return;
          }
        }

        if (shortcut.sectionId) {
          const section = documentRef.getElementById(shortcut.sectionId);
          if (section && !section.classList.contains("hidden")) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          const page = toLower(shortcut.page || "overview");
          windowRef.location.assign(`/dashboard/${encodeURIComponent(page)}`);
        }
      },
    });
  }

  return entries;
}

function wireNavigationFilter(documentRef) {
  const input = documentRef.getElementById("workspace-nav-filter");
  const links = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link"));
  if (!input || links.length === 0) {
    return;
  }

  input.addEventListener("input", () => {
    const term = toLower(input.value);
    for (const link of links) {
      const label = toLower(link.textContent);
      const visible = !term || label.includes(term);
      link.classList.toggle("hidden", !visible);
    }
  });

  documentRef.defaultView?.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isEditableElement(event.target)) {
      return;
    }

    event.preventDefault();
    input.focus();
    input.select();
  });
}

function wireActiveSectionTracking(documentRef) {
  const navLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link"));
  if (navLinks.length === 0 || typeof IntersectionObserver === "undefined") {
    return;
  }

  const byId = new Map();
  for (const link of navLinks) {
    const href = normalizeString(link.getAttribute("href"));
    if (href.startsWith("#")) {
      byId.set(href.slice(1), link);
    }
  }

  const sections = Array.from(byId.keys())
    .map((id) => documentRef.getElementById(id))
    .filter(Boolean);
  if (sections.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      let topMatch = null;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!topMatch || entry.boundingClientRect.top < topMatch.boundingClientRect.top) {
            topMatch = entry;
          }
        }
      }

      if (!topMatch || !topMatch.target?.id) {
        return;
      }

      for (const link of navLinks) {
        link.classList.remove("is-active");
      }
      const activeLink = byId.get(topMatch.target.id);
      if (activeLink) {
        activeLink.classList.add("is-active");
      }
    },
    {
      rootMargin: "-35% 0px -55% 0px",
      threshold: 0.01,
    },
  );

  for (const section of sections) {
    observer.observe(section);
  }
}

function wireContextPage(documentRef, windowRef) {
  const page = resolveWorkspacePage(windowRef);
  const visibleIds = new Set(WORKSPACE_PAGES[page] || WORKSPACE_PAGES.overview);
  const sections = Array.from(documentRef.querySelectorAll("main.content > section.panel[id]"));

  for (const section of sections) {
    section.classList.toggle("hidden", !visibleIds.has(section.id));
  }

  const navLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link[data-page-link]"));
  for (const link of navLinks) {
    const linkPage = extractWorkspacePageFromHref(link.href, windowRef);
    link.classList.toggle("is-active", linkPage === page);
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
    } else {
      const section = documentRef.getElementById("management");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
}

function wireSectionAccessibilityTitles(documentRef) {
  const sections = Array.from(documentRef.querySelectorAll("main.content section[id]"));
  for (const section of sections) {
    if (!section.getAttribute("aria-label")) {
      section.setAttribute("aria-label", resolveSectionTitle(section));
    }
  }
}

function wireSectionCollapsing(documentRef, windowRef) {
  const storage = resolveLocalStorage(windowRef);
  const storageKey = "prooweb:dashboard:collapsed-sections:v1";
  const rawState = storage ? storage.getItem(storageKey) : null;
  const persistedState = safeParseJson(rawState) || {};

  const sections = Array.from(documentRef.querySelectorAll("main.content > section.panel[id]"))
    .filter((section) => section.id !== "workspace-overview");

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

  const collapseButton = documentRef.getElementById("collapse-sections-button");
  const expandButton = documentRef.getElementById("expand-sections-button");

  collapseButton?.addEventListener("click", () => {
    for (const section of sections) {
      setSectionCollapsed(section, true);
      persist(section.id, true);
    }
  });

  expandButton?.addEventListener("click", () => {
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

export function wireWorkspaceShell({ documentRef = document, windowRef = window } = {}) {
  wireNavigationFilter(documentRef);
  wireContextPage(documentRef, windowRef);
  wireActiveSectionTracking(documentRef);
  wireCommandCenter(documentRef, windowRef);
  wireHeaderMigrationProxy(documentRef);
  wireSectionAccessibilityTitles(documentRef);
  wireSectionCollapsing(documentRef, windowRef);
  wireBackToTop(documentRef, windowRef);
}
