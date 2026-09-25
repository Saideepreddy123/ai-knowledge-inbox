import { randomUUID } from "node:crypto";
import { logger } from "../services/logger.js";

export function requestLogger(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = performance.now();
  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - start);
    logger.info("request_completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
