import { logger } from "./logger.js";
import { UpstreamFetchError } from "./errors.js";

/**
 * Embeddings provider
 * --------------------
 * Two interchangeable backends behind one `embed(texts)` function:
 *
 *  1. OpenAI (`text-embedding-3-small` by default) - used automatically
 *     when OPENAI_API_KEY is set. Real semantic embeddings.
 *
 *  2. Local hashing vectorizer - zero-dependency, zero-cost, deterministic
 *     fallback so the whole app runs fully offline out of the box (no key
 *     required to demo the pipeline). It's a bag-of-words hashed into a
 *     fixed-size vector (a la the "hashing trick" / feature hashing),
 *     weighted by simple TF, then L2-normalized so cosine similarity is
 *     meaningful. This captures lexical overlap, NOT semantic meaning
 *     (e.g. it won't know "car" ~ "automobile"). It's intentionally the
 *     "good enough to demo the full pipeline" option, not a production
 *     substitute for real embeddings - swap OPENAI_API_KEY in and the app
 *     automatically upgrades to real semantic search.
 */

const LOCAL_DIM = 384;
const USE_OPENAI = Boolean(process.env.OPENAI_API_KEY);
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

let openaiClient = null;
async function getOpenAIClient() {
  if (!openaiClient) {
    const { default: OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// Simple 32-bit string hash (FNV-1a) - fast, deterministic, no deps.
function hashToken(token) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function localEmbedOne(text) {
  const vec = new Float64Array(LOCAL_DIM);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const idx = hashToken(token) % LOCAL_DIM;
    // sign trick reduces hash-collision bias
    const sign = hashToken(token + "_sign") % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < LOCAL_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

async function openaiEmbed(texts) {
  try {
    const client = await getOpenAIClient();
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  } catch (err) {
    logger.error("openai_embedding_failed", { error: err.message });
    throw new UpstreamFetchError("Failed to generate embeddings via OpenAI", {
      cause: err.message,
    });
  }
}

/**
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embed(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (USE_OPENAI) return openaiEmbed(texts);
  return texts.map(localEmbedOne);
}

export function embeddingProviderInfo() {
  return USE_OPENAI
    ? { provider: "openai", model: EMBEDDING_MODEL, dim: null }
    : { provider: "local-hashing", model: "fnv1a-hashing-vectorizer", dim: LOCAL_DIM };
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
