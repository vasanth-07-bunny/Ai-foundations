/**
 * Application error hierarchy.
 *
 * All errors extend AppError so the global error handler can inspect
 * statusCode and code without type-checking every throw site.
 *
 * NEVER expose internal error details (stack traces, DB messages, etc.)
 * to API consumers. The error handler maps these to safe responses.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    // Maintain prototype chain in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404,
      'NOT_FOUND',
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class ExternalProviderError extends AppError {
  public readonly provider: string;

  constructor(provider: string, message: string) {
    super(`External provider '${provider}' error: ${message}`, 502, 'EXTERNAL_PROVIDER_ERROR');
    this.provider = provider;
    this.isOperational = true;
  }
}

export class InternalError extends AppError {
  constructor(message = 'An internal error occurred') {
    // Non-operational — these are programmer errors, not user errors
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}

export class ImageValidationError extends AppError {
  constructor(reason: string) {
    super(`Image validation failed: ${reason}`, 422, 'IMAGE_VALIDATION_ERROR');
  }
}

export class LowConfidenceError extends AppError {
  constructor(confidence: number) {
    super(
      `Model confidence (${(confidence * 100).toFixed(0)}%) is below the minimum threshold for a reliable recommendation.`,
      422,
      'LOW_CONFIDENCE',
    );
  }
}

/** Type guard — check if an unknown value is an AppError */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
