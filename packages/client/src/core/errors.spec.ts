/**
 * Errors Unit Tests
 *
 * Tests error handling functionality.
 */

import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';

describe('NAuthClientError', () => {
  it('should create error with required fields', () => {
    const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed');
    expect(error.code).toBe(NAuthErrorCode.VALIDATION_FAILED);
    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('NAuthClientError');
    expect(error.timestamp).toBeDefined();
    expect(error.isNetworkError).toBe(false);
  });

  it('should create error with optional fields', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed', {
      details,
      statusCode: 400,
      timestamp: '2024-01-01T00:00:00.000Z',
      isNetworkError: true,
    });
    expect(error.details).toEqual(details);
    expect(error.statusCode).toBe(400);
    expect(error.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(error.isNetworkError).toBe(true);
  });

  describe('isCode', () => {
    it('should return true when code matches', () => {
      const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      expect(error.isCode(NAuthErrorCode.VALIDATION_FAILED)).toBe(true);
    });

    it('should return false when code does not match', () => {
      const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      expect(error.isCode(NAuthErrorCode.AUTH_INVALID_CREDENTIALS)).toBe(false);
    });
  });

  describe('getDetails', () => {
    it('should return details when available', () => {
      const details = { retryAfter: 60 };
      const error = new NAuthClientError(NAuthErrorCode.RATE_LIMIT_LOGIN, 'Rate limited', {
        details,
      });
      expect(error.getDetails()).toEqual(details);
    });

    it('should return undefined when details not available', () => {
      const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      expect(error.getDetails()).toBeUndefined();
    });
  });

  describe('getCode', () => {
    it('should return error code', () => {
      const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      expect(error.getCode()).toBe(NAuthErrorCode.VALIDATION_FAILED);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const details = { field: 'email' };
      const error = new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Validation failed', {
        details,
        statusCode: 400,
        timestamp: '2024-01-01T00:00:00.000Z',
      });
      const json = error.toJSON();
      expect(json).toEqual({
        code: NAuthErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details,
        statusCode: 400,
      });
    });
  });
});
