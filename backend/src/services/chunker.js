

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE_CHARS || "800", 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP_CHARS || "120", 10);

const SENTENCE_BOUNDARY = /[.!?]\s/g;

function findBreakPoint(text, from, to) {
  
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
