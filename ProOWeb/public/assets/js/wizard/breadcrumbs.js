function createNode(doc, tagName, className, text) {
  const node = doc.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text != null) {
    node.textContent = text;
  }
  return node;
}

export function createWizardBreadcrumbs({ container } = {}) {
  if (!container) {
    return {
      render() {},
    };
  }

  const doc = container.ownerDocument || document;
  const list = createNode(doc, "ol", "wizard-breadcrumbs-list");
  container.appendChild(list);

  function render({ currentStepIndex = 0, totalSteps = 0, stepTitle = "" } = {}) {
    list.textContent = "";

    const studio = createNode(doc, "li", "wizard-breadcrumb");
    studio.appendChild(createNode(doc, "span", "wizard-breadcrumb-label", "Studio"));

    const setup = createNode(doc, "li", "wizard-breadcrumb");
    setup.appendChild(createNode(doc, "span", "wizard-breadcrumb-label", "Workspace Setup"));

    const current = createNode(doc, "li", "wizard-breadcrumb is-current");
    current.setAttribute("aria-current", "page");
    current.appendChild(
      createNode(
        doc,
        "span",
        "wizard-breadcrumb-label",
        `${stepTitle || `Step ${currentStepIndex + 1}`} (${currentStepIndex + 1}/${totalSteps})`,
      ),
    );

    list.append(studio, setup, current);
  }

  return {
    render,
  };
}
