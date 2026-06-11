/**
 * Console Email Provider Unit Tests
 */

import 'reflect-metadata';
import { ConsoleEmailProvider } from './console-email.provider';
import { LoggerService } from '@nauth-toolkit/core';

describe('ConsoleEmailProvider', () => {
  let provider: ConsoleEmailProvider;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    provider = new ConsoleEmailProvider(mockLogger);
  });

  describe('constructor', () => {
    it('should use provided logger', () => {
      expect(provider).toBeDefined();
    });

    it('should use console as default logger', () => {
      const defaultProvider = new ConsoleEmailProvider();
      expect(defaultProvider).toBeDefined();
    });
  });

  describe('setLogger', () => {
    it('should set logger instance', () => {
      const newLogger = {
        log: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      } as any;

      provider.setLogger(newLogger);
      provider.sendVerificationEmail('test@example.com', '123456');

      expect(newLogger.log).toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('sendVerificationEmail', () => {
    it('should log verification email with code', async () => {
      await provider.sendVerificationEmail('test@example.com', '123456');

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL MESSAGE'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Your verification code is: 123456'));
    });

    it('should log verification email with code and link', async () => {
      await provider.sendVerificationEmail('test@example.com', '123456', 'https://example.com/verify');

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Your verification code is: 123456'));
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Or use this link: https://example.com/verify'),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should log password reset email with code', async () => {
      await provider.sendPasswordResetEmail('test@example.com', 'token', '654321');

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: Password Reset (simulated)'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Your password reset code is: 654321'));
    });

    it('should log password reset email with code and link', async () => {
      await provider.sendPasswordResetEmail('test@example.com', 'token', '654321', 'https://example.com/reset', 30);

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Your password reset code is: 654321'));
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Or use this link: https://example.com/reset'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('This code expires in 30 minutes'));
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should log welcome email', async () => {
      await provider.sendWelcomeEmail('test@example.com', 'John Doe');

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: Welcome email sent (simulated)'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Name: John Doe'));
    });
  });

  describe('sendAdminPasswordResetEmail', () => {
    it('should log admin password reset email', async () => {
      await provider.sendAdminPasswordResetEmail('test@example.com', '789012', 'https://example.com/admin/reset', 60);

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: Admin Password Reset (simulated)'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Your admin-initiated password reset code is: 789012'),
      );
    });

    it('should log admin password reset email without link', async () => {
      await provider.sendAdminPasswordResetEmail('test@example.com', '789012', undefined, 30);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Your admin-initiated password reset code is: 789012'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('This code expires in 30 minutes'));
    });
  });

  describe('sendLockoutEmail', () => {
    it('should log lockout email', async () => {
      await provider.sendLockoutEmail('test@example.com', 'Too many failed attempts', 300);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('EMAIL: Account lockout notification'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Reason: Too many failed attempts'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Duration: 5 minutes'));
    });
  });

  describe('sendNewDeviceEmail', () => {
    it('should log new device email with all info', async () => {
      await provider.sendNewDeviceEmail('test@example.com', {
        name: 'iPhone 15',
        type: 'mobile',
        ip: '192.168.1.1',
        location: 'New York, US',
      });

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: New device login notification'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Device: iPhone 15'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Type: mobile'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('IP: 192.168.1.1'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Location: New York, US'));
    });

    it('should log new device email with minimal info', async () => {
      await provider.sendNewDeviceEmail('test@example.com', {});

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Device: Unknown'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Type: Unknown'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('IP: Unknown'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Location: Unknown'));
    });
  });

  describe('sendMFAFirstEnabledEmail', () => {
    it('should log MFA first enabled email with context', async () => {
      await provider.sendMFAFirstEnabledEmail('test@example.com', {
        firstMethod: 'totp',
        deviceName: 'Google Authenticator',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: MFA first enabled'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('First method: totp'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Device name: Google Authenticator'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Timestamp: 2024-01-01T00:00:00Z'));
    });

    it('should log MFA first enabled email with minimal context', async () => {
      await provider.sendMFAFirstEnabledEmail('test@example.com', {});

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('First method: Unknown'));
    });
  });

  describe('sendMFADeviceRemovedEmail', () => {
    it('should log MFA device removed email with full context', async () => {
      await provider.sendMFADeviceRemovedEmail('test@example.com', {
        deviceType: 'totp',
        deviceName: 'Google Authenticator',
        removedBy: 'user',
        reason: 'User request',
        remainingDeviceCount: 2,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('EMAIL: MFA method/device removed'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Type: totp'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Device name: Google Authenticator'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Removed by: user'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Reason: User request'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Remaining devices: 2'));
    });

    it('should log MFA device removed email with minimal context', async () => {
      await provider.sendMFADeviceRemovedEmail('test@example.com', {});

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('EMAIL: MFA method/device removed'));
    });
  });

  describe('sendMFAMethodAddedEmail', () => {
    it('should log MFA method added email with full context', async () => {
      await provider.sendMFAMethodAddedEmail('test@example.com', {
        method: 'sms',
        enabledMethods: ['totp', 'sms'],
        deviceName: 'My Phone',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: MFA method added'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Method: sms'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Device name: My Phone'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Enabled methods: totp, sms'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Timestamp: 2024-01-01T00:00:00Z'));
    });

    it('should log MFA method added email with minimal context', async () => {
      await provider.sendMFAMethodAddedEmail('test@example.com', {});

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL: MFA method added'));
    });
  });
});
