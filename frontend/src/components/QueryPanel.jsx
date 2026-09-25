import { useState } from "react";
import { askQuestion } from "../api.js";

export default function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { answer, sources, meta }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      setError("Ask something first.");
      return;
    }

    setAsking(true);
    setError(null);
    try {
      const res = await askQuestion(trimmed);
      setResult(res);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">Ask a question</h2>

      <form onSubmit={handleSubmit} className="ask-form">
        <input
          className="input"
          type="text"
          placeholder="What do you want to know about your saved content?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking}
        />
        <button type="submit" className="btn btn-primary" disabled={asking}>
          {asking ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="answer-block">
          <h3 className="answer-heading">Answer</h3>
          <p className="answer-text">{result.answer}</p>

          {result.meta && (
            <p className="muted small">
              embeddings: {result.meta.embeddingProvider?.provider} · llm:{" "}
              {result.meta.llmProvider?.provider}
            </p>
          )}

          {result.sources?.length > 0 && (
            <>
              <h3 className="answer-heading">Sources</h3>
              <ul className="sources-list">
                {result.sources.map((s) => (
                  <li key={`${s.itemId}-${s.rank}`} className="source-row">
                    <div className="source-row-header">
                      <span className="source-rank">[{s.rank}]</span>
                      <span className={`pill pill-${s.sourceType}`}>{s.sourceType}</span>
                      <span className="item-title">{s.title}</span>
                      <span className="score">score {s.score}</span>
                    </div>
                    {s.sourceUrl && (
                      <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="item-url">
                        {s.sourceUrl}
                      </a>
                    )}
                    <p className="source-snippet">{s.snippet}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
