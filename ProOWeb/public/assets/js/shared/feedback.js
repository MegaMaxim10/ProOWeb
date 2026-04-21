export function setFeedback(element, message, type = "") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = type ? `feedback ${type}` : "feedback";
}
