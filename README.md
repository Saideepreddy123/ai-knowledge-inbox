# AI Knowledge Inbox

A minimal, production-shaped RAG app: save notes/URLs, ask questions, get an
answer with cited sources. Built for the Turium interview assignment.

**Runs fully offline out of the box** — no API key required. Set
`OPENAI_API_KEY` to upgrade to real embeddings + LLM answers; the app
detects it automatically and switches providers with no code changes.

```
ai-knowledge-inbox/
├── backend/     Node + Express API, SQLite storage, RAG pipeline
└── frontend/    React (Vite) UI
```

## Requirements

- Node.js **>= 22.5** (uses the built-in `node:sqlite` module — no native
  compilation, no Visual Studio / build-essential needed, works the same
  on Windows/Mac/Linux). You'll see a one-line `ExperimentalWarning: SQLite
  is an experimental feature` on startup — that's expected and harmless.

## Quick start

```bash
# Terminal 1 - backend
cd backend
cp .env.example .env      # optionally add OPENAI_API_KEY
npm install
npm start                 # http://localhost:8787

# Terminal 2 - frontend
cd frontend
npm install
npm run dev                # http://localhost:5173 (proxies /api/* to :8787)
```

Open http://localhost:5173, add a note or URL, then ask a question about it.

## Architecture

```
 React UI  ──/api/*──▶  Vite dev proxy  ──▶  Express API (:8787)
                                                  │
                              ┌───────────────────┼───────────────────┐
                              ▼                   ▼                   ▼
                        chunker.js          embeddings.js         llm.js
                     (split into chunks)  (local hash | OpenAI) (extractive | OpenAI)
                              │                   │                   │
                              └─────────┬─────────┘                   │
                                        ▼                              │
                                 SQLite (items, chunks)◀───────────────┘
                                 brute-force cosine top-k
```

**Request flow**
- `POST /ingest` → validate → (fetch URL server-side, if type=url) → chunk →
  embed chunks → store item + chunks (with embeddings) in SQLite.
- `GET /items` → list saved items with a short preview.
- `POST /query` → embed the question → cosine-similarity search over all
  stored chunk embeddings → take top-k → pass question + chunks to the LLM
  (or extractive fallback) → return answer + ranked source snippets.

**Code layout (backend)**
```
src/
├── app.js              Express app wiring (middleware + routes)
├── server.js            entry point
├── routes/               one file per endpoint (ingest, items, query)
├── services/
│   ├── chunker.js        chunking strategy
│   ├── embeddings.js      embedding provider (local | OpenAI)
│   ├── llm.js              answer-generation provider (local | OpenAI)
│   ├── urlFetcher.js       server-side URL fetch + text extraction
│   ├── errors.js            typed AppError classes
│   └── logger.js            structured JSON logger
├── middleware/
│   ├── validate.js          request body validation
│   ├── errorHandler.js       centralized error → HTTP status mapping
│   └── requestLogger.js       per-request structured access log
└── db/
    ├── index.js              SQLite connection + schema
    └── repository.js          all SQL lives here (data access layer)
```
Each layer has one job — routes stay thin (validate → call service → respond),
services don't know about HTTP, and `repository.js` is the only file that
writes SQL. This is what "no god files" / "separation of concerns" means in
practice here.

## API

### `POST /ingest`
```jsonc
// note
{ "type": "note", "content": "..." }
// url
{ "type": "url", "url": "https://..." }
```
→ `201 { item: { id, title, sourceType, sourceUrl, createdAt, chunkCount } }`
→ `400` on missing/invalid fields, `502` if a URL can't be fetched.

### `GET /items`
→ `200 { items: [...], meta: { totalItems, totalChunks } }`

### `POST /query`
```jsonc
{ "question": "..." }
```
→ `200 { answer, sources: [{ rank, itemId, title, sourceType, sourceUrl, snippet, score }], meta }`
→ `400` on empty/oversized question.

All errors return `{ error: { message, code, details? } }` with a matching
status code (400 validation, 404 not found, 502 upstream fetch failure, 500
unexpected). Every request gets an `X-Request-Id` header and a structured
JSON log line (`request_completed` / `request_failed`).

## Tradeoff awareness

**Chunking.** Fixed-size character windows (~800 chars, ~120 char overlap),
snapped to the nearest sentence/paragraph break rather than cutting
mid-sentence. Character-based avoids a tokenizer dependency; the overlap
stops a fact from being split exactly on a chunk boundary and lost to
retrieval. Tradeoff: it ignores document structure (headings, tables, code).
Fine for notes/articles; a real system would use a structure-aware or
semantic chunker.

**Embeddings.** Defaults to a **local hashing vectorizer** (bag-of-words,
feature-hashed into 384 dims, L2-normalized) so the whole pipeline runs with
zero cost and zero external dependency — good for demoing ingestion →
retrieval → answer end to end. It captures lexical overlap, not real
semantic similarity ("car" won't match "automobile"). Set `OPENAI_API_KEY`
and it automatically switches to `text-embedding-3-small` for real semantic
search — same interface, no route/DB changes needed.

**Vector storage.** SQLite (via Node's built-in `node:sqlite` — no native
addon, so `npm install` never needs a C++ toolchain) storing each chunk's
embedding as a JSON float array; retrieval is brute-force cosine similarity
over every chunk in JS. Simple, debuggable, zero extra infra — appropriate
at "single user, a few hundred/thousand chunks" scale. It's O(n) per query
and loads every embedding into memory on each search.

**LLM answer.** Defaults to an **extractive fallback** (returns the top-k
chunks directly, clearly labeled as such) when no API key is set, so the
full pipeline is demoable offline. With `OPENAI_API_KEY` **or** `GROQ_API_KEY` set, it calls a real LLM
(`gpt-4o-mini` or `llama-3.3-70b-versatile`) with the retrieved chunks as
context and asks for `[n]`-style citations. **Groq requires no credit
card** ([console.groq.com](https://console.groq.com), sign up with email
only) — the practical option if you don't want to add billing just to see
real synthesized answers. Its free tier only serves chat models, not
embeddings, so retrieval still uses the local hashing vectorizer even in
Groq mode; only the answer-writing step upgrades.

## What breaks at scale

- **Retrieval is O(n) brute force** — fine to a few thousand chunks, then
  query latency grows linearly. Needs a real ANN index (pgvector, Qdrant,
  Pinecone, FAISS/HNSW) once chunk count gets into the tens of thousands.
- **SQLite is single-writer** — fine for single-user, but concurrent
  multi-user writes would need Postgres (or SQLite behind a queue).
- **Synchronous ingest request** — `POST /ingest` fetches the URL, chunks,
  and embeds inline before responding. A large page or slow embedding call
  blocks the request. At real scale this becomes: enqueue the raw content
  immediately, return `202 Accepted`, process (fetch/chunk/embed) in a
  background worker, and let the client poll or subscribe for "ready".
- **No caching** — repeated/near-duplicate URLs get re-fetched and
  re-embedded. Would add content-hash dedup and an embedding cache.
- **Local hashing embeddings** don't generalize past lexical overlap —
  fine for a demo, not for production semantic search.

## What would change for production

- Real ANN vector index + a managed embedding provider by default.
- Background job queue (BullMQ/SQS) for ingestion instead of inline work.
- Auth + per-user data isolation (explicitly out of scope here per the
  assignment brief).
- Rate limiting and request size limits at the edge (a basic 1MB body limit
  is already in place).
- Swap the JSON-line console logger for a real sink (pino → Datadog/ELK)
  and add request tracing.
- Idempotency keys on `/ingest` to make retries safe.
- Streaming answers (SSE) instead of a single JSON response, for latency.

## What was intentionally left out (per the brief)

No auth system, no Kubernetes/deploy infra, no multi-tenant anything —
the brief explicitly asked to avoid this, and it would be overengineering
for a single-user assignment.
