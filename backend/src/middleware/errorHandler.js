import { AppError } from "../services/errors.js";
import { logger } from "../services/logger.js";

// 404 for unmatched routes
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `No route for ${req.method} ${req.originalUrl}`,
      code: "NOT_FOUND",
    },
  });
}

// Must be registered LAST (4 args = Express error middleware signature)
export function errorHandler(err, req, res, _next) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;

  logger.error("request_failed", {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    details: isAppError ? err.details : undefined,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  res.status(statusCode).json({
    error: {
      message: err.message || "Internal server error",
      code: err.name || "INTERNAL_ERROR",
      ...(isAppError && err.details ? { details: err.details } : {}),
    },
  });
}
