import { useState } from "react";
import { ingestNote, ingestUrl } from "../api.js";

export default function AddItemForm({ onItemAdded }) {
  const [mode, setMode] = useState("note"); // "note" | "url"
  const [noteText, setNoteText] = useState("");
  const [urlText, setUrlText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const trimmed = mode === "note" ? noteText.trim() : urlText.trim();
    if (!trimmed) {
      setError(mode === "note" ? "Note can't be empty." : "URL can't be empty.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "note" ? await ingestNote(trimmed) : await ingestUrl(trimmed);
      onItemAdded(result.item);
      setNoteText("");
      setUrlText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="tabs">
        <button
          type="button"
          className={`tab ${mode === "note" ? "tab-active" : ""}`}
          onClick={() => setMode("note")}
        >
          Note
        </button>
        <button
          type="button"
          className={`tab ${mode === "url" ? "tab-active" : ""}`}
          onClick={() => setMode("url")}
        >
          URL
        </button>
      </div>

      <form onSubmit={handleSubmit} className="add-form">
        {mode === "note" ? (
          <textarea
            className="input"
            placeholder="Paste or write a note to save..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            disabled={submitting}
          />
        ) : (
          <input
            className="input"
            type="text"
            placeholder="https://example.com/article"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            disabled={submitting}
          />
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? mode === "url"
              ? "Fetching & indexing..."
              : "Saving..."
            : "Add to inbox"}
        </button>
      </form>
    </div>
  );
}
