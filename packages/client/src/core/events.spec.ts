/**
 * Events Unit Tests
 *
 * Tests event emitter functionality.
 */

import { EventEmitter, AuthEvent } from './events';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on and off', () => {
    it('should subscribe to specific event', () => {
      const listener = jest.fn();
      const unsubscribe = emitter.on('auth:login', listener);

      const event: AuthEvent = {
        type: 'auth:login',
        data: { identifier: 'test@example.com' },
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(event);
      unsubscribe();
    });

    it('should unsubscribe from event', () => {
      const listener = jest.fn();
      const unsubscribe = emitter.on('auth:login', listener);
      unsubscribe();

      const event: AuthEvent = {
        type: 'auth:login',
        data: { identifier: 'test@example.com' },
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should subscribe to all events with wildcard', () => {
      const listener = jest.fn();
      emitter.on('*', listener);

      const event: AuthEvent = {
        type: 'auth:login',
        data: { identifier: 'test@example.com' },
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      emitter.on('auth:login', listener1);
      emitter.on('auth:login', listener2);

      const event: AuthEvent = {
        type: 'auth:login',
        data: { identifier: 'test@example.com' },
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });
  });

  describe('emit', () => {
    it('should emit to specific event listeners', () => {
      const listener = jest.fn();
      emitter.on('auth:success', listener);

      const event: AuthEvent = {
        type: 'auth:success',
        data: {
          sub: 'user-123',
          accessToken: 'token',
          refreshToken: 'refresh',
        },
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should emit to wildcard listeners', () => {
      const wildcardListener = jest.fn();
      emitter.on('*', wildcardListener);

      const event: AuthEvent = {
        type: 'auth:error',
        data: new NAuthClientError(NAuthErrorCode.VALIDATION_FAILED, 'Error'),
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(wildcardListener).toHaveBeenCalledWith(event);
    });

    it('should handle listener errors gracefully', () => {
      const orig = console.error;
      try {
        console.error = jest.fn();
        const errorListener = jest.fn(() => {
          throw new Error('Listener error');
        });
        const goodListener = jest.fn();
        emitter.on('auth:login', errorListener);
        emitter.on('auth:login', goodListener);

        const event: AuthEvent = {
          type: 'auth:login',
          data: { identifier: 'test@example.com' },
          timestamp: Date.now(),
        };

        expect(() => emitter.emit(event)).not.toThrow();
        expect(goodListener).toHaveBeenCalledWith(event);
      } finally {
        console.error = orig;
      }
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      emitter.on('auth:login', listener1);
      emitter.on('auth:signup', listener2);

      emitter.clear();

      const event: AuthEvent = {
        type: 'auth:login',
        data: { identifier: 'test@example.com' },
        timestamp: Date.now(),
      };
      emitter.emit(event);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });
});
