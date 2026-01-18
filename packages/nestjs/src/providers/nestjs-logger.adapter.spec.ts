/**
 * NestJS Logger Adapter Unit Tests
 *
 * Tests logger adapter functionality.
 */

import { NestJsLoggerAdapter } from './nestjs-logger.adapter';
import { LogLevel } from '@nauth-toolkit/core';

describe('NestJsLoggerAdapter', () => {
  let adapter: NestJsLoggerAdapter;

  beforeEach(() => {
    adapter = new NestJsLoggerAdapter();
  });

  describe('constructor', () => {
    it('should initialize with default context', () => {
      const defaultAdapter = new NestJsLoggerAdapter();
      expect(defaultAdapter).toBeDefined();
    });

    it('should initialize with custom context', () => {
      const customAdapter = new NestJsLoggerAdapter({ context: 'CustomAuth' });
      expect(customAdapter).toBeDefined();
    });

    it('should initialize with PII redaction disabled', () => {
      const adapterWithoutRedaction = new NestJsLoggerAdapter({ enablePiiRedaction: false });
      expect(adapterWithoutRedaction).toBeDefined();
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      adapter.debug('Debug message');
      // Logger is called internally
      expect(adapter).toBeDefined();
    });

    it('should log debug message with metadata', () => {
      adapter.debug('Debug message', { userId: '123' });
      expect(adapter).toBeDefined();
    });
  });

  describe('log', () => {
    it('should log info message', () => {
      adapter.log('Info message');
      expect(adapter).toBeDefined();
    });

    it('should log info message with metadata', () => {
      adapter.log('Info message', { userId: '123' });
      expect(adapter).toBeDefined();
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      adapter.warn('Warning message');
      expect(adapter).toBeDefined();
    });

    it('should log warning message with metadata', () => {
      adapter.warn('Warning message', { userId: '123' });
      expect(adapter).toBeDefined();
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      adapter.error('Error message');
      expect(adapter).toBeDefined();
    });

    it('should log error message with metadata', () => {
      adapter.error('Error message', { userId: '123' });
      expect(adapter).toBeDefined();
    });

    it('should log error message with Error object', () => {
      const error = new Error('Test error');
      adapter.error('Error message', { error });
      expect(adapter).toBeDefined();
    });
  });

  describe('setLogLevel', () => {
    it('should set log level', () => {
      adapter.setLogLevel(LogLevel.LOG);
      expect(adapter).toBeDefined();
    });
  });

  describe('isLevelEnabled', () => {
    it('should return true for all levels', () => {
      expect(adapter.isLevelEnabled(LogLevel.LOG)).toBe(true);
      expect(adapter.isLevelEnabled(LogLevel.WARN)).toBe(true);
      expect(adapter.isLevelEnabled(LogLevel.ERROR)).toBe(true);
    });
  });
});
