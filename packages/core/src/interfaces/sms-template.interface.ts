/**
 * SMS Template System Interfaces
 *
 * Provides flexible template system for SMS notifications with support for:
 * - Text templates with placeholder tokens ({{variable}})
 * - Built-in and custom variables
 * - Multiple template types (verification, MFA, password reset)
 * - Handlebars syntax for template rendering
 */

/**
 * SMS Template Type
 *
 * Enum of available SMS template types
 */
export enum SMSTemplateType {
  /**
   * Phone verification code template
   * Required variables: {{code}}, {{expiryMinutes}}
   */
  VERIFICATION = 'verification',

  /**
   * MFA code template
   * Required variables: {{code}}, {{expiryMinutes}}
   */
  MFA = 'mfa',

  /**
   * Password reset code template
   * Required variables: {{code}}, {{expiryMinutes}}
   */
  PASSWORD_RESET = 'passwordReset',
}

/**
 * SMS Template Variables
 *
 * Variables that can be used in SMS templates.
 * All variables are optional as not all templates use all variables.
 */
export interface SMSTemplateVariables {
  // User information
  appName?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  userEmail?: string;
  phone?: string;

  // Verification and authentication
  code?: string;
  expiryMinutes?: number;

  // Company branding (custom variables)
  companyName?: string;
  supportPhone?: string;

  // Allow any custom variables
  [key: string]: string | number | boolean | undefined;
}

/**
 * SMS Template
 *
 * Defines the structure of an SMS template (text only, no HTML/subject).
 * Content supports placeholder variables using Handlebars syntax.
 */
export interface SMSTemplate {
  /**
   * SMS message content (supports {{variables}})
   * Plain text only - SMS does not support HTML formatting
   */
  content: string;
}

/**
 * Template Source
 *
 * Defines how SMS template content can be provided - as a string or file path
 */
export interface SMSTemplateSource {
  /**
   * Template content as string
   * Mutually exclusive with filePath
   */
  content?: string;

  /**
   * Path to template file
   * Mutually exclusive with content
   */
  filePath?: string;
}

/**
 * Custom SMS Template Definition
 *
 * Allows specifying SMS templates as file paths or inline content.
 * All templates support Handlebars syntax for dynamic content.
 *
 * @example
 * ```typescript
 * const customTemplate: CustomSMSTemplateDefinition = {
 *   contentPath: './sms-templates/verification.txt.hbs',
 *   // OR
 *   content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
 * };
 * ```
 */
export interface CustomSMSTemplateDefinition {
  /**
   * Path to SMS template file
   * Mutually exclusive with `content`
   */
  contentPath?: string;

  /**
   * SMS template content as string
   * Mutually exclusive with `contentPath`
   */
  content?: string;
}

/**
 * SMS Template Engine Interface
 *
 * Contract for template engines that can render SMS templates with variables.
 * Implementations can support Handlebars or other template formats.
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
export interface SMSTemplateEngine {
  /**
   * Render a template with the provided variables
   *
   * @param type - Type of template to render
   * @param variables - Variables to inject into the template
   * @returns Rendered SMS template with content
   *
   * @throws {Error} If template type is not found
   *
   * @example
   * ```typescript
   * const result = await engine.render(
   *   SMSTemplateType.VERIFICATION,
   *   {
   *     appName: 'My App',
   *     code: '123456',
   *     expiryMinutes: 5
   *   }
   * );
   * ```
   */
  render(type: SMSTemplateType | string, variables: SMSTemplateVariables): Promise<SMSTemplate>;

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
   *   content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
   * });
   * ```
   */
  registerTemplate(type: SMSTemplateType | string, template: SMSTemplate): void;

  /**
   * Register a custom template from mixed sources (strings or files)
   *
   * Flexible registration that supports both inline content and file paths.
   *
   * @param type - Template type identifier
   * @param templateSource - Template source (content or file path)
   *
   * @example
   * ```typescript
   * engine.registerTemplateFromSources(SMSTemplateType.VERIFICATION, {
   *   content: { content: '{{appName}}: Your code is {{code}}.' },
   * });
   * // OR
   * engine.registerTemplateFromSources(SMSTemplateType.MFA, {
   *   content: { filePath: './sms-templates/mfa.txt.hbs' },
   * });
   * ```
   */
  registerTemplateFromSources(
    type: SMSTemplateType | string,
    templateSource: { content: SMSTemplateSource },
  ): Promise<void>;
}

/**
 * SMS Template Configuration
 *
 * Configuration options for the SMS template system.
 * Used in AuthModule.forRoot() configuration.
 *
 * Custom templates are validated at startup to ensure they include
 * all required parameters for their template type.
 *
 * @example
 * ```typescript
 * AuthModule.forRoot({
 *   sms: {
 *     templates: {
 *       // Global variables (optional, available to all templates)
 *       globalVariables: {
 *         appName: 'My Application',
 *         companyName: 'My Company Inc.',
 *         supportPhone: '+1-800-123-4567',
 *       },
 *       // Custom templates (override defaults)
 *       customTemplates: {
 *         verification: {
 *           content: '{{appName}}: Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes.',
 *           // Must include: {{code}}, {{expiryMinutes}}
 *         },
 *         mfa: {
 *           contentPath: './sms-templates/mfa.txt.hbs',
 *           // Must include: {{code}}, {{expiryMinutes}}
 *         },
 *       },
 *     },
 *   },
 * });
 * ```
 */
export interface SMSTemplateConfig {
  /**
   * Template engine instance
   *
   * @default SMSTemplateEngine with default templates
   */
  engine?: SMSTemplateEngine;

  /**
   * Global variables available to all templates
   *
   * These are merged with template-specific variables at render time.
   * Template-specific variables take precedence over globals.
   *
   * Common global variables:
   * - appName: Your application name
   * - companyName: Your company name
   * - supportPhone: Support contact phone number
   *
   * Optional user-specific variables (injected at runtime):
   * - firstName, lastName, userName: User information
   *
   * @example
   * ```typescript
   * globalVariables: {
   *   appName: process.env.APP_NAME || 'My App',
   *   companyName: 'My Company Inc.',
   *   supportPhone: '+1-800-123-4567',
   * }
   * ```
   */
  globalVariables?: SMSTemplateVariables;

  /**
   * Custom template definitions
   *
   * Override default templates or add new ones.
   * Templates are validated at startup to ensure required parameters are present.
   *
   * Key is the template type, value is the template definition.
   * Templates can be provided as file paths or inline content.
   *
   * All templates support Handlebars syntax:
   * - {{variable}}: Insert variable
   * - {{#if variable}}...{{/if}}: Conditional
   * - {{#each items}}...{{/each}}: Loop
   *
   * Required parameters by template type:
   * - verification: {{code}}, {{expiryMinutes}}
   * - mfa: {{code}}, {{expiryMinutes}}
   * - passwordReset: {{code}}, {{expiryMinutes}}
   *
   * @example
   * ```typescript
   * customTemplates: {
   *   // File-based template
   *   verification: {
   *     contentPath: './sms-templates/verification.txt.hbs',
   *   },
   *   // Inline template
   *   mfa: {
   *     content: '{{appName}}: Your MFA code is {{code}}. Valid for {{expiryMinutes}} minutes.',
   *   },
   * }
   * ```
   */
  customTemplates?: Record<string, CustomSMSTemplateDefinition>;
}
