/**
 * Chunking strategy
 * ------------------
 * Fixed-size character windows with overlap, snapped to sentence/paragraph
 * boundaries where possible. This is deliberately simple:
 *
 *  - Character-based (not token-based) so it needs no tokenizer dependency.
 *  - CHUNK_SIZE_CHARS (~800 chars, ~150-200 tokens) keeps each chunk small
 *    enough to be a precise retrieval unit, but large enough to carry
 *    real context (a paragraph or two).
 *  - CHUNK_OVERLAP_CHARS (~120 chars) prevents a fact from being split
 *    exactly across a chunk boundary and lost to retrieval.
 *  - We try to break on a sentence end or blank line near the target size
 *    instead of a hard cut mid-word, which keeps chunks human-readable in
 *    the "source snippet" UI.
 *
 * Tradeoff: this ignores document structure (headings, tables, code
 * blocks). Fine for notes/articles; a production system would use a
 * structure-aware splitter (e.g. markdown/HTML-aware, or token-based with
 * a real tokenizer) and possibly semantic chunking.
 */

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE_CHARS || "800", 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP_CHARS || "120", 10);

const SENTENCE_BOUNDARY = /[.!?]\s/g;

function findBreakPoint(text, from, to) {
  // Search backwards from `to` for a sentence boundary or blank line,
  // but not before `from` (which would make the chunk too small).
  const window = text.slice(from, to);
  let lastBreak = -1;

  // Prefer paragraph breaks
  const paraIdx = window.lastIndexOf("\n\n");
  if (paraIdx > window.length * 0.4) {
    return from + paraIdx + 2;
  }

  // Then sentence breaks
  let match;
  SENTENCE_BOUNDARY.lastIndex = 0;
  while ((match = SENTENCE_BOUNDARY.exec(window)) !== null) {
    lastBreak = match.index + match[0].length;
  }
  if (lastBreak > window.length * 0.4) {
    return from + lastBreak;
  }

  // Fall back to a hard cut
  return to;
}

export function chunkText(text) {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  if (clean.length <= CHUNK_SIZE) {
    return [clean];
  }

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    const targetEnd = Math.min(start + CHUNK_SIZE, clean.length);
    const end =
      targetEnd === clean.length
        ? clean.length
        : findBreakPoint(clean, start, targetEnd);

    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1); // always progress
  }

  return chunks;
}
