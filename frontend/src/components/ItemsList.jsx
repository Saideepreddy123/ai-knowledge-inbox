function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ItemsList({ items, loading, error }) {
  return (
    <div className="card">
      <h2 className="section-title">
        Saved items {items.length > 0 && <span className="badge">{items.length}</span>}
      </h2>

      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="muted">Nothing saved yet. Add a note or URL above.</p>
      )}

      <ul className="items-list">
        {items.map((item) => (
          <li key={item.id} className="item-row">
            <div className="item-row-header">
              <span className={`pill pill-${item.sourceType}`}>{item.sourceType}</span>
              <span className="item-title">{item.title}</span>
            </div>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="item-url"
              >
                {item.sourceUrl}
              </a>
            )}
            <p className="item-preview">{item.preview}</p>
            <span className="item-meta">{formatDate(item.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
