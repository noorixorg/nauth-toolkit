import { SMSTemplateEngineImpl } from './sms-template.engine';
import { SMSTemplateType } from '../interfaces/sms-template.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthLogger } from '../utils/nauth-logger';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { rmdir } from 'fs';

const rmdirAsync = promisify(rmdir);

describe('SMSTemplateEngineImpl', () => {
  let engine: SMSTemplateEngineImpl;
  let testDir: string;

  beforeEach(() => {
    engine = new SMSTemplateEngineImpl();
    // Use __dirname to ensure correct path resolution regardless of working directory
    // __dirname points to the directory containing this test file
    testDir = join(__dirname, '..', '..', 'test-sms-templates');
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files (but keep directory for next test)
    if (existsSync(testDir)) {
      try {
        if (existsSync(join(testDir, 'test-template.txt.hbs'))) {
          unlinkSync(join(testDir, 'test-template.txt.hbs'));
        }
        // Don't remove the directory - let it persist for other tests
        // rmdirAsync(testDir).catch(() => {
        //   // Ignore cleanup errors
        // });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should be defined', () => {
    expect(engine).toBeDefined();
  });

  describe('render', () => {
    it('should render verification template with all variables', async () => {
      const variables = {
        appName: 'Test App',
        code: '123456',
        expiryMinutes: 5,
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await engine.render(SMSTemplateType.VERIFICATION, variables);

      expect(result.content).toContain('123456');
      expect(result.content).toContain('5');
      expect(result.content).toContain('verification code');
    });

    it('should render MFA template with all variables', async () => {
      const variables = {
        appName: 'Test App',
        code: '654321',
        expiryMinutes: 10,
      };

      const result = await engine.render(SMSTemplateType.MFA, variables);

      expect(result.content).toContain('654321');
      expect(result.content).toContain('10');
      expect(result.content).toContain('MFA code');
    });

    it('should render password reset template with all variables', async () => {
      const variables = {
        appName: 'Test App',
        code: '789012',
        expiryMinutes: 15,
      };

      const result = await engine.render(SMSTemplateType.PASSWORD_RESET, variables);

      expect(result.content).toContain('789012');
      expect(result.content).toContain('15');
      expect(result.content).toContain('password reset code');
    });

    it('should handle conditional appName in template', async () => {
      const variablesWithAppName = {
        appName: 'My App',
        code: '123456',
        expiryMinutes: 5,
      };

      const resultWithAppName = await engine.render(SMSTemplateType.VERIFICATION, variablesWithAppName);
      expect(resultWithAppName.content).toContain('My App:');

      const variablesWithoutAppName = {
        code: '123456',
        expiryMinutes: 5,
      };

      const resultWithoutAppName = await engine.render(SMSTemplateType.VERIFICATION, variablesWithoutAppName);
      expect(resultWithoutAppName.content).not.toContain('undefined:');
      expect(resultWithoutAppName.content).toContain('Your verification code is:');
    });

    it('should replace all variables in template', async () => {
      const variables = {
        appName: 'Test App',
        code: '123456',
        expiryMinutes: 5,
        companyName: 'Test Company',
        supportPhone: '+1-800-123-4567',
      };

      const result = await engine.render(SMSTemplateType.VERIFICATION, variables);

      expect(result.content).toContain('123456');
      expect(result.content).toContain('5');
    });

    it('should handle missing variables gracefully', async () => {
      const variables = {
        code: '123456',
        // expiryMinutes missing
      };

      const result = await engine.render(SMSTemplateType.VERIFICATION, variables);

      expect(result.content).toContain('123456');
      // Should not throw error, but may show empty string for missing variable
    });

    it('should throw error for unknown template type', async () => {
      const variables = {
        code: '123456',
        expiryMinutes: 5,
      };

      await expect(engine.render('unknown-template', variables)).rejects.toThrow(NAuthException);
      try {
        await engine.render('unknown-template', variables);
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.INTERNAL_ERROR);
      }
    });
  });

  describe('registerTemplate', () => {
    it('should register and use custom template', async () => {
      const customTemplate: { content: string } = {
        content: 'Custom: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
      };

      engine.registerTemplate('custom', customTemplate);

      const result = await engine.render('custom', {
        code: '999999',
        expiryMinutes: 3,
      });

      expect(result.content).toBe('Custom: Your code is 999999. Expires in 3 min.');
    });

    it('should override default template', async () => {
      const customTemplate: { content: string } = {
        content: 'Custom verification: {{code}}',
      };

      engine.registerTemplate(SMSTemplateType.VERIFICATION, customTemplate);

      const result = await engine.render(SMSTemplateType.VERIFICATION, {
        code: '111111',
        expiryMinutes: 5,
      });

      expect(result.content).toBe('Custom verification: 111111');
    });

    it('should throw error when registering template without content', () => {
      expect(() => {
        engine.registerTemplate('test', {} as { content: string });
      }).toThrow(NAuthException);
    });
  });

  describe('registerTemplateFromSources', () => {
    it('should register template from inline content', async () => {
      await engine.registerTemplateFromSources('inline-test', {
        content: { content: 'Inline template: {{code}}' },
      });

      const result = await engine.render('inline-test', { code: '222222' });
      expect(result.content).toBe('Inline template: 222222');
    });

    it('should register template from file path', async () => {
      // Ensure test directory exists (recreate if needed, as it might be cleaned up)
      // Use mkdirSync with recursive: true to ensure the directory exists
      mkdirSync(testDir, { recursive: true });
      const filePath = join(testDir, 'test-template.txt.hbs');
      const templateContent = 'File template: {{code}} expires in {{expiryMinutes}} min.';
      writeFileSync(filePath, templateContent, 'utf-8');

      await engine.registerTemplateFromSources('file-test', {
        content: { filePath: filePath },
      });

      const result = await engine.render('file-test', {
        code: '333333',
        expiryMinutes: 7,
      });

      expect(result.content).toBe('File template: 333333 expires in 7 min.');

      // Cleanup
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });

    it('should throw error when file does not exist', async () => {
      await expect(
        engine.registerTemplateFromSources('missing-file', {
          content: { filePath: '/nonexistent/path/template.txt.hbs' },
        }),
      ).rejects.toThrow(NAuthException);
    });

    it('should throw error when neither content nor filePath provided', async () => {
      await expect(
        engine.registerTemplateFromSources('invalid', {
          content: {} as { content?: string; filePath?: string },
        }),
      ).rejects.toThrow(NAuthException);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return default templates', () => {
      const templates = engine.getAvailableTemplates();

      expect(templates).toContain(SMSTemplateType.VERIFICATION);
      expect(templates).toContain(SMSTemplateType.MFA);
      expect(templates).toContain(SMSTemplateType.PASSWORD_RESET);
    });

    it('should include custom registered templates', async () => {
      engine.registerTemplate('custom1', { content: 'Template 1' });
      await engine.registerTemplateFromSources('custom2', {
        content: { content: 'Template 2' },
      });

      const templates = engine.getAvailableTemplates();

      expect(templates).toContain('custom1');
      expect(templates).toContain('custom2');
    });
  });

  describe('hasTemplate', () => {
    it('should return true for default templates', () => {
      expect(engine.hasTemplate(SMSTemplateType.VERIFICATION)).toBe(true);
      expect(engine.hasTemplate(SMSTemplateType.MFA)).toBe(true);
      expect(engine.hasTemplate(SMSTemplateType.PASSWORD_RESET)).toBe(true);
    });

    it('should return false for unknown templates', () => {
      expect(engine.hasTemplate('unknown')).toBe(false);
    });

    it('should return true for registered custom templates', () => {
      engine.registerTemplate('custom', { content: 'Test' });
      expect(engine.hasTemplate('custom')).toBe(true);
    });
  });

  describe('validateTemplate', () => {
    it('should validate template has required variables', () => {
      engine.registerTemplate('valid', {
        content: 'Code: {{code}}, Expires: {{expiryMinutes}}',
      });

      expect(engine.validateTemplate('valid', ['code', 'expiryMinutes'])).toBe(true);
    });

    it('should return false when template missing required variables', () => {
      engine.registerTemplate('invalid', {
        content: 'Code: {{code}}',
        // Missing expiryMinutes
      });

      expect(engine.validateTemplate('invalid', ['code', 'expiryMinutes'])).toBe(false);
    });

    it('should return false for non-existent template', () => {
      expect(engine.validateTemplate('nonexistent', ['code'])).toBe(false);
    });

    it('should handle variables with spaces in template', () => {
      engine.registerTemplate('spaced', {
        content: 'Code: {{ code }}, Expires: {{ expiryMinutes }}',
      });

      expect(engine.validateTemplate('spaced', ['code', 'expiryMinutes'])).toBe(true);
    });
  });

  describe('default templates', () => {
    it('should have default verification template', async () => {
      const result = await engine.render(SMSTemplateType.VERIFICATION, {
        code: '123456',
        expiryMinutes: 5,
      });

      expect(result.content).toContain('verification code');
      expect(result.content).toContain('123456');
      expect(result.content).toContain('5');
    });

    it('should have default MFA template', async () => {
      const result = await engine.render(SMSTemplateType.MFA, {
        code: '654321',
        expiryMinutes: 10,
      });

      expect(result.content).toContain('MFA code');
      expect(result.content).toContain('654321');
      expect(result.content).toContain('10');
    });

    it('should have default password reset template', async () => {
      const result = await engine.render(SMSTemplateType.PASSWORD_RESET, {
        code: '789012',
        expiryMinutes: 15,
      });

      expect(result.content).toContain('password reset code');
      expect(result.content).toContain('789012');
      expect(result.content).toContain('15');
    });
  });

  describe('variable replacement', () => {
    it('should handle string variables', async () => {
      engine.registerTemplate('string-test', {
        content: 'Hello {{name}}',
      });

      const result = await engine.render('string-test', { name: 'World' });
      expect(result.content).toBe('Hello World');
    });

    it('should handle number variables', async () => {
      engine.registerTemplate('number-test', {
        content: 'Count: {{count}}',
      });

      const result = await engine.render('number-test', { count: 42 });
      expect(result.content).toBe('Count: 42');
    });

    it('should handle boolean variables', async () => {
      engine.registerTemplate('boolean-test', {
        content: 'Status: {{enabled}}',
      });

      const result = await engine.render('boolean-test', { enabled: true });
      expect(result.content).toBe('Status: true');
    });

    it('should handle undefined variables as empty string', async () => {
      engine.registerTemplate('undefined-test', {
        content: 'Value: {{missing}}',
      });

      const result = await engine.render('undefined-test', {});
      expect(result.content).toBe('Value: ');
    });

    it('should handle null variables as empty string', async () => {
      engine.registerTemplate('null-test', {
        content: 'Value: {{nullValue}}',
      });

      // Note: SMSTemplateVariables doesn't allow null, but we test undefined behavior
      const result = await engine.render('null-test', { nullValue: undefined });
      expect(result.content).toBe('Value: ');
    });
  });

  describe('conditional rendering', () => {
    it('should render conditional block when variable exists', async () => {
      engine.registerTemplate('conditional-test', {
        content: '{{#if appName}}{{appName}}: {{/if}}Code: {{code}}',
      });

      const result = await engine.render('conditional-test', {
        appName: 'My App',
        code: '123456',
      });

      expect(result.content).toContain('My App:');
      expect(result.content).toContain('Code: 123456');
    });

    it('should skip conditional block when variable is missing', async () => {
      engine.registerTemplate('conditional-test', {
        content: '{{#if appName}}{{appName}}: {{/if}}Code: {{code}}',
      });

      const result = await engine.render('conditional-test', {
        code: '123456',
      });

      expect(result.content).not.toContain('undefined:');
      expect(result.content).toContain('Code: 123456');
    });

    it('should skip conditional block when variable is empty string', async () => {
      engine.registerTemplate('conditional-test', {
        content: '{{#if appName}}{{appName}}: {{/if}}Code: {{code}}',
      });

      const result = await engine.render('conditional-test', {
        appName: '',
        code: '123456',
      });

      // Empty string should skip the conditional block (no appName prefix)
      // Result should be "Code: 123456" (no appName: prefix before Code)
      expect(result.content).toBe('Code: 123456');
      expect(result.content).not.toContain('undefined:');
      // Should not start with appName prefix followed by colon and space
      expect(result.content).not.toMatch(/^[A-Za-z0-9\s]+: Code:/);
    });
  });

  describe('constructor with custom baseDir and logger', () => {
    it('should accept custom baseDir', async () => {
      const customDir = join(process.cwd(), 'custom-templates');
      if (!existsSync(customDir)) {
        mkdirSync(customDir, { recursive: true });
      }

      const customEngine = new SMSTemplateEngineImpl(customDir);
      const filePath = join(customDir, 'test.txt.hbs');
      writeFileSync(filePath, 'Custom dir: {{code}}', 'utf-8');

      await customEngine.registerTemplateFromSources('custom-dir-test', {
        content: { filePath: 'test.txt.hbs' },
      });

      const result = await customEngine.render('custom-dir-test', { code: '999999' });
      expect(result.content).toBe('Custom dir: 999999');

      // Cleanup
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      try {
        await rmdirAsync(customDir);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should accept custom logger', () => {
      const logger = new NAuthLogger();
      const customEngine = new SMSTemplateEngineImpl(process.cwd(), logger);
      expect(customEngine).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle template with no variables', async () => {
      engine.registerTemplate('no-vars', {
        content: 'Static message',
      });

      const result = await engine.render('no-vars', {});
      expect(result.content).toBe('Static message');
    });

    it('should handle template with multiple same variable', async () => {
      engine.registerTemplate('multi-var', {
        content: '{{code}} and {{code}} again',
      });

      const result = await engine.render('multi-var', { code: '123456' });
      expect(result.content).toBe('123456 and 123456 again');
    });

    it('should handle special characters in variables', async () => {
      engine.registerTemplate('special-chars', {
        content: 'Message: {{message}}',
      });

      const result = await engine.render('special-chars', {
        message: 'Hello & <world>',
      });
      expect(result.content).toBe('Message: Hello & <world>');
    });

    it('should handle very long variable values', async () => {
      const longValue = 'A'.repeat(1000);
      engine.registerTemplate('long-var', {
        content: 'Value: {{longValue}}',
      });

      const result = await engine.render('long-var', { longValue });
      expect(result.content).toBe(`Value: ${longValue}`);
    });
  });
});
