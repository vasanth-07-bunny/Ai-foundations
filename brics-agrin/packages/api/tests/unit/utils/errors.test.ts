/**
 * Unit tests for the application error hierarchy.
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ExternalProviderError,
  InternalError,
  isAppError,
} from '../../../src/utils/errors.js';

describe('AppError hierarchy', () => {
  it('AppError has correct statusCode and code', () => {
    const err = new AppError('test', 400, 'TEST_CODE');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST_CODE');
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('ValidationError is 400 with details', () => {
    const err = new ValidationError('Invalid input', { field: 'required' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'required' });
  });

  it('AuthenticationError is 401', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
  });

  it('AuthorizationError is 403', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
  });

  it('NotFoundError formats message with id', () => {
    const err = new NotFoundError('Farm', 'abc-123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('abc-123');
    expect(err.message).toContain('Farm');
  });

  it('NotFoundError without id still works', () => {
    const err = new NotFoundError('Farm');
    expect(err.message).toContain('Farm');
    expect(err.statusCode).toBe(404);
  });

  it('ExternalProviderError has provider name and is operational', () => {
    const err = new ExternalProviderError('open-meteo', 'timeout');
    expect(err.statusCode).toBe(502);
    expect(err.provider).toBe('open-meteo');
    expect(err.isOperational).toBe(true);
  });

  it('InternalError is non-operational', () => {
    const err = new InternalError('DB query failed');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  it('isAppError correctly identifies AppError instances', () => {
    expect(isAppError(new AuthenticationError())).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it('prototype chain is maintained for instanceof checks', () => {
    const err = new NotFoundError('Farm');
    expect(err instanceof NotFoundError).toBe(true);
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
