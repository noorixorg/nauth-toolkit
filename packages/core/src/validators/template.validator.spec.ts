/**
 * Template Validator Unit Tests
 *
 * Tests template validation functionality including:
 * - Required parameter validation
 * - Custom template definition validation
 * - Template parameter help text
 */

import { TemplateType } from '../interfaces/template.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import {
  validateTemplateParams,
  validateCustomTemplate,
  getTemplateParamsHelp,
  TEMPLATE_REQUIRED_PARAMS,
} from './template.validator';

describe('Template Validator', () => {
  describe('validateTemplateParams', () => {
    it('should pass validation when all required parameters are present', () => {
      const template = '<html>{{code}} {{link}} {{expiryMinutes}}</html>';
      expect(() => validateTemplateParams(TemplateType.VERIFICATION, template)).not.toThrow();
    });

    it('should throw error when required parameters are missing', () => {
      const template = '<html>{{code}}</html>';
      expect(() => validateTemplateParams(TemplateType.VERIFICATION, template)).toThrow(NAuthException);
      expect(() => validateTemplateParams(TemplateType.VERIFICATION, template)).toThrow(
        'Missing required parameters: link, expiryMinutes',
      );
    });

    it('should handle templates with no required parameters', () => {
      const template = '<html>Welcome!</html>';
      expect(() => validateTemplateParams(TemplateType.WELCOME, template)).not.toThrow();
    });

    it('should extract variables from Handlebars conditionals', () => {
      const template = '<html>{{#if code}}{{code}}{{/if}} {{link}}</html>';
      expect(() => validateTemplateParams(TemplateType.VERIFICATION, template)).toThrow();
      // Should detect code but still missing expiryMinutes
    });

    it('should extract variables from Handlebars each loops', () => {
      const template = '<html>{{#each items}}{{code}}{{/each}} {{link}} {{expiryMinutes}}</html>';
      expect(() => validateTemplateParams(TemplateType.VERIFICATION, template)).not.toThrow();
    });

    it('should validate PASSWORD_RESET template', () => {
      const template = '<html>{{link}} {{expiryMinutes}}</html>';
      expect(() => validateTemplateParams(TemplateType.PASSWORD_RESET, template)).not.toThrow();
    });

    it('should validate ADMIN_PASSWORD_RESET template', () => {
      const template = '<html>{{code}} {{link}} {{expiryMinutes}}</html>';
      expect(() => validateTemplateParams(TemplateType.ADMIN_PASSWORD_RESET, template)).not.toThrow();
    });

    it('should validate ACCOUNT_LOCKOUT template', () => {
      const template = '<html>{{reason}} {{durationMinutes}}</html>';
      expect(() => validateTemplateParams(TemplateType.ACCOUNT_LOCKOUT, template)).not.toThrow();
    });

    it('should validate NEW_DEVICE template', () => {
      const template = '<html>{{deviceName}} {{timestamp}}</html>';
      expect(() => validateTemplateParams(TemplateType.NEW_DEVICE, template)).not.toThrow();
    });

    it('should validate EMAIL_CHANGED template', () => {
      const template = '<html>{{userEmail}}</html>';
      expect(() => validateTemplateParams(TemplateType.EMAIL_CHANGED, template)).not.toThrow();
    });

    it('should validate ADAPTIVE_MFA_RISK_ALERT template', () => {
      const template = '<html>{{riskLevel}} {{riskFactors}}</html>';
      expect(() => validateTemplateParams(TemplateType.ADAPTIVE_MFA_RISK_ALERT, template)).not.toThrow();
    });

    it('should validate ACCOUNT_DISABLED template', () => {
      const template = '<html>{{reason}}</html>';
      expect(() => validateTemplateParams(TemplateType.ACCOUNT_DISABLED, template)).not.toThrow();
    });

    it('should validate SESSIONS_REVOKED template', () => {
      const template = '<html>{{revokedCount}}</html>';
      expect(() => validateTemplateParams(TemplateType.SESSIONS_REVOKED, template)).not.toThrow();
    });

    it('should handle unknown template types gracefully', () => {
      const template = '<html>Test</html>';
      expect(() => validateTemplateParams('UNKNOWN_TYPE' as TemplateType, template)).not.toThrow();
    });
  });

  describe('validateCustomTemplate', () => {
    it('should pass validation with htmlPath', () => {
      const definition = { htmlPath: './template.html.hbs' };
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).not.toThrow();
    });

    it('should pass validation with html content', () => {
      const definition = { html: '<html>{{code}} {{link}} {{expiryMinutes}}</html>' };
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition, definition.html)).not.toThrow();
    });

    it('should throw error when neither htmlPath nor html is provided', () => {
      const definition = {};
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).toThrow(NAuthException);
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).toThrow(
        'Must provide either "htmlPath" or "html" content',
      );
    });

    it('should throw error when both htmlPath and html are provided', () => {
      const definition = {
        htmlPath: './template.html.hbs',
        html: '<html>Test</html>',
      };
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).toThrow(NAuthException);
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).toThrow(
        'Cannot provide both "htmlPath" and "html"',
      );
    });

    it('should throw error when both textPath and text are provided', () => {
      const definition = {
        htmlPath: './template.html.hbs',
        textPath: './template.txt.hbs',
        text: 'Test text',
      };
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).toThrow(NAuthException);
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition)).toThrow(
        'Cannot provide both "textPath" and "text"',
      );
    });

    it('should validate template content when provided', () => {
      const definition = { html: '<html>{{code}}</html>' };
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition, definition.html)).toThrow(
        'Missing required parameters',
      );
    });

    it('should pass when template content is valid', () => {
      const definition = { html: '<html>{{code}} {{link}} {{expiryMinutes}}</html>' };
      expect(() => validateCustomTemplate(TemplateType.VERIFICATION, definition, definition.html)).not.toThrow();
    });
  });

  describe('getTemplateParamsHelp', () => {
    it('should return help text for template with required parameters', () => {
      const help = getTemplateParamsHelp(TemplateType.VERIFICATION);
      expect(help).toContain('Template:');
      expect(help).toContain('verification');
      expect(help).toContain('Required parameters');
      expect(help).toContain('{{code}}');
      expect(help).toContain('{{link}}');
      expect(help).toContain('{{expiryMinutes}}');
      expect(help).toContain('Optional parameters');
    });

    it('should return help text for template without required parameters', () => {
      const help = getTemplateParamsHelp(TemplateType.WELCOME);
      expect(help).toContain('Template:');
      expect(help).toContain('welcome');
      expect(help).toContain('No required parameters.');
      expect(help).toContain('Optional parameters');
    });

    it('should include all optional parameter categories', () => {
      const help = getTemplateParamsHelp(TemplateType.VERIFICATION);
      expect(help).toContain('User:');
      expect(help).toContain('Branding:');
      expect(help).toContain('Support:');
      expect(help).toContain('Social:');
    });
  });

  describe('TEMPLATE_REQUIRED_PARAMS', () => {
    it('should have required params for all template types', () => {
      const allTypes = Object.values(TemplateType);
      allTypes.forEach((type) => {
        expect(TEMPLATE_REQUIRED_PARAMS[type]).toBeDefined();
        expect(Array.isArray(TEMPLATE_REQUIRED_PARAMS[type])).toBe(true);
      });
    });
  });
});
