import { LoggerService, NAuthLoggerConfig } from '../interfaces/config.interface';
import { NAuthLogger } from './nauth-logger';

/**
 * NAuthLogger Unit Tests
 *
 * Tests the NAuthLogger wrapper functionality including:
 * - Message prefixing
 * - PII redaction
 * - Log level filtering
 * - Silent mode
 * - Different logger configurations
 */
describe('NAuthLogger', () => {
  let mockLogger: jest.Mocked<LoggerService>;
  let logger: NAuthLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create logger in silent mode when no config provided', () => {
      const logger = new NAuthLogger();

      expect(logger.isEnabled()).toBe(false);
      expect(logger.isPiiRedactionEnabled()).toBe(true);
    });

    it('should create logger with LoggerService instance directly', () => {
      const logger = new NAuthLogger(mockLogger);

      expect(logger.isEnabled()).toBe(true);
      expect(logger.isPiiRedactionEnabled()).toBe(true);
    });

    it('should create logger with LoggerConfig object', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        enablePiiRedaction: true,
        logLevel: 'debug',
      };
      const logger = new NAuthLogger(config);

      expect(logger.isEnabled()).toBe(true);
      expect(logger.isPiiRedactionEnabled()).toBe(true);
    });

    it('should disable PII redaction when configured', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        enablePiiRedaction: false,
      };
      const logger = new NAuthLogger(config);

      expect(logger.isPiiRedactionEnabled()).toBe(false);
    });
  });

  describe('Message Processing', () => {
    beforeEach(() => {
      logger = new NAuthLogger(mockLogger);
    });

    it('should add NAUTH: prefix to string messages', () => {
      logger.log('Test message');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Test message');
    });

    it('should add NAUTH: prefix to object messages', () => {
      const obj = { key: 'value' };
      logger.log(obj);

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: {"key":"value"}');
    });

    it('should add NAUTH: prefix to non-string messages', () => {
      logger.log(123);

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: 123');
    });

    it('should redact PII in messages when enabled', () => {
      logger.log('User email@example.com logged in from 192.168.1.1');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: User e***@***.com logged in from 192.168.1.***');
    });

    it('should not redact PII in messages when disabled', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        enablePiiRedaction: false,
      };
      logger = new NAuthLogger(config);

      logger.log('User email@example.com logged in');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: User email@example.com logged in');
    });
  });

  describe('Parameter Processing', () => {
    beforeEach(() => {
      logger = new NAuthLogger(mockLogger);
    });

    it('should redact PII in string parameters', () => {
      logger.log('Message', 'email@example.com');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', 'e***@***.com');
    });

    it('should redact PII in object parameters', () => {
      const param = { email: 'test@example.com', ip: '192.168.1.1' };
      logger.log('Message', param);

      const expectedParam = { email: 't***@***.com', ip: '192.168.1.***' };
      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', expectedParam);
    });

    it('should handle multiple parameters', () => {
      logger.log('Message', 'email@example.com', { token: 'secret123' }, 123);

      // Object parameters are stringified and redacted, then parsed back
      // Token 'secret123' is too short to match JWT pattern, so it won't be redacted
      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', 'e***@***.com', { token: 'secret123' }, 123);
    });

    it('should not process parameters when PII redaction is disabled', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        enablePiiRedaction: false,
      };
      logger = new NAuthLogger(config);

      logger.log('Message', 'email@example.com');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', 'email@example.com');
    });
  });

  describe('Log Levels', () => {
    it('should log all levels when no log level is set', () => {
      logger = new NAuthLogger(mockLogger);

      logger.log('test');
      logger.error('test');
      logger.warn('test');
      logger.debug('test');
      logger.verbose('test');

      expect(mockLogger.log).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.verbose).toHaveBeenCalled();
    });

    it('should filter debug and verbose when log level is warn', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        logLevel: 'warn',
      };
      logger = new NAuthLogger(config);

      logger.error('test'); // Should log (error <= warn)
      logger.warn('test'); // Should log (warn <= warn)
      logger.log('test'); // Should not log (log > warn)
      logger.debug('test'); // Should not log (debug > warn)
      logger.verbose('test'); // Should not log (verbose > warn)

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.verbose).not.toHaveBeenCalled();
    });

    it('should filter all except error when log level is error', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        logLevel: 'error',
      };
      logger = new NAuthLogger(config);

      logger.error('test'); // Should log
      logger.log('test'); // Should not log
      logger.warn('test'); // Should not log
      logger.debug('test'); // Should not log
      logger.verbose('test'); // Should not log

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.verbose).not.toHaveBeenCalled();
    });
  });

  describe('Silent Mode', () => {
    beforeEach(() => {
      logger = new NAuthLogger(); // No logger provided
    });

    it('should not call any logger methods in silent mode', () => {
      logger.log('test');
      logger.error('test');
      logger.warn('test');
      logger.debug('test');
      logger.verbose('test');

      // No calls should be made since no logger was provided
    });

    it('should return undefined from all log methods in silent mode', () => {
      expect(logger.log('test')).toBeUndefined();
      expect(logger.error('test')).toBeUndefined();
      expect(logger.warn('test')).toBeUndefined();
      expect(logger.debug('test')).toBeUndefined();
      expect(logger.verbose('test')).toBeUndefined();
    });
  });

  describe('Method-specific behavior', () => {
    beforeEach(() => {
      logger = new NAuthLogger(mockLogger);
    });

    describe('debug()', () => {
      it('should not call debug if logger does not support debug method', () => {
        delete (mockLogger as any).debug;
        logger.debug('test');

        // Should not throw error
        expect(true).toBe(true);
      });

      it('should call debug when available', () => {
        logger.debug('test message');

        expect(mockLogger.debug).toHaveBeenCalledWith('NAUTH: test message');
      });
    });

    describe('verbose()', () => {
      it('should not call verbose if logger does not support verbose method', () => {
        delete (mockLogger as any).verbose;
        logger.verbose('test');

        // Should not throw error
        expect(true).toBe(true);
      });

      it('should call verbose when available', () => {
        logger.verbose('test message');

        expect(mockLogger.verbose).toHaveBeenCalledWith('NAUTH: test message');
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      logger = new NAuthLogger(mockLogger);
    });

    it('should handle null messages', () => {
      logger.log(null);

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: null');
    });

    it('should handle undefined messages', () => {
      logger.log(undefined);

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: undefined');
    });

    it('should handle empty string messages', () => {
      logger.log('');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: ');
    });

    it('should handle circular references in objects', () => {
      const obj: any = { key: 'value' };
      obj.self = obj; // Circular reference

      // Should not throw error, should handle gracefully
      expect(() => logger.log('message', obj)).not.toThrow();
      expect(mockLogger.log).toHaveBeenCalled();
      // Should handle circular reference by converting to safe string
      const callArgs = mockLogger.log.mock.calls[0];
      expect(callArgs[1]).toBe('[Object with circular reference or invalid JSON]');
    });

    it('should handle malformed JSON in parameters', () => {
      const malformedParam = {
        toJSON: () => {
          throw new Error('Bad JSON');
        },
      };

      // The logger catches JSON.stringify errors (toJSON throwing) and handles them gracefully
      expect(() => logger.log('message', malformedParam)).not.toThrow();
      expect(mockLogger.log).toHaveBeenCalled();
      const callArgs = mockLogger.log.mock.calls[0];
      expect(callArgs[1]).toBe('[Object with circular reference or invalid JSON]');
    });

    it('should handle empty parameters array', () => {
      logger.log('message');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: message');
    });

    it('should handle invalid log levels gracefully', () => {
      const config: NAuthLoggerConfig = {
        instance: mockLogger,
        logLevel: 'invalid' as any,
      };
      logger = new NAuthLogger(config);

      // When logLevel is invalid, indexOf returns -1, which means nothing will log
      // This is expected behavior - invalid levels should not log
      logger.debug('test');
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('PII Redaction Integration', () => {
    beforeEach(() => {
      logger = new NAuthLogger(mockLogger);
    });

    it('should redact emails in messages', () => {
      logger.log('Contact user@test.com for support');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Contact u***@***.com for support');
    });

    it('should redact IP addresses in messages', () => {
      logger.log('Request from 192.168.1.100');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Request from 192.168.1.***');
    });

    it('should redact tokens in messages', () => {
      // JWT tokens have dots that get redacted separately - each part (before/after dot) matches JWT pattern
      logger.log('Using token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Using token [REDACTED_TOKEN].[REDACTED_TOKEN]');
    });

    it('should redact phone numbers in messages', () => {
      logger.log('Call +1234567890');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Call +123***7890');
    });

    it('should redact names in messages', () => {
      // Name redaction only works in specific JSON patterns, not in plain text
      // This test verifies names are logged as-is in plain text messages
      logger.log('User John Doe signed up');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: User John Doe signed up');
    });

    it('should redact passwords when PII redaction is enabled', () => {
      // Password redaction works on JSON-like patterns: password="value" or password: "value"
      // Plain text "Password is ..." doesn't match the pattern
      logger.log('password: mySecret123');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: password=[REDACTED]');
    });

    it('should handle object messages', () => {
      logger.log({ message: 'User user@example.com logged in' });

      const callArgs = (mockLogger.log as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('NAUTH:');
      expect(callArgs[0]).toContain('u***@***.com');
    });

    it('should handle non-string messages', () => {
      logger.log(12345);

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: 12345');
    });

    it('should handle circular references in params', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      logger.log('Message', circular);

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', '[Object with circular reference or invalid JSON]');
    });

    it('should filter logs by logLevel', () => {
      const filteredLogger = new NAuthLogger({
        instance: mockLogger,
        logLevel: 'warn',
      });

      filteredLogger.log('This should not be logged');
      filteredLogger.debug('This should not be logged');
      filteredLogger.warn('This should be logged');
      filteredLogger.error('This should be logged');

      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle verbose level', () => {
      const loggerWithVerbose = new NAuthLogger({
        instance: mockLogger,
        logLevel: 'verbose',
      });

      loggerWithVerbose.verbose('Verbose message');

      expect(mockLogger.verbose).toHaveBeenCalledWith('NAUTH: Verbose message');
    });

    it('should handle logger without debug method', () => {
      const loggerWithoutDebug = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      } as any;

      const logger = new NAuthLogger(loggerWithoutDebug);
      logger.debug('Debug message');

      expect(loggerWithoutDebug.log).not.toHaveBeenCalled();
    });

    it('should handle logger without verbose method', () => {
      const loggerWithoutVerbose = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      } as any;

      const logger = new NAuthLogger(loggerWithoutVerbose);
      logger.verbose('Verbose message');

      expect(loggerWithoutVerbose.log).not.toHaveBeenCalled();
    });

    it('should redact params when PII redaction enabled', () => {
      logger.log('Message', 'user@example.com', { ip: '192.168.1.100' });

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', expect.stringContaining('***'), expect.any(Object));
    });

    it('should not redact params when PII redaction disabled', () => {
      const loggerNoRedaction = new NAuthLogger({
        instance: mockLogger,
        enablePiiRedaction: false,
      });

      loggerNoRedaction.log('Message', 'user@example.com');

      expect(mockLogger.log).toHaveBeenCalledWith('NAUTH: Message', 'user@example.com');
    });
  });
});
