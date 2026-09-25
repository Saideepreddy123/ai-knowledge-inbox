// Typed errors so the error-handling middleware can map them to sensible
// HTTP status codes instead of everything collapsing to a 500.

export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class UpstreamFetchError extends AppError {
  constructor(message, details) {
    super(message, 502, details);
  }
}
