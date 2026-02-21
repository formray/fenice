import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, NotAuthorizedError, ForbiddenError, ValidationError } from '../../../src/utils/errors.js';

describe('AppError', () => {
  it('should create error with all properties', () => {
    const err = new AppError(400, 'TEST_ERROR', 'Test message');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('Test message');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should support details array', () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const err = new AppError(400, 'TEST', 'msg', details);
    expect(err.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('should have status 404', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
  });

  it('should accept custom message', () => {
    const err = new NotFoundError('User not found');
    expect(err.message).toBe('User not found');
  });
});

describe('NotAuthorizedError', () => {
  it('should have status 401', () => {
    const err = new NotAuthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('NOT_AUTHORIZED');
  });
});

describe('ForbiddenError', () => {
  it('should have status 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('ValidationError', () => {
  it('should have status 400 and details', () => {
    const details = [{ field: 'name', message: 'Required' }];
    const err = new ValidationError(details);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });
});
