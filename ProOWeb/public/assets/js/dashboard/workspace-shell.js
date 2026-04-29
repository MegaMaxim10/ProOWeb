function normalizeString(value) {
  return String(value || "").trim();
}

function toLower(value) {
  return normalizeString(value).toLowerCase();
}

function resolveSectionTitle(section) {
  if (!section) {
    return "";
  }

  const heading = section.querySelector("h2, h3, h4");
  return heading ? normalizeString(heading.textContent) : normalizeString(section.id);
}

function collectCommandEntries(documentRef) {
  const entries = [];
  const navLinks = Array.from(documentRef.querySelectorAll("#workspace-nav .nav-link"));
  for (const link of navLinks) {
    const href = normalizeString(link.getAttribute("href"));
    if (!href.startsWith("#")) {
      continue;
    }
    entries.push({
      type: "navigation",
      label: normalizeString(link.textContent),
      keywords: normalizeString(link.textContent),
      run() {
        const target = documentRef.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
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
    },
    {
      label: "Open template governance",
      keywords: "template override customization",
      sectionId: "template-governance",
    },
    {
      label: "Open platform configuration",
      keywords: "reconfigure feature packs infrastructure",
      sectionId: "reconfigure",
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
          if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
          }
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

  const entries = collectCommandEntries(documentRef);
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

export function wireWorkspaceShell({ documentRef = document, windowRef = window } = {}) {
  wireNavigationFilter(documentRef);
  wireActiveSectionTracking(documentRef);
  wireCommandCenter(documentRef, windowRef);
  wireHeaderMigrationProxy(documentRef);
  wireSectionAccessibilityTitles(documentRef);
}
