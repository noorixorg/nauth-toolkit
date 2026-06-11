import {
  SMSTemplateEngine as ISMSTemplateEngine,
  SMSTemplateType,
  SMSTemplateVariables,
  SMSTemplate,
  SMSTemplateSource,
} from '../interfaces/sms-template.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthLogger } from '../utils/nauth-logger';
import { access, readFileSync } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';

const accessAsync = promisify(access);

/**
 * SMS Template Engine
 *
 * Simple yet powerful template engine for SMS templates using text with placeholder tokens.
 * Supports {{variable}} syntax for variable injection using Handlebars-like syntax.
 *
 * Features:
 * - Simple {{variable}} placeholder syntax
 * - Built-in default templates for all SMS types
 * - Custom template registration (inline and file-based)
 * - Template validation (ensures required variables are present)
 * - Handlebars-like conditionals support
 *
 * @example
 * ```typescript
 * const engine = new SMSTemplateEngine();
 * const result = await engine.render(
 *   SMSTemplateType.VERIFICATION,
 *   { appName: 'My App', code: '123456', expiryMinutes: 5 }
 * );
 * // result.content: "My App: Your verification code is 123456. Valid for 5 minutes."
 * ```
 */
export class SMSTemplateEngineImpl implements ISMSTemplateEngine {
  /**
   * Storage for registered templates
   * Maps template type to template content string
   */
  private templates: Map<string, string> = new Map();

  /**
   * Base directory for resolving relative template file paths
   */
  private readonly baseDir: string;

  /**
   * Logger instance for error reporting
   */
  private readonly logger?: NAuthLogger;

  /**
   * Constructor
   *
   * Initializes the engine with default templates.
   *
   * @param baseDir - Base directory for resolving template file paths (default: process.cwd())
   * @param logger - Optional logger instance for error reporting
   *
   * @example
   * ```typescript
   * // Use default templates
   * const engine = new SMSTemplateEngineImpl();
   *
   * // Use custom base directory for file-based templates
   * const engine = new SMSTemplateEngineImpl('./sms-templates');
   * ```
   */
  constructor(baseDir: string = process.cwd(), logger?: NAuthLogger) {
    this.baseDir = baseDir;
    this.logger = logger;
    this.registerDefaultTemplates();
  }

  /**
   * Render a template with variables
   *
   * Replaces all {{variable}} placeholders with actual values.
   * Handles missing variables gracefully (replaces with empty string).
   * Supports simple conditionals like {{#if variable}}...{{/if}}.
   *
   * @param type - Template type to render
   * @param variables - Variables to inject
   * @returns Rendered SMS template with content
   * @throws {NAuthException} If template type not found
   *
   * @example
   * ```typescript
   * const result = await engine.render(
   *   SMSTemplateType.VERIFICATION,
   *   { appName: 'My App', code: '123456', expiryMinutes: 5 }
   * );
   * ```
   */
  async render(type: SMSTemplateType | string, variables: SMSTemplateVariables): Promise<SMSTemplate> {
    const templateContent = this.templates.get(type);

    if (!templateContent) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `SMS template "${type}" not found. Available templates: ${Array.from(this.templates.keys()).join(', ')}`,
      );
    }

    // Merge with default variables
    const allVariables: SMSTemplateVariables = {
      ...variables,
    };

    // Render template content
    const content = this.replaceVariables(templateContent, allVariables);

    return { content };
  }

  /**
   * Register a custom template from inline string
   *
   * Allows overriding default templates or adding new ones.
   *
   * @param type - Template type identifier
   * @param template - Template definition with inline content
   *
   * @example
   * ```typescript
   * engine.registerTemplate(SMSTemplateType.VERIFICATION, {
   *   content: '{{appName}}: Your verification code is {{code}}. Expires in {{expiryMinutes}} min.',
   * });
   * ```
   */
  registerTemplate(type: SMSTemplateType | string, template: SMSTemplate): void {
    if (!template.content) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `SMS template must have content property. Template type: ${type}`,
      );
    }

    this.templates.set(type, template.content);
  }

  /**
   * Register a custom template from mixed sources (strings or files)
   *
   * Flexible registration that supports both inline content and file paths.
   *
   * @param type - Template type identifier
   * @param templateSource - Template source (content or file path)
   *
   * @throws {NAuthException} If file not found or invalid source
   *
   * @example
   * ```typescript
   * // Inline content
   * await engine.registerTemplateFromSources(SMSTemplateType.VERIFICATION, {
   *   content: { content: '{{appName}}: Your code is {{code}}.' },
   * });
   *
   * // File-based
   * await engine.registerTemplateFromSources(SMSTemplateType.MFA, {
   *   content: { filePath: './sms-templates/mfa.txt.hbs' },
   * });
   * ```
   */
  async registerTemplateFromSources(
    type: SMSTemplateType | string,
    templateSource: { content: SMSTemplateSource },
  ): Promise<void> {
    const source = templateSource.content;

    if (!source) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `SMS template source must have content property. Template type: ${type}`,
      );
    }

    let content: string;

    if (source.content) {
      // Inline content
      content = source.content;
    } else if (source.filePath) {
      // File-based content
      const filePath = resolve(this.baseDir, source.filePath);

      try {
        // Check if file exists
        await accessAsync(filePath);
        content = readFileSync(filePath, 'utf-8');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          `Failed to read SMS template file: ${filePath}. Error: ${errorMessage}`,
        );
      }
    } else {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `SMS template source must have either content or filePath. Template type: ${type}`,
      );
    }

    this.templates.set(type, content);
  }

  /**
   * Get all available template types
   *
   * @returns Array of registered template type identifiers
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if a template exists
   *
   * @param type - Template type to check
   * @returns True if template is registered
   */
  hasTemplate(type: SMSTemplateType | string): boolean {
    return this.templates.has(type);
  }

  /**
   * Validate that a template includes required variables
   *
   * Checks if the template content includes all required placeholders.
   *
   * @param type - Template type to validate
   * @param requiredVars - Array of required variable names (without {{}})
   * @returns True if all required variables are present
   *
   * @example
   * ```typescript
   * const isValid = engine.validateTemplate(SMSTemplateType.VERIFICATION, ['code', 'expiryMinutes']);
   * ```
   */
  validateTemplate(type: SMSTemplateType | string, requiredVars: string[]): boolean {
    const templateContent = this.templates.get(type);

    if (!templateContent) {
      return false;
    }

    // Check if all required variables are present in template
    return requiredVars.every((varName) => {
      // Check for {{varName}} or {{ varName }} (with optional spaces)
      const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g');
      return regex.test(templateContent);
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Register default templates for all SMS types
   *
   * Provides sensible defaults that can be overridden by custom templates.
   *
   * @private
   */
  private registerDefaultTemplates(): void {
    // Verification template
    this.templates.set(
      SMSTemplateType.VERIFICATION,
      '{{#if appName}}{{appName}}: {{/if}}Your verification code is: {{code}}. Valid for {{expiryMinutes}} minutes.',
    );

    // MFA template
    this.templates.set(
      SMSTemplateType.MFA,
      '{{#if appName}}{{appName}}: {{/if}}Your MFA code is: {{code}}. Valid for {{expiryMinutes}} minutes.',
    );

    // Password reset template
    this.templates.set(
      SMSTemplateType.PASSWORD_RESET,
      '{{#if appName}}{{appName}}: {{/if}}Your password reset code is: {{code}}. Valid for {{expiryMinutes}} minutes.',
    );
  }

  /**
   * Replace {{variable}} placeholders with values
   *
   * Handles missing variables gracefully (replaces with empty string).
   * Supports simple conditionals like {{#if variable}}...{{/if}}.
   *
   * @param template - Template string with {{placeholders}}
   * @param variables - Variables to inject
   * @returns Template with variables replaced
   * @private
   */
  private replaceVariables(template: string, variables: SMSTemplateVariables): string {
    let result = template;

    // Handle simple conditionals like {{#if appName}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/g, (_match, key, ifContent) => {
      const value = variables[key];
      // Return content if variable exists and is truthy, otherwise empty string
      if (value !== undefined && value !== null && value !== '') {
        return ifContent;
      }
      return '';
    });

    // Replace regular variables {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      const value = variables[key];

      // Return empty string if variable is undefined or null
      if (value === undefined || value === null) {
        return '';
      }

      // Convert to string
      return String(value);
    });

    return result;
  }
}

// Export the implementation class
// Note: SMSTemplateEngine interface is exported from interfaces/sms-template.interface.ts
