/**
 * Nodemailer Email Provider Unit Tests
 *
 * Tests nodemailer email provider functionality.
 */

import { NodemailerProvider } from './nodemailer-email.provider';
import { NodemailerProviderConfig } from './nodemailer-email.provider';
import * as nodemailer from 'nodemailer';
import { LoggerService } from '@nauth-toolkit/core';
import { HandlebarsTemplateEngine } from './templates/handlebars-template.engine';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id', response: '250 OK' }),
    close: jest.fn(),
  }),
  getTestMessageUrl: jest.fn().mockReturnValue('https://ethereal.email/message/test'),
}));

// Mock HandlebarsTemplateEngine
jest.mock('./templates/handlebars-template.engine', () => ({
  HandlebarsTemplateEngine: jest.fn().mockImplementation(() => ({
    render: jest.fn().mockResolvedValue({
      subject: 'Test Subject',
      html: '<html>Test</html>',
      text: 'Test',
    }),
  })),
}));

describe('NodemailerProvider', () => {
  let mockConfig: NodemailerProviderConfig;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockTemplateEngine: jest.Mocked<HandlebarsTemplateEngine>;

  beforeEach(() => {
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id', response: '250 OK' }),
      close: jest.fn(),
    } as any;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockTemplateEngine = {
      render: jest.fn().mockResolvedValue({
        subject: 'Test Subject',
        html: '<html>Test</html>',
        text: 'Test',
      }),
    } as any;

    mockConfig = {
      transport: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'password',
        },
      },
      defaults: {
        from: '"Test App" <noreply@example.com>',
      },
    };
  });

  describe('constructor', () => {
    it('should create NodemailerProvider with transport config', () => {
      const provider = new NodemailerProvider(mockConfig);
      expect(provider).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should create NodemailerProvider with pre-configured transporter', () => {
      const provider = new NodemailerProvider({
        transport: mockTransporter,
      });
      expect(provider).toBeDefined();
    });

    it('should skip verification when skipVerification is true', () => {
      const provider = new NodemailerProvider({
        ...mockConfig,
        skipVerification: true,
      });
      expect(provider).toBeDefined();
      expect(mockTransporter.verify).not.toHaveBeenCalled();
    });

    it('should use custom template engine when provided', () => {
      const provider = new NodemailerProvider({
        ...mockConfig,
        templateEngine: mockTemplateEngine,
      });
      expect(provider).toBeDefined();
    });

    it('should handle verification errors gracefully', async () => {
      mockTransporter.verify = jest.fn().mockRejectedValue(new Error('Connection failed'));
      const provider = new NodemailerProvider(mockConfig);
      expect(provider).toBeDefined();
    });
  });

  describe('setLogger', () => {
    it('should set logger instance', () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      expect(provider).toBeDefined();
    });
  });

  describe('setConfig', () => {
    it('should set config instance', () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setConfig({} as any);
      expect(provider).toBeDefined();
    });
  });

  describe('setGlobalVariables', () => {
    it('should set global template variables', () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setGlobalVariables({ companyName: 'Test Co' });
      expect(provider).toBeDefined();
    });
  });

  describe('getTemplateEngine', () => {
    it('should return template engine instance', () => {
      const provider = new NodemailerProvider(mockConfig);
      const engine = provider.getTemplateEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendVerificationEmail('user@example.com', '123456', 'https://example.com/verify?token=abc');

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should send verification email without link', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendVerificationEmail('user@example.com', '123456', undefined);

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle template rendering errors', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      const mockEngine = provider.getTemplateEngine();
      (mockEngine.render as jest.Mock).mockRejectedValueOnce(new Error('Template error'));

      await expect(provider.sendVerificationEmail('user@example.com', '123456', undefined)).rejects.toThrow();
    });
  });

  describe('sendMFAEmailCode', () => {
    it('should send MFA email code', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendMFAEmailCode('user@example.com', '123456', 5);

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle template rendering errors', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      const mockEngine = provider.getTemplateEngine();
      (mockEngine.render as jest.Mock).mockRejectedValueOnce(new Error('Template error'));

      await expect(provider.sendMFAEmailCode('user@example.com', '123456', 5)).rejects.toThrow();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendPasswordResetEmail(
        'user@example.com',
        'token',
        '123456',
        'https://example.com/reset?token=abc',
        60,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle template rendering errors', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      const mockEngine = provider.getTemplateEngine();
      (mockEngine.render as jest.Mock).mockRejectedValueOnce(new Error('Template error'));

      await expect(
        provider.sendPasswordResetEmail('user@example.com', 'token', '123456', undefined, 60),
      ).rejects.toThrow();
    });
  });

  describe('sendAdminPasswordResetEmail', () => {
    it('should send admin password reset email', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendAdminPasswordResetEmail(
        'user@example.com',
        '123456',
        'https://example.com/admin/reset?token=abc',
        60,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendWelcomeEmail('user@example.com', 'Test User');

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendLockoutEmail', () => {
    it('should send lockout email', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendLockoutEmail('user@example.com', 'Too many attempts', 5);

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendNewDeviceEmail', () => {
    it('should send new device email', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.sendNewDeviceEmail('user@example.com', {
        name: 'iPhone 15',
        type: 'mobile',
        ipAddress: '192.168.1.1',
        location: 'New York',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email when not suppressed', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      provider.setConfig({
        emailNotifications: {
          enabled: true,
          suppress: { passwordChanged: false },
        },
      } as any);

      await provider.sendPasswordChangedEmail('user@example.com', {
        changedBy: 'user',
        sessionsRevoked: 2,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should not send password changed email when suppressed', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      provider.setConfig({
        emailNotifications: {
          enabled: true,
          suppress: { passwordChanged: true },
        },
      } as any);

      await provider.sendPasswordChangedEmail('user@example.com', {});

      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendMFADeviceRemovedEmail', () => {
    it('should send MFA device removed email when not suppressed', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      provider.setConfig({
        emailNotifications: {
          enabled: true,
          suppress: { mfaDeviceRemoved: false },
        },
      } as any);

      await provider.sendMFADeviceRemovedEmail('user@example.com', {
        deviceType: 'totp',
        deviceName: 'Google Authenticator',
        removedBy: 'user',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendMail error handling', () => {
    it('should handle sendMail errors', async () => {
      mockTransporter.sendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);

      await expect(provider.sendVerificationEmail('user@example.com', '123456', undefined)).rejects.toThrow();
    });
  });

  describe('preview mode', () => {
    it('should log preview URL when preview is enabled', async () => {
      const provider = new NodemailerProvider({
        ...mockConfig,
        preview: true,
      });
      provider.setLogger(mockLogger);
      await provider.sendVerificationEmail('user@example.com', '123456', undefined);

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Preview URL'));
    });
  });

  describe('close', () => {
    it('should close transporter', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      await provider.close();

      expect(mockTransporter.close).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle sendMail with custom template engine', async () => {
      const customEngine = {
        render: jest.fn().mockResolvedValue({
          subject: 'Custom Subject',
          html: '<html>Custom</html>',
          text: 'Custom',
        }),
      } as any;

      const provider = new NodemailerProvider({
        ...mockConfig,
        templateEngine: customEngine,
      });
      provider.setLogger(mockLogger);

      await provider.sendVerificationEmail('user@example.com', '123456', undefined);

      expect(customEngine.render).toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle sendMail when emailNotifications disabled', async () => {
      const provider = new NodemailerProvider(mockConfig);
      provider.setLogger(mockLogger);
      provider.setConfig({
        emailNotifications: {
          enabled: false,
        },
      } as any);

      await provider.sendPasswordChangedEmail('user@example.com', {});

      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle sendMail when template engine fails', async () => {
      const failingEngine = {
        render: jest.fn().mockRejectedValue(new Error('Template error')),
      } as any;

      const provider = new NodemailerProvider({
        ...mockConfig,
        templateEngine: failingEngine,
      });
      provider.setLogger(mockLogger);

      await expect(provider.sendVerificationEmail('user@example.com', '123456', undefined)).rejects.toThrow(
        'Template error',
      );
    });
  });
});
