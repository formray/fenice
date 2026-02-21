export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: { field?: string; message: string }[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class NotAuthorizedError extends AppError {
  constructor(message = 'Not authorized') {
    super(401, 'NOT_AUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: { field?: string; message: string }[]) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
  }
}

export class UploadError extends AppError {
  constructor(message = 'Upload failed') {
    super(400, 'UPLOAD_ERROR', message);
  }
}
