import { randomUUID } from "node:crypto";
import { db } from "./index.js";
import { cosineSimilarity } from "../services/embeddings.js";

// --- Items ---

const insertItemStmt = db.prepare(`
  INSERT INTO items (id, source_type, source_url, title, raw_content)
  VALUES (@id, @source_type, @source_url, @title, @raw_content)
`);

export function insertItem({ sourceType, sourceUrl = null, title, rawContent }) {
  const id = randomUUID();
  insertItemStmt.run({
    id,
    source_type: sourceType,
    source_url: sourceUrl,
    title,
    raw_content: rawContent,
  });
  return getItemById(id);
}

export function getItemById(id) {
  return db.prepare(`SELECT * FROM items WHERE id = ?`).get(id);
}

export function listItems() {
  return db
    .prepare(
      `SELECT id, source_type, source_url, title,
              substr(raw_content, 1, 240) AS preview,
              length(raw_content) AS content_length,
              created_at
       FROM items ORDER BY created_at DESC`
    )
    .all();
}

// --- Chunks ---

const insertChunkStmt = db.prepare(`
  INSERT INTO chunks (id, item_id, chunk_index, content, embedding)
  VALUES (@id, @item_id, @chunk_index, @content, @embedding)
`);

// node:sqlite has no built-in `db.transaction()` helper (unlike
// better-sqlite3), so we wrap explicitly. Still atomic: if any insert
// throws, we roll back rather than leaving a partially-chunked item.
export function insertChunksTx(itemId, chunks, embeddings) {
  db.exec("BEGIN");
  try {
    chunks.forEach((content, i) => {
      insertChunkStmt.run({
        id: randomUUID(),
        item_id: itemId,
        chunk_index: i,
        content,
        embedding: JSON.stringify(embeddings[i]),
      });
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

const allChunksStmt = db.prepare(`
  SELECT chunks.id, chunks.item_id, chunks.chunk_index, chunks.content, chunks.embedding,
         items.title AS item_title, items.source_type, items.source_url
  FROM chunks
  JOIN items ON items.id = chunks.item_id
`);

/**
 * Retrieval: brute-force cosine similarity over all chunks.
 * Fine at the "single user, a few hundred/thousand chunks" scale this
 * assignment targets - see README "what breaks at scale" for the ANN
 * index this would need beyond that.
 */
export function topKChunks(queryEmbedding, k = 4) {
  const rows = allChunksStmt.all();
  const scored = rows.map((row) => ({
    ...row,
    embedding: JSON.parse(row.embedding),
  })).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.item_title,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    chunkIndex: row.chunk_index,
    content: row.content,
    score: cosineSimilarity(queryEmbedding, row.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export function countChunks() {
  return db.prepare(`SELECT COUNT(*) AS n FROM chunks`).get().n;
}

export function countItems() {
  return db.prepare(`SELECT COUNT(*) AS n FROM items`).get().n;
}
