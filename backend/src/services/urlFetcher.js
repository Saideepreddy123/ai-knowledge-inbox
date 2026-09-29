import * as cheerio from "cheerio";
import { UpstreamFetchError, ValidationError } from "./errors.js";
import { logger } from "./logger.js";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_LENGTH = 200_000; // guard against huge pages

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}


export async function fetchUrlContent(url) {
  if (!isValidHttpUrl(url)) {
    throw new ValidationError("Invalid URL. Must be a valid http(s) URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AI-Knowledge-Inbox/1.0 (+content-ingest-bot)" },
      redirect: "follow",
    });
  } catch (err) {
    logger.warn("url_fetch_network_error", { url, error: err.message });
    throw new UpstreamFetchError(`Could not reach URL: ${url}`, {
      cause: err.message,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new UpstreamFetchError(
      `URL returned HTTP ${res.status}`,
      { url, status: res.status }
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new ValidationError(
      `Unsupported content-type "${contentType}". Only HTML/text pages are supported.`
    );
  }

  const html = await res.text();
  const $ = cheerio.load(html.slice(0, MAX_CONTENT_LENGTH * 2));

  $("script, style, nav, footer, header, noscript, iframe, svg").remove();
  $("sup.reference, sup[id^='cite_ref'], .mw-editsection, .reference").remove();

  const title = $("title").first().text().trim() || url;

  const parts = [];
  $("h1, h2, h3, h4, p, li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 20) parts.push(t);
  });

  let text = parts.join("\n\n");
  if (!text) {
    // fallback to body text if structured extraction found nothing
    text = $("body").text().replace(/\s+/g, " ").trim();
  }

  text = text
    .replace(/\[\d+\]/g, "")
    .replace(/\[(edit|citation needed)\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  text = text.slice(0, MAX_CONTENT_LENGTH);

  if (!text) {
    throw new UpstreamFetchError("No readable text content found at URL", { url });
  }

  return { title, text };
}
