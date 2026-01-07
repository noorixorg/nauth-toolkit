import { EmailProvider, TemplateType, TemplateVariables, LoggerService, TemplateEngine } from '@nauth-toolkit/core';
import { HandlebarsTemplateEngine } from './templates/handlebars-template.engine';
import * as nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions, TransportOptions } from 'nodemailer';

/**
 * Nodemailer Transport Configuration
 *
 * Supports various transport types:
 * - SMTP (generic)
 * - AWS SES (via SDK)
 * - SendGrid
 * - Mailgun
 * - Postmark
 * - Gmail (with OAuth2)
 * - Outlook/Office365
 * - Custom transports
 */
export interface NodemailerTransportConfig {
  /**
   * SMTP host (e.g., 'smtp.gmail.com')
   */
  host?: string;

  /**
   * SMTP port (e.g., 587 for TLS, 465 for SSL)
   */
  port?: number;

  /**
   * Use secure connection (TLS)
   */
  secure?: boolean;

  /**
   * Authentication credentials
   */
  auth?:
    | {
        user: string;
        pass: string;
      }
    | {
        type: 'OAuth2';
        user: string;
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        accessToken?: string;
      };

  /**
   * Service name (e.g., 'gmail', 'SendGrid', 'SES')
   */
  service?: string;

  /**
   * AWS region (for SES SMTP)
   */
  region?: string;

  /**
   * AWS SES SDK transport configuration
   * Requires @aws-sdk/client-sesv2 package
   *
   * @example
   * ```typescript
   * import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
   *
   * SES: {
   *   sesClient: new SESv2Client({ region: 'us-east-1' }),
   *   SendEmailCommand,
   * }
   * ```
   */
  SES?: {
    sesClient: unknown; // SESv2Client from @aws-sdk/client-sesv2
    SendEmailCommand: unknown; // SendEmailCommand from @aws-sdk/client-sesv2
  };

  /**
   * Additional transport options
   */
  [key: string]: unknown;
}

/**
 * Nodemailer Provider Configuration
 */
export interface NodemailerProviderConfig {
  /**
   * Nodemailer transport configuration or pre-configured transporter
   *
   * Can be:
   * - NodemailerTransportConfig (SMTP-style config)
   * - Raw nodemailer transport config (for AWS SES SDK, custom transports, etc.)
   * - Pre-configured Transporter instance
   *
   * @example AWS SES with SDK (IAM roles)
   * ```typescript
   * import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
   *
   * new NodemailerProvider({
   *   transport: {
   *     SES: {
   *       sesClient: new SESv2Client({ region: 'us-east-1' }), // Uses IAM role automatically
   *       SendEmailCommand,
   *     },
   *   },
   * })
   * ```
   *
   * @example Pre-configured transporter
   * ```typescript
   * const transporter = nodemailer.createTransport({ ... });
   * new NodemailerProvider({
   *   transport: transporter,
   * })
   * ```
   */
  transport: NodemailerTransportConfig | TransportOptions | Transporter;

  /**
   * Default email options (from, replyTo, etc.)
   */
  defaults?: {
    from?: string;
    replyTo?: string;
    [key: string]: unknown;
  };

  /**
   * Enable template engine (default: true)
   */
  useTemplates?: boolean;

  /**
   * Custom template engine (default: HandlebarsTemplateEngine with MJML templates)
   */
  templateEngine?: TemplateEngine;

  /**
   * Enable preview URL in development (default: false)
   */
  preview?: boolean;

  /**
   * Skip connection verification (optional, for transports that don't support verify)
   * Note: AWS SES SDK transport DOES support verify() according to nodemailer docs
   * @default false
   */
  skipVerification?: boolean;
}

/**
 * Nodemailer Email Provider
 *
 * Production-ready email provider using Nodemailer.
 * Supports multiple transports: SMTP, SES, SendGrid, Mailgun, etc.
 *
 * **Features:**
 * - Multiple transport support (SMTP, SES, SendGrid, etc.)
 * - HTML template rendering with variable injection
 * - Automatic plain text generation
 * - Connection pooling
 * - Retry logic
 * - Preview URLs in development
 * - AWS SES SDK support with IAM roles
 *
 * @example SMTP Configuration
 * ```typescript
 * AuthModule.forRoot({
 *   email: {
 *     provider: new NodemailerProvider({
 *       transport: {
 *         host: 'smtp.example.com',
 *         port: 587,
 *         secure: false,
 *         auth: {
 *           user: process.env.SMTP_USER,
 *           pass: process.env.SMTP_PASS,
 *         },
 *       },
 *       defaults: {
 *         from: '"My App" <noreply@example.com>',
 *       },
 *     }),
 *   },
 * })
 * ```
 *
 * @example AWS SES with SDK (IAM roles) - Recommended
 * ```typescript
 * import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
 *
 * new NodemailerProvider({
 *   transport: {
 *     SES: {
 *       sesClient: new SESv2Client({ region: 'us-east-1' }), // Uses IAM role automatically
 *       SendEmailCommand,
 *     },
 *   },
 *   defaults: {
 *     from: '"My App" <noreply@example.com>',
 *   },
 * })
 * ```
 *
 * @example Pre-configured transporter
 * ```typescript
 * import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
 * import * as nodemailer from 'nodemailer';
 *
 * const transporter = nodemailer.createTransport({
 *   SES: {
 *     sesClient: new SESv2Client({ region: 'us-east-1' }),
 *     SendEmailCommand,
 *   },
 * });
 *
 * new NodemailerProvider({
 *   transport: transporter,
 * })
 * ```
 *
 * @example SendGrid Configuration
 * ```typescript
 * new NodemailerProvider({
 *   transport: {
 *     service: 'SendGrid',
 *     auth: {
 *       user: 'apikey',
 *       pass: process.env.SENDGRID_API_KEY,
 *     },
 *   },
 * })
 * ```
 *
 * @example Gmail with OAuth2
 * ```typescript
 * new NodemailerProvider({
 *   transport: {
 *     service: 'gmail',
 *     auth: {
 *       type: 'OAuth2',
 *       user: process.env.GMAIL_USER,
 *       clientId: process.env.GMAIL_CLIENT_ID,
 *       clientSecret: process.env.GMAIL_CLIENT_SECRET,
 *       refreshToken: process.env.GMAIL_REFRESH_TOKEN,
 *     },
 *   },
 * })
 * ```
 */
export class NodemailerProvider implements EmailProvider {
  private logger?: LoggerService;
  private readonly transporter: Transporter;
  private readonly templateEngine: HandlebarsTemplateEngine;
  private readonly defaults: SendMailOptions;
  private readonly preview: boolean;
  private globalVariables: TemplateVariables = {};

  /**
   * Set logger instance (called by AuthModule to inject NAuthLogger)
   * @param logger - Logger instance to use
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Set global template variables (called by AuthModule to inject email config)
   * @param variables - Global variables to merge with all template variables
   */
  setGlobalVariables(variables: TemplateVariables): void {
    this.globalVariables = variables || {};
  }

  /**
   * Constructor
   *
   * @param config - Nodemailer provider configuration
   */
  constructor(config: NodemailerProviderConfig) {
    // Log configuration (sanitized)
    const isSES = this.isSESTransport(config.transport);
    const transportType = isSES
      ? 'AWS SES SDK'
      : this.isTransporterInstance(config.transport)
        ? 'Pre-configured'
        : 'Config-based';
    this.logger?.debug?.('Initializing NodemailerProvider', {
      transportType,
      from: config.defaults?.from,
    });

    // Create or use provided transporter
    if (this.isTransporterInstance(config.transport)) {
      // Pre-configured transporter instance
      this.transporter = config.transport;
      this.logger?.debug?.('Using pre-configured transporter');
    } else {
      // Create transporter from config
      // nodemailer.createTransport accepts any transport config, including SES SDK config
      this.transporter = nodemailer.createTransport(config.transport as TransportOptions);
      this.logger?.debug?.('Created transporter from config');
    }

    // Initialize template engine
    this.templateEngine =
      (config.templateEngine as HandlebarsTemplateEngine | undefined) || new HandlebarsTemplateEngine();

    // Set defaults
    this.defaults = config.defaults || {};
    this.preview = config.preview || false;

    // Verify connection (skip if configured)
    if (!config.skipVerification) {
      this.verifyConnection();
    } else {
      this.logger?.debug?.('Skipping connection verification');
    }
  }

  /**
   * Check if transport config uses AWS SES SDK
   *
   * @param transport - Transport configuration to check
   * @returns True if transport uses AWS SES SDK
   * @private
   */
  private isSESTransport(transport: unknown): boolean {
    if (!transport || typeof transport !== 'object') {
      return false;
    }
    if (this.isTransporterInstance(transport)) {
      return false;
    }
    const transportObj = transport as { SES?: { sesClient?: unknown; SendEmailCommand?: unknown } };
    return 'SES' in transportObj && !!transportObj.SES?.sesClient && !!transportObj.SES?.SendEmailCommand;
  }

  /**
   * Check if transport is a pre-configured Transporter instance
   *
   * @param transport - Transport to check
   * @returns True if transport is a Transporter instance
   * @private
   */
  private isTransporterInstance(transport: unknown): transport is Transporter {
    if (!transport || typeof transport !== 'object') {
      return false;
    }
    const transporter = transport as Transporter;
    return typeof transporter.sendMail === 'function' && typeof transporter.verify === 'function';
  }

  /**
   * Verify email transport connection
   *
   * For SMTP: Tests actual connection
   * For SES SDK: Attempts to send invalid test message to validate credentials
   *
   * @private
   */
  private async verifyConnection(): Promise<void> {
    try {
      this.logger?.debug?.('Verifying email transport connection...');

      // Check if transporter supports verify (all standard transports do)
      if (typeof this.transporter.verify === 'function') {
        await this.transporter.verify();
        this.logger?.log?.('Nodemailer connection verified successfully');
      } else {
        this.logger?.debug?.('Transporter does not support verify(), skipping verification');
      }
    } catch (error: unknown) {
      this.logger?.error?.('Nodemailer connection verification failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Error details: ${errorMessage}`);
      if (error && typeof error === 'object' && 'code' in error) {
        this.logger?.error?.(`Error code: ${String(error.code)}`);
      }
      if (error && typeof error === 'object' && 'command' in error) {
        this.logger?.error?.(`Failed at command: ${String(error.command)}`);
      }
      // Log full error for debugging
      this.logger?.debug?.('Full error object:', error);
      // Don't throw - allow provider to be used even if verification fails
      // Verification is best-effort and shouldn't block initialization
    }
  }

  /**
   * Send verification email with code and/or link
   *
   * @param to - Recipient email address
   * @param code - Verification code (e.g., "123456")
   * @param link - Optional verification link (only rendered if provided)
   */
  async sendVerificationEmail(
    to: string,
    code: string,
    link?: string,
    expiryMinutes: number = 60,
    variables: TemplateVariables = {},
  ): Promise<void> {
    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      code,
      expiryMinutes,
      ...variables,
    };

    // Only include link if provided
    if (link) {
      templateVariables.link = link;
    }

    const email = await this.templateEngine.render(TemplateType.VERIFICATION, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send password reset email with link
   *
   * @param to - Recipient email address
   * @param token - Password reset token
   * @param link - Password reset link
   */
  async sendPasswordResetEmail(
    to: string,
    _token: string,
    link: string,
    expiryMinutes: number = 60,
    variables: TemplateVariables = {},
  ): Promise<void> {
    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      link,
      expiryMinutes,
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.PASSWORD_RESET, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send admin-initiated password reset email with code AND optional link.
   * Pattern matches sendVerificationEmail (code + optional link).
   *
   * @param to - Recipient email address
   * @param code - Reset code (e.g., "123456")
   * @param link - Optional reset link with token (for consumer apps to build UI)
   * @param expiryMinutes - Code expiry time in minutes
   */
  async sendAdminPasswordResetEmail(
    to: string,
    code: string,
    link?: string,
    expiryMinutes: number = 60,
    variables: TemplateVariables = {},
  ): Promise<void> {
    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      code,
      expiryMinutes,
      ...variables,
    };

    // Only include link if provided (like verification email)
    if (link) {
      templateVariables.link = link;
    }

    const email = await this.templateEngine.render(TemplateType.ADMIN_PASSWORD_RESET, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send welcome email to new user
   *
   * @param to - Recipient email address
   * @param name - User's name
   */
  async sendWelcomeEmail(to: string, name: string, variables: TemplateVariables = {}): Promise<void> {
    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: name,
      userEmail: to,
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.WELCOME, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send account lockout notification
   *
   * @param to - Recipient email address
   * @param reason - Lockout reason
   * @param duration - Lockout duration in minutes
   */
  async sendLockoutEmail(
    to: string,
    reason: string,
    duration: number,
    variables: TemplateVariables = {},
  ): Promise<void> {
    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      reason,
      durationMinutes: duration,
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.ACCOUNT_LOCKOUT, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send new device login notification
   *
   * @param to - Recipient email address
   * @param deviceInfo - Device information object with optional properties: name, type, ipAddress, location
   */
  async sendNewDeviceEmail(
    to: string,
    deviceInfo: { name?: string; type?: string; ipAddress?: string; location?: string },
    variables: TemplateVariables = {},
  ): Promise<void> {
    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      deviceName: deviceInfo.name || 'Unknown Device',
      deviceType: deviceInfo.type || 'Unknown',
      ipAddress: deviceInfo.ipAddress || 'Unknown',
      location: deviceInfo.location || 'Unknown',
      timestamp: new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.NEW_DEVICE, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send email using Nodemailer
   * @private
   */
  private async sendMail(mailOptions: SendMailOptions): Promise<void> {
    try {
      // Merge with defaults
      const options: SendMailOptions = {
        ...this.defaults,
        ...mailOptions,
      };

      // Log email details (sanitized)
      this.logger?.debug?.('Sending email:', {
        to: options.to,
        from: options.from,
        subject: options.subject,
      });

      // Send email
      const info = await this.transporter.sendMail(options);

      this.logger?.log?.(`Email sent successfully`);
      this.logger?.debug?.(`Message ID: ${info.messageId}`);
      this.logger?.debug?.(`Response: ${info.response}`);

      // Preview URL in development
      if (this.preview) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger?.log?.(`Preview URL: ${previewUrl}`);
        }
      }
    } catch (error: unknown) {
      this.logger?.error?.('Failed to send email');
      this.logger?.error?.(`To: ${mailOptions.to}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Error: ${errorMessage}`);
      if (error && typeof error === 'object' && 'code' in error) {
        this.logger?.error?.(`Error code: ${String(error.code)}`);
      }
      this.logger?.debug?.('Full error object:', error);
      throw error;
    }
  }

  /**
   * Close transporter connection
   */
  async close(): Promise<void> {
    this.transporter.close();
    this.logger?.log?.('Nodemailer transporter closed');
  }
}
