import { TemplateEngine, TemplateType, TemplateVariables, EmailTemplate } from '../interfaces/template.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * HTML Template Engine
 *
 * Simple yet powerful template engine for email templates using HTML with placeholder tokens.
 * Supports {{variable}} syntax for variable injection.
 *
 * Features:
 * - Simple {{variable}} placeholder syntax
 * - Built-in default templates for all email types
 * - Custom template registration
 * - Automatic HTML entity escaping for security
 * - Plain text generation from HTML
 *
 * @example
 * ```typescript
 * const engine = new HtmlTemplateEngine();
 * const result = await engine.render(
 *   TemplateType.VERIFICATION,
 *   { userName: 'John', code: '123456', expiryMinutes: 60 }
 * );
 * ```
 */
export class HtmlTemplateEngine implements TemplateEngine {
  /**
   * Storage for registered templates
   * Maps template type to template definition
   */
  private templates: Map<string, EmailTemplate> = new Map();

  /**
   * Constructor
   * Initializes the engine with default templates
   */
  constructor() {
    this.registerDefaultTemplates();
  }

  /**
   * Render a template with variables
   *
   * Replaces all {{variable}} placeholders with actual values.
   * Variables are HTML-escaped for security.
   * Handles firstName/username fallback for greetings.
   *
   * @param type - Template type to render
   * @param variables - Variables to inject
   * @returns Rendered email template
   * @throws {Error} If template type not found
   */
  async render(type: TemplateType | string, variables: TemplateVariables): Promise<EmailTemplate> {
    const template = this.templates.get(type);

    if (!template) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Template "${type}" not found. Available templates: ${Array.from(this.templates.keys()).join(', ')}`,
      );
    }

    // Merge with default variables and add greeting name
    const allVariables: TemplateVariables = {
      currentYear: new Date().getFullYear(),
      ...variables,
      greetingName: this.getGreetingName(variables),
    };

    // Render subject and HTML
    const subject = this.replaceVariables(template.subject, allVariables);
    const html = this.replaceVariables(template.html, allVariables);

    // Generate plain text if not provided
    const text = template.text ? this.replaceVariablesForText(template.text, allVariables) : this.htmlToText(html);

    return { subject, html, text };
  }

  /**
   * Register a custom template
   *
   * @param type - Template type identifier
   * @param template - Template definition
   */
  registerTemplate(type: TemplateType | string, template: EmailTemplate): void {
    this.templates.set(type, template);
  }

  /**
   * Get all available template types
   *
   * @returns Array of template type identifiers
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
  hasTemplate(type: TemplateType | string): boolean {
    return this.templates.has(type);
  }

  /**
   * Replace {{variable}} placeholders with values
   *
   * Escapes HTML entities in variables for security.
   * Handles missing variables gracefully (replaces with empty string).
   * Supports firstName/username fallback logic and simple conditionals.
   *
   * @param template - Template string with {{placeholders}}
   * @param variables - Variables to inject
   * @returns Template with variables replaced
   * @private
   */
  private replaceVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    // Handle simple conditionals like {{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}
    result = result.replace(
      /\{\{#if (\w+)\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/g,
      (_match, key, ifContent, elseContent) => {
        const value = variables[key];
        if (value && value !== '') {
          return ifContent;
        } else {
          return elseContent;
        }
      },
    );

    // Replace regular variables
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      const value = variables[key];

      // Return empty string if variable is undefined
      if (value === undefined || value === null) {
        return '';
      }

      // Convert to string and escape HTML entities
      return this.escapeHtml(String(value));
    });

    return result;
  }

  /**
   * Replace {{variable}} placeholders with values for text content
   *
   * Similar to replaceVariables but doesn't escape HTML entities for plain text.
   *
   * @param template - Template string with {{placeholders}}
   * @param variables - Variables to inject
   * @returns Template with variables replaced
   * @private
   */
  private replaceVariablesForText(template: string, variables: TemplateVariables): string {
    let result = template;

    // Handle simple conditionals like {{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}
    result = result.replace(
      /\{\{#if (\w+)\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/g,
      (_match, key, ifContent, elseContent) => {
        const value = variables[key];
        if (value && value !== '') {
          return ifContent;
        } else {
          return elseContent;
        }
      },
    );

    // Replace regular variables without HTML escaping
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      const value = variables[key];

      // Return empty string if variable is undefined
      if (value === undefined || value === null) {
        return '';
      }

      // Convert to string without escaping HTML entities for text
      return String(value);
    });

    return result;
  }

  /**
   * Get greeting name with firstName/username fallback logic
   *
   * @param variables - Template variables
   * @returns Greeting name or empty string
   * @private
   */
  private getGreetingName(variables: TemplateVariables): string {
    if (variables.firstName) {
      return variables.firstName;
    }
    if (variables.userName) {
      return variables.userName;
    }
    return '';
  }

  /**
   * Escape HTML entities to prevent XSS
   *
   * @param text - Text to escape
   * @returns HTML-safe text
   * @private
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char] || char);
  }

  /**
   * Convert HTML to plain text
   *
   * Simple conversion: strips HTML tags and decodes entities.
   *
   * @param html - HTML content
   * @returns Plain text
   * @private
   */
  private htmlToText(html: string): string {
    // Strip HTML tags
    let text = html.replace(/<[^>]*>/g, '');

    // Decode common HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#039;/g, "'");
    text = text.replace(/&amp;/g, '&');

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Register default templates for all email types
   *
   * These templates can be overridden using registerTemplate().
   * @private
   */
  private registerDefaultTemplates(): void {
    // ============================================================================
    // Email Verification Template
    // ============================================================================
    this.registerTemplate(TemplateType.VERIFICATION, {
      subject: 'Email Verification - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
    .code { font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Verification</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>Thank you for signing up! Please verify your email address to activate your account.</p>

    <p>Your Verification Code:</p>
    <div class="code">{{code}}</div>

    <p>Or click the link below to verify:</p>
    <p><a href="{{link}}">Verify Email Address</a></p>

    <p>This code expires in {{expiryMinutes}} minutes.</p>
    <p>If you didn't request this verification, please ignore this email.</p>
  </div>
</body>
</html>
      `,
      text: `
Email Verification

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

Thank you for signing up! Please verify your email address to activate your account.

Your Verification Code: {{code}}

Or use this link: {{link}}

This code expires in {{expiryMinutes}} minutes.

If you didn't request this verification, please ignore this email.
      `,
    });

    // ============================================================================
    // Password Reset Template
    // ============================================================================
    this.registerTemplate(TemplateType.PASSWORD_RESET, {
      subject: 'Password Reset - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Password Reset</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>We received a request to reset your password. Click the link below to create a new password:</p>

    <p><a href="{{link}}">Reset Your Password</a></p>

    <p>This link expires in {{expiryMinutes}} minutes.</p>
    <p>If you didn't request a password reset, your account is secure and you can ignore this email.</p>

    <p>If the link doesn't work, copy and paste this URL into your browser:</p>
    <p>{{link}}</p>
  </div>
</body>
</html>
      `,
      text: `
Password Reset

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

We received a request to reset your password. Use the link below to create a new password:

{{link}}

This link expires in {{expiryMinutes}} minutes.

If you didn't request a password reset, your account is secure and you can ignore this email.
      `,
    });

    // ============================================================================
    // Welcome Email Template
    // ============================================================================
    this.registerTemplate(TemplateType.WELCOME, {
      subject: 'Welcome to {{appName}}!',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>We're excited to have you with us! Your account has been successfully created and you're ready to get started.</p>

    <p><a href="{{dashboardUrl}}">Get Started</a></p>

    <p>If you have any questions or need assistance, feel free to reach out to our support team at {{supportEmail}}.</p>

    <p>Happy exploring!</p>
  </div>
</body>
</html>
      `,
      text: `
Welcome to {{appName}}!

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

We're excited to have you with us! Your account has been successfully created and you're ready to get started.

Visit: {{dashboardUrl}}

If you have any questions or need assistance, reach out to our support team at {{supportEmail}}.

Happy exploring!
      `,
    });

    // ============================================================================
    // Account Lockout Template
    // ============================================================================
    this.registerTemplate(TemplateType.ACCOUNT_LOCKOUT, {
      subject: 'Account Locked - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Lockout</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
    ul { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Account Locked</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>Your account has been temporarily locked for security reasons.</p>

    <p><strong>Reason:</strong> {{reason}}</p>
    <p><strong>Duration:</strong> Your account will be automatically unlocked in {{durationMinutes}} minutes.</p>

    <p><strong>What happened?</strong></p>
    <p>We detected multiple failed login attempts or suspicious activity on your account. As a security measure, we've temporarily locked your account to protect it.</p>

    <p><strong>What should I do?</strong></p>
    <ul>
      <li>Wait {{durationMinutes}} minutes for automatic unlock</li>
      <li>If this was you, try logging in again after the lockout period</li>
      <li>If this wasn't you, please contact support immediately at {{supportEmail}}</li>
      <li>Consider changing your password after unlock</li>
    </ul>
  </div>
</body>
</html>
      `,
      text: `
Account Locked

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

Your account has been temporarily locked for security reasons.

Reason: {{reason}}
Duration: Your account will be automatically unlocked in {{durationMinutes}} minutes.

What happened?
We detected multiple failed login attempts or suspicious activity on your account.

What should I do?
- Wait {{durationMinutes}} minutes for automatic unlock
- If this was you, try logging in again after the lockout period
- If this wasn't you, contact support at {{supportEmail}}
- Consider changing your password after unlock
      `,
    });

    // ============================================================================
    // New Device Login Template
    // ============================================================================
    this.registerTemplate(TemplateType.NEW_DEVICE, {
      subject: 'New Device Login - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Device Login</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
    ul { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>New Device Login</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>We detected a login to your account from a new device.</p>

    <p><strong>Device:</strong> {{deviceName}}</p>
    <p><strong>Type:</strong> {{deviceType}}</p>
    <p><strong>IP Address:</strong> {{ipAddress}}</p>
    <p><strong>Location:</strong> {{location}}</p>
    <p><strong>Time:</strong> {{timestamp}}</p>

    <p><strong>Was this you?</strong></p>
    <p>If you recognize this login, no action is needed. Your account is secure.</p>

    <p><strong>Not you?</strong></p>
    <p>If you don't recognize this activity, please secure your account immediately:</p>
    <ul>
      <li>Change your password</li>
      <li>Review your recent account activity</li>
      <li>Contact support at {{supportEmail}}</li>
    </ul>
  </div>
</body>
</html>
      `,
      text: `
New Device Login

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

We detected a login to your account from a new device.

Device: {{deviceName}}
Type: {{deviceType}}
IP Address: {{ipAddress}}
Location: {{location}}
Time: {{timestamp}}

Was this you?
If you recognize this login, no action is needed.

Not you?
If you don't recognize this activity, secure your account immediately:
- Change your password
- Review your recent account activity
- Contact support at {{supportEmail}}
      `,
    });
    // Password Changed Template
    // ============================================================================
    this.registerTemplate(TemplateType.PASSWORD_CHANGED, {
      subject: 'Password Changed - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Password Changed</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>Your password has been successfully changed.</p>

    <p>If you made this change, no further action is required.</p>

    <p>If you didn't make this change, please contact support immediately at {{supportEmail}}.</p>
  </div>
</body>
</html>
      `,
      text: `
Password Changed

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

Your password has been successfully changed.

If you made this change, no further action is required.

If you didn't make this change, please contact support immediately at {{supportEmail}}.
      `,
    });

    // ============================================================================
    // Email Changed Template
    // ============================================================================
    this.registerTemplate(TemplateType.EMAIL_CHANGED, {
      subject: 'Email Address Changed - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Changed</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Address Changed</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>Your email address has been successfully changed to {{userEmail}}.</p>

    <p>If you made this change, no further action is required.</p>

    <p>If you didn't make this change, please contact support immediately at {{supportEmail}}.</p>
  </div>
</body>
</html>
      `,
      text: `
Email Address Changed

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

Your email address has been successfully changed to {{userEmail}}.

If you made this change, no further action is required.

If you didn't make this change, please contact support immediately at {{supportEmail}}.
      `,
    });

    // ============================================================================
    // MFA Enabled Template
    // ============================================================================
    this.registerTemplate(TemplateType.MFA_ENABLED, {
      subject: 'Two-Factor Authentication Enabled - {{appName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MFA Enabled</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Two-Factor Authentication Enabled</h1>
    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>
    <p>Two-factor authentication has been successfully enabled for your account.</p>

    <p>Your account is now more secure. You'll need to provide both your password and a verification code when logging in.</p>

    <p>If you didn't enable this feature, please contact support immediately at {{supportEmail}}.</p>
  </div>
</body>
</html>
      `,
      text: `
Two-Factor Authentication Enabled

{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}

Two-factor authentication has been successfully enabled for your account.

Your account is now more secure. You'll need to provide both your password and a verification code when logging in.

If you didn't enable this feature, please contact support immediately at {{supportEmail}}.
      `,
    });
  }
}
