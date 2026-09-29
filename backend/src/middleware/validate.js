import { ValidationError } from "../services/errors.js";


export function validateIngestBody(body) {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object.");
  }
  const { type, content, url } = body;

  if (type !== "note" && type !== "url") {
    throw new ValidationError('"type" must be either "note" or "url".', {
      field: "type",
    });
  }

  if (type === "note") {
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new ValidationError(
        '"content" is required and must be a non-empty string for type "note".',
        { field: "content" }
      );
    }
    if (content.length > 50_000) {
      throw new ValidationError("Note content exceeds 50,000 characters.", {
        field: "content",
      });
    }
  }

  if (type === "url") {
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new ValidationError(
        '"url" is required and must be a non-empty string for type "url".',
        { field: "url" }
      );
    }
  }

  return body;
}

export function validateQueryBody(body) {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object.");
  }
  const { question } = body;
  if (typeof question !== "string" || question.trim().length === 0) {
    throw new ValidationError(
      '"question" is required and must be a non-empty string.',
      { field: "question" }
    );
  }
  if (question.length > 2000) {
    throw new ValidationError('"question" exceeds 2000 characters.', {
      field: "question",
    });
  }
  return body;
}
