const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. network-level failure) - fall through
  }

  if (!res.ok) {
    const message = body?.error?.message || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.details = body?.error?.details;
    throw error;
  }

  return body;
}

export function fetchItems() {
  return request("/items");
}

export function ingestNote(content) {
  return request("/ingest", {
    method: "POST",
    body: JSON.stringify({ type: "note", content }),
  });
}

export function ingestUrl(url) {
  return request("/ingest", {
    method: "POST",
    body: JSON.stringify({ type: "url", url }),
  });
}

export function askQuestion(question) {
  return request("/query", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}
