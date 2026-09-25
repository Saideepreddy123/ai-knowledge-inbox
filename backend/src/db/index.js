import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Using Node's built-in `node:sqlite` (stable since Node 22.5+, no flag
// needed on modern Node) instead of better-sqlite3. This avoids native
// compilation entirely (no node-gyp / Visual Studio / build-essential
// requirement), which is a real cross-platform pain point for a
// take-home reviewers will run on their own machines.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "inbox.sqlite");
export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Items = raw ingested content (a note, or a fetched URL)
db.exec(`
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'url')),
  source_url TEXT,
  title TEXT,
  raw_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`);

// Chunks = the unit that gets embedded and retrieved
db.exec(`
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL, -- JSON-encoded float array
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id);`);

export default db;
