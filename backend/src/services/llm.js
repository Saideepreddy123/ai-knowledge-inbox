import { logger } from "./logger.js";
import { UpstreamFetchError } from "./errors.js";


const USE_OPENAI = Boolean(process.env.OPENAI_API_KEY);
const USE_GROQ = !USE_OPENAI && Boolean(process.env.GROQ_API_KEY);

const OPENAI_MODEL = process.env.CHAT_MODEL || "gpt-4o-mini";
const GROQ_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";

let client = null;
async function getClient() {
  if (!client) {
    const { default: OpenAI } = await import("openai");
    client = USE_GROQ
      ? new OpenAI({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1",
        })
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function buildPrompt(question, contextChunks) {
  const context = contextChunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n");

  return `You are a helpful assistant answering questions using ONLY the provided context snippets from the user's saved notes/URLs. Cite snippets inline using [1], [2], etc. matching the snippet numbers below. If the context does not contain the answer, say so plainly rather than guessing.

Context:
${context}

Question: ${question}

Answer (with [n] citations):`;
}

async function remoteAnswer(question, contextChunks) {
  const providerName = USE_GROQ ? "groq" : "openai";
  const model = USE_GROQ ? GROQ_MODEL : OPENAI_MODEL;
  try {
    const c = await getClient();
    const prompt = buildPrompt(question, contextChunks);
    const res = await c.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    logger.error(`${providerName}_chat_failed`, { error: err.message });
    throw new UpstreamFetchError(`Failed to generate answer via ${providerName}`, {
      cause: err.message,
    });
  }
}

function localAnswer(question, contextChunks) {
  if (contextChunks.length === 0) {
    return "I couldn't find any saved content relevant to that question. Try adding some notes or URLs first.";
  }
  const lines = contextChunks.map((c, i) => `[${i + 1}] ${c.content}`);
  return (
    `(Local mode - no LLM configured, showing the most relevant saved passages for: "${question}")\n\n` +
    lines.join("\n\n")
  );
}

/**
 * @param {string} question
 * @param {{content: string}[]} contextChunks - top-k retrieved chunks, in rank order
 */
export async function generateAnswer(question, contextChunks) {
  if (USE_OPENAI || USE_GROQ) return remoteAnswer(question, contextChunks);
  return localAnswer(question, contextChunks);
}

export function llmProviderInfo() {
  if (USE_OPENAI) return { provider: "openai", model: OPENAI_MODEL };
  if (USE_GROQ) return { provider: "groq", model: GROQ_MODEL };
  return { provider: "local-extractive", model: "top-k-passthrough" };
}
