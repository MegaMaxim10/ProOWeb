async function parseResponseBody(response) {
  const raw = await response.text();

  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function requestJson(url, { method = "GET", headers = {}, body, signal } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const message = data?.error || "Request failed: " + response.status;
    throw new Error(message);
  }

  return data;
}
