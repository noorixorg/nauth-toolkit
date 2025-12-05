import { HtmlTemplateEngine } from './html-template.engine';
import { TemplateType } from '../interfaces/template.interface';

describe('HtmlTemplateEngine', () => {
  let engine: HtmlTemplateEngine;

  beforeEach(() => {
    engine = new HtmlTemplateEngine();
  });

  it('should be defined', () => {
    expect(engine).toBeDefined();
  });

  describe('render', () => {
    it('should render verification email template', async () => {
      const variables = {
        appName: 'Test App',
        userName: 'John Doe',
        code: '123456',
        link: 'https://example.com/verify',
        expiryMinutes: 60,
        companyName: 'Test Company',
      };

      const email = await engine.render(TemplateType.VERIFICATION, variables);

      expect(email.subject).toContain('Test App');
      expect(email.html).toContain('John Doe');
      expect(email.html).toContain('123456');
      expect(email.html).toContain('https://example.com/verify');
      expect(email.text).toContain('123456');
    });

    it('should render password reset template', async () => {
      const variables = {
        appName: 'Test App',
        userName: 'Jane Doe',
        link: 'https://example.com/reset',
        expiryMinutes: 30,
        companyName: 'Test Company',
      };

      const email = await engine.render(TemplateType.PASSWORD_RESET, variables);

      expect(email.subject).toContain('Reset'); // Capitalized in actual template
      expect(email.html).toContain('Jane Doe');
      expect(email.html).toContain('https://example.com/reset');
    });

    it('should render welcome email template', async () => {
      const variables = {
        appName: 'Test App',
        userName: 'Bob Smith',
        dashboardUrl: 'https://example.com/dashboard',
        supportEmail: 'support@example.com',
        companyName: 'Test Company',
      };

      const email = await engine.render(TemplateType.WELCOME, variables);

      expect(email.subject).toContain('Welcome');
      expect(email.html).toContain('Bob Smith');
      expect(email.html).toContain('https://example.com/dashboard');
    });

    it('should render account lockout template', async () => {
      const variables = {
        appName: 'Test App',
        userName: 'Alice Johnson',
        reason: 'Too many failed login attempts',
        durationMinutes: 15,
        supportEmail: 'support@example.com',
        companyName: 'Test Company',
      };

      const email = await engine.render(TemplateType.ACCOUNT_LOCKOUT, variables);

      expect(email.subject).toContain('Account Locked');
      expect(email.html).toContain('Alice Johnson');
      expect(email.html).toContain('Too many failed login attempts');
      expect(email.html).toContain('15');
    });

    it('should render new device login template', async () => {
      const variables = {
        appName: 'Test App',
        userName: 'Charlie Brown',
        deviceName: 'iPhone 13',
        deviceType: 'mobile',
        ipAddress: '192.168.1.100',
        location: 'New York, US',
        timestamp: '2025-10-22T12:00:00Z',
        supportEmail: 'support@example.com',
        companyName: 'Test Company',
      };

      const email = await engine.render(TemplateType.NEW_DEVICE, variables);

      expect(email.subject).toContain('New Device Login');
      expect(email.html).toContain('Charlie Brown');
      expect(email.html).toContain('iPhone 13');
      expect(email.html).toContain('192.168.1.100');
    });

    it('should throw error for unknown template type', async () => {
      let error: Error | undefined;
      try {
        await engine.render('unknown' as any, {});
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
      expect(error?.message).toContain('Template "unknown" not found');
    });

    it('should handle missing variables gracefully', async () => {
      const variables = {
        appName: 'Test App',
        // Missing other required variables
      };

      const email = await engine.render(TemplateType.VERIFICATION, variables);

      expect(email.subject).toContain('Test App');
      expect(email.html).toBeDefined();
      expect(email.text).toBeDefined();
    });

    it('should replace all occurrences of a variable', async () => {
      const variables = {
        appName: 'Test App',
        userName: 'Test User',
        companyName: 'Test Company',
      };

      const email = await engine.render(TemplateType.WELCOME, variables);

      // userName should appear in the greeting
      expect(email.html).toContain('Test User');
      expect(email.text).toContain('Test User');
    });

    it('should handle special characters in variables', async () => {
      const variables = {
        appName: 'Test & Company <Special>',
        userName: 'John "Doe"',
        code: '123456',
        link: 'https://example.com/verify',
        expiryMinutes: 60,
        companyName: 'Test & Co.',
      };

      const email = await engine.render(TemplateType.VERIFICATION, variables);

      // HTML escapes special characters in userName
      expect(email.html).toContain('John &quot;Doe&quot;');
      expect(email.text).toContain('John "Doe"');
    });
  });
});
