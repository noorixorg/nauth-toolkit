/**
 * Email Template System Interfaces
 *
 * Provides flexible template system for email notifications with support for:
 * - HTML templates with placeholder tokens ({{variable}})
 * - Built-in and custom variables
 * - Multiple template types (verification, password reset, etc.)
 */

/**
 * Template Variables
 *
 * Variables that can be used in email templates.
 * All variables are optional as not all templates use all variables.
 */
export interface TemplateVariables {
  // User information
  appName?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  userEmail?: string;

  // Verification and authentication
  code?: string;
  link?: string;
  expiryMinutes?: number;

  // Security alerts
  reason?: string;
  durationMinutes?: number;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  location?: string;

  // Timestamps
  timestamp?: string;
  currentYear?: number;

  // Company branding (custom variables)
  companyName?: string;
  companyAddress?: string;
  brandColor?: string;
  logoUrl?: string;
  dashboardUrl?: string;
  supportEmail?: string;
  footerDisclaimer?: string;

  // Allow any custom variables
  // NOTE: Handlebars templates can consume objects/arrays for helpers like #each.
  // Using `unknown` avoids `any` while still allowing consumers to pass structured data.
  [key: string]: unknown;
}

/**
 * Email Template
 *
 * Defines the structure of an email template with subject and content.
 * Both subject and content support placeholder variables.
 */
export interface EmailTemplate {
  /**
   * Email subject line (supports {{variables}})
   */
  subject: string;

  /**
   * HTML content of the email (supports {{variables}})
   */
  html: string;

  /**
   * Optional plain text version (supports {{variables}})
   * Falls back to stripping HTML tags if not provided
   */
  text?: string;
}

/**
 * Template Type
 *
 * Enum of available email template types
 */
export enum TemplateType {
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'passwordReset',
  ADMIN_PASSWORD_RESET = 'adminPasswordReset',
  WELCOME = 'welcome',
  ACCOUNT_LOCKOUT = 'accountLockout',
  NEW_DEVICE = 'newDevice',
  PASSWORD_CHANGED = 'passwordChanged',
  EMAIL_CHANGED = 'emailChanged',
  MFA_ENABLED = 'mfaEnabled',
  MFA_DEVICE_REMOVED = 'mfaDeviceRemoved',
  MFA_METHOD_ADDED = 'mfaMethodAdded',
  ADAPTIVE_MFA_RISK_ALERT = 'adaptiveMfaRiskAlert',
  ACCOUNT_DISABLED = 'accountDisabled',
  ACCOUNT_ENABLED = 'accountEnabled',
  EMAIL_CHANGED_OLD = 'emailChangedOld',
  EMAIL_CHANGED_NEW = 'emailChangedNew',
  SESSIONS_REVOKED = 'sessionsRevoked',
}

/**
 * Template Source
 *
 * Defines how template content can be provided - as a string or file path
 */
export interface TemplateSource {
  /**
   * Template content as a string
   */
  content?: string;

  /**
   * Path to template file (relative or absolute)
   * Supports .hbs, .html, .txt, etc.
   */
  filePath?: string;
}

/**
 * Template Files
 *
 * Defines template files for subject, HTML, and text content.
 * Used for file-based template registration.
 *
 * @example
 * ```typescript
 * const templateFiles: TemplateFiles = {
 *   subject: { filePath: './templates/welcome.subject.hbs' },
 *   html: { filePath: './templates/welcome.html.hbs' },
 *   text: { filePath: './templates/welcome.text.hbs' }
 * };
 * ```
 */
export interface TemplateFiles {
  /**
   * Subject line template source
   */
  subject: TemplateSource;

  /**
   * HTML content template source
   */
  html: TemplateSource;

  /**
   * Plain text content template source (optional)
   */
  text?: TemplateSource;
}

/**
 * Template Engine Interface
 *
 * Contract for template engines that can render email templates with variables.
 * Implementations can support HTML, MJML, Handlebars, or other template formats.
 *
 * @example
 * ```typescript
 * const engine = new HandlebarsTemplateEngine();
 * const result = await engine.render(
 *   TemplateType.VERIFICATION,
 *   { userName: 'John', code: '123456' }
 * );
 * logger.debug('Subject:', result.subject); // "Verify your email - My App"
 * logger.debug('HTML generated');    // HTML with variables replaced
 * ```
 */
export interface TemplateEngine {
  /**
   * Render a template with the provided variables
   *
   * @param type - Type of template to render
   * @param variables - Variables to inject into the template
   * @returns Rendered email template with subject and content
   *
   * @throws {Error} If template type is not found
   *
   * @example
   * ```typescript
   * const result = await engine.render(
   *   TemplateType.VERIFICATION,
   *   {
   *     userName: 'John Doe',
   *     code: '123456',
   *     expiryMinutes: 60
   *   }
   * );
   * ```
   */
  render(type: TemplateType | string, variables: TemplateVariables): Promise<EmailTemplate>;

  /**
   * Register a custom template from inline strings
   *
   * Allows overriding default templates or adding new ones.
   *
   * @param type - Template type identifier
   * @param template - Template definition with inline content
   *
   * @example
   * ```typescript
   * engine.registerTemplate(TemplateType.WELCOME, {
   *   subject: 'Welcome {{userName}}!',
   *   html: '<h1>Hello {{userName}}!</h1>',
   *   text: 'Hello {{userName}}!'
   * });
   * ```
   */
  registerTemplate(type: TemplateType | string, template: EmailTemplate): void;

  /**
   * Register a custom template from mixed sources (strings or files)
   *
   * Flexible registration that supports both inline content and file paths.
   *
   * @param type - Template type identifier
   * @param templateSources - Template sources (content or file paths)
   *
   * @example
   * ```typescript
   * engine.registerTemplateFromSources(TemplateType.WELCOME, {
   *   subject: { content: 'Welcome {{userName}}!' },
   *   html: { filePath: './templates/welcome.html.hbs' },
   *   text: { content: 'Welcome {{userName}}!' }
   * });
   * ```
   */
  registerTemplateFromSources?(type: TemplateType | string, templateSources: TemplateFiles): Promise<void>;

  /**
   * Get available template types
   *
   * @returns Array of registered template type identifiers
   */
  getAvailableTemplates(): string[];

  /**
   * Check if a template exists
   *
   * @param type - Template type to check
   * @returns True if template is registered
   */
  hasTemplate(type: TemplateType | string): boolean;
}

/**
 * Required template parameters for each template type
 *
 * Defines which variables MUST be present in custom templates.
 * Optional variables (firstName, lastName, etc.) can be included but are not required.
 */
export interface TemplateRequiredParams {
  /**
   * Email verification template required parameters
   */
  [TemplateType.VERIFICATION]: {
    code: string;
    link: string;
    expiryMinutes: number;
  };

  /**
   * Password reset template required parameters
   */
  [TemplateType.PASSWORD_RESET]: {
    link: string;
    expiryMinutes: number;
  };

  /**
   * Welcome template required parameters
   */
  [TemplateType.WELCOME]: Record<string, never>; // No required params

  /**
   * Account lockout template required parameters
   */
  [TemplateType.ACCOUNT_LOCKOUT]: {
    reason: string;
    durationMinutes: number;
  };

  /**
   * New device template required parameters
   */
  [TemplateType.NEW_DEVICE]: {
    deviceName: string;
    deviceType?: string;
    ipAddress?: string;
    location?: string;
    timestamp: string;
  };

  /**
   * Password changed template required parameters
   */
  [TemplateType.PASSWORD_CHANGED]: Record<string, never>; // No required params

  /**
   * Email changed template required parameters
   */
  [TemplateType.EMAIL_CHANGED]: {
    userEmail: string;
  };

  /**
   * MFA enabled template required parameters
   */
  [TemplateType.MFA_ENABLED]: Record<string, never>; // No required params
}

/**
 * Custom template definition with file paths or content
 *
 * Allows specifying templates as file paths or inline content.
 * All templates support Handlebars syntax for dynamic content.
 *
 * @example
 * ```typescript
 * const customTemplate: CustomTemplateDefinition = {
 *   htmlPath: './templates/verification.html.hbs',
 *   // OR
 *   html: '<html>{{code}}</html>',
 *   // Optional text version
 *   textPath: './templates/verification.text.hbs'
 * };
 * ```
 */
export interface CustomTemplateDefinition {
  /**
   * Path to HTML template file (supports frontmatter for subject)
   * Mutually exclusive with `html`
   */
  htmlPath?: string;

  /**
   * HTML template content as string (supports frontmatter for subject)
   * Mutually exclusive with `htmlPath`
   */
  html?: string;

  /**
   * Path to plain text template file
   * Mutually exclusive with `text`
   */
  textPath?: string;

  /**
   * Plain text template content as string
   * Mutually exclusive with `textPath`
   */
  text?: string;

  /**
   * Email subject (can include Handlebars variables)
   * If not provided, will be extracted from HTML frontmatter
   */
  subject?: string;
}

/**
 * Template Configuration
 *
 * Configuration options for the template system.
 * Used in AuthModule.forRoot() configuration.
 *
 * Custom templates are validated at startup to ensure they include
 * all required parameters for their template type.
 *
 * @example
 * ```typescript
 * AuthModule.forRoot({
 *   email: {
 *     // Global variables (available to all templates)
 *     globalVariables: {
 *       appName: 'My Application',
 *       companyName: 'My Company Inc.',
 *       supportEmail: 'support@example.com',
 *       brandColor: '#4CAF50',
 *       logoUrl: 'https://example.com/logo.png'
 *     },
 *     // Custom templates (override defaults)
 *     templates: {
 *       customTemplates: {
 *         verification: {
 *           htmlPath: './templates/verification.html.hbs',
 *           textPath: './templates/verification.text.hbs'
 *           // Must include: {{code}}, {{link}}, {{expiryMinutes}}
 *         },
 *         welcome: {
 *           html: `
 *             ---
 *             subject: Welcome to {{appName}}!
 *             ---
 *             <h1>Hello {{firstName}}!</h1>
 *           `,
 *           // No required params for welcome
 *         }
 *       }
 *     },
 *   }
 * })
 * ```
 */
export interface TemplateConfig {
  /**
   * Template engine instance
   *
   * @default HandlebarsTemplateEngine with default templates
   */
  engine?: TemplateEngine;

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
   * - verification: {{code}}, {{link}}, {{expiryMinutes}}
   * - passwordReset: {{link}}, {{expiryMinutes}}
   * - accountLockout: {{reason}}, {{durationMinutes}}
   * - newDevice: {{deviceName}}, {{timestamp}}
   * - emailChanged: {{userEmail}}
   * - welcome, passwordChanged, mfaEnabled: No required params
   *
   * @example
   * ```typescript
   * customTemplates: {
   *   // File-based template (with frontmatter for subject)
   *   verification: {
   *     htmlPath: './templates/verification.html.hbs',
   *     textPath: './templates/verification.text.hbs'
   *   },
   *   // Inline template (with frontmatter for subject)
   *   welcome: {
   *     html: `
   *       ---
   *       subject: Welcome to {{appName}}!
   *       ---
   *       <html>
   *         <h1>Hello {{firstName}}!</h1>
   *         <p>Welcome to our platform!</p>
   *       </html>
   *     `
   *   },
   *   // Mixed (HTML from file, explicit subject)
   *   passwordReset: {
   *     subject: 'Reset your password - {{appName}}',
   *     htmlPath: './templates/password-reset.html.hbs',
   *     text: 'Reset link: {{link}} (expires in {{expiryMinutes}} minutes)'
   *   }
   * }
   * ```
   */
  customTemplates?: Record<string, CustomTemplateDefinition>;
}
