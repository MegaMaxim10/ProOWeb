import { setFeedback } from "../shared/feedback.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readFormPayload(form) {
  const formData = new FormData(form);
  const strategy = String(formData.get("strategy") || "replace").toLowerCase();
  const priorityRaw = Number(formData.get("priority"));
  const payload = {
    id: String(formData.get("id") || "").trim() || undefined,
    targetPath: String(formData.get("targetPath") || "").trim(),
    sourcePath: String(formData.get("sourcePath") || "").trim() || undefined,
    strategy,
    enabled: formData.get("enabled") === "on",
    priority: Number.isFinite(priorityRaw) ? priorityRaw : 100,
    description: String(formData.get("description") || "").trim() || undefined,
    sourceContent: String(formData.get("sourceContent") || ""),
  };

  if (strategy === "replace-block") {
    payload.matchText = String(formData.get("matchText") || "");
    payload.replacementText = String(formData.get("replacementText") || "");
  }

  return payload;
}

function fillForm(form, override) {
  form.querySelector('[name="id"]').value = override?.id || "";
  form.querySelector('[name="targetPath"]').value = override?.targetPath || "";
  form.querySelector('[name="sourcePath"]').value = override?.sourcePath || "";
  form.querySelector('[name="strategy"]').value = override?.strategy || "replace";
  form.querySelector('[name="priority"]').value = Number.isFinite(override?.priority) ? String(override.priority) : "100";
  form.querySelector('[name="enabled"]').checked = override?.enabled !== false;
  form.querySelector('[name="description"]').value = override?.description || "";
  form.querySelector('[name="matchText"]').value = override?.matchText || "";
  form.querySelector('[name="replacementText"]').value = override?.replacementText || "";
}

function renderRows(container, templateCustomization) {
  const overrides = Array.isArray(templateCustomization?.overrides)
    ? templateCustomization.overrides
    : [];

  if (overrides.length === 0) {
    container.innerHTML = "<tr><td colspan=\"9\" class=\"muted\">No template overrides defined yet.</td></tr>";
    return;
  }

  container.innerHTML = overrides
    .map((override) => {
      const targetPath = escapeHtml(override.targetPath || "");
      const sourcePath = escapeHtml(override.sourcePath || "");
      const strategy = escapeHtml(override.strategy || "replace");
      const enabled = override.enabled === false ? "disabled" : "enabled";
      return [
        "<tr>",
        `<td><code>${escapeHtml(override.id || "-")}</code></td>`,
        `<td><code>${targetPath}</code></td>`,
        `<td>${strategy}</td>`,
        `<td>${Number.isFinite(override.priority) ? override.priority : 100}</td>`,
        `<td>${enabled}</td>`,
        `<td><code>${sourcePath}</code></td>`,
        "<td>",
        `<button type="button" data-action="edit" data-id="${escapeHtml(override.id)}">Edit</button>`,
        "</td>",
        "<td>",
        `<button type="button" data-action="delete" data-id="${escapeHtml(override.id)}">Delete</button>`,
        "</td>",
        "</tr>",
      ].join("");
    })
    .join("");
}

function renderSummary(container, templateCustomization) {
  const summary = templateCustomization?.summary || {};
  const diagnostics = templateCustomization?.diagnostics || {};
  const missing = Array.isArray(diagnostics.missingSourceFiles) ? diagnostics.missingSourceFiles : [];

  const lines = [
    `Overrides: ${Number(summary.total || 0)} (enabled ${Number(summary.enabled || 0)})`,
    `Missing source files: ${Number(summary.missingSourceFiles || 0)}`,
  ];

  if (missing.length > 0) {
    lines.push("");
    lines.push("Missing source files:");
    for (const entry of missing) {
      lines.push(`- ${entry.id}: ${entry.sourcePath}`);
    }
  }

  container.textContent = lines.join("\n");
}

function resetForm(form) {
  form.reset();
  form.querySelector('[name="strategy"]').value = "replace";
  form.querySelector('[name="priority"]').value = "100";
  form.querySelector('[name="enabled"]').checked = true;
}

export async function wireTemplateOverridesPanel({
  status,
  onFetchTemplateOverrides,
  onSaveTemplateOverride,
  onDeleteTemplateOverride,
  documentRef = document,
}) {
  if (!status?.initialized) {
    return;
  }

  const form = documentRef.getElementById("template-override-form");
  const feedback = documentRef.getElementById("template-override-feedback");
  const summaryContainer = documentRef.getElementById("template-override-summary");
  const tableBody = documentRef.getElementById("template-override-rows");
  const clearButton = documentRef.getElementById("template-override-clear");

  if (!form || !feedback || !summaryContainer || !tableBody || !clearButton) {
    return;
  }

  let templateCustomization = status.templateCustomization || null;
  if (!templateCustomization) {
    templateCustomization = await onFetchTemplateOverrides();
  }

  const refresh = async () => {
    templateCustomization = await onFetchTemplateOverrides();
    renderRows(tableBody, templateCustomization);
    renderSummary(summaryContainer, templateCustomization);
  };

  renderRows(tableBody, templateCustomization);
  renderSummary(summaryContainer, templateCustomization);

  clearButton.addEventListener("click", () => {
    resetForm(form);
    setFeedback(feedback, "Override form reset.");
  });

  tableBody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.getAttribute("data-action");
    const overrideId = target.getAttribute("data-id");
    if (!action || !overrideId) {
      return;
    }

    if (action === "edit") {
      const match = (templateCustomization?.overrides || []).find((entry) => entry.id === overrideId);
      if (match) {
        fillForm(form, match);
        setFeedback(feedback, `Loaded override '${overrideId}' into form.`, "success");
      }
      return;
    }

    if (action === "delete") {
      target.setAttribute("disabled", "disabled");
      try {
        await onDeleteTemplateOverride(overrideId, { removeSourceFile: true });
        setFeedback(feedback, `Override '${overrideId}' deleted.`, "success");
        await refresh();
      } catch (error) {
        setFeedback(feedback, error.message || "Template override deletion failed.", "error");
      } finally {
        target.removeAttribute("disabled");
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.setAttribute("disabled", "disabled");
    }

    try {
      const payload = readFormPayload(form);
      if (!payload.targetPath) {
        throw new Error("targetPath is required.");
      }

      const result = await onSaveTemplateOverride(payload);
      setFeedback(feedback, result?.message || "Template override saved.", "success");
      resetForm(form);
      await refresh();
    } catch (error) {
      setFeedback(feedback, error.message || "Template override save failed.", "error");
    } finally {
      if (submitButton) {
        submitButton.removeAttribute("disabled");
      }
    }
  });
}
