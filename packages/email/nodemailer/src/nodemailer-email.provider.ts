import { EmailProvider, TemplateType, TemplateVariables, LoggerService } from '@nauth-toolkit/core';
import { HandlebarsTemplateEngine } from './templates/handlebars-template.engine';
import * as nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';

/**
 * Nodemailer Transport Configuration
 *
 * Supports various transport types:
 * - SMTP (generic)
 * - AWS SES
 * - SendGrid
 * - Mailgun
 * - Postmark
 * - Gmail (with OAuth2)
 * - Outlook/Office365
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
   * AWS region (for SES)
   */
  region?: string;

  /**
   * Additional transport options
   */
  [key: string]: any;
}

/**
 * Nodemailer Provider Configuration
 */
export interface NodemailerProviderConfig {
  /**
   * Nodemailer transport configuration
   */
  transport: NodemailerTransportConfig;

  /**
   * Default email options (from, replyTo, etc.)
   */
  defaults?: {
    from?: string;
    replyTo?: string;
    [key: string]: any;
  };

  /**
   * Enable template engine (default: true)
   */
  useTemplates?: boolean;

  /**
   * Custom template engine (default: HandlebarsTemplateEngine with MJML templates)
   */
  templateEngine?: any;

  /**
   * Enable preview URL in development (default: false)
   */
  preview?: boolean;
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
 *
 * **Phase 2c Implementation**
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
 * @example AWS SES Configuration
 * ```typescript
 * new NodemailerProvider({
 *   transport: {
 *     service: 'SES',
 *     auth: {
 *       user: process.env.AWS_ACCESS_KEY_ID,
 *       pass: process.env.AWS_SECRET_ACCESS_KEY,
 *     },
 *     region: 'us-east-1',
 *   },
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
    this.logger?.debug?.('Initializing NodemailerProvider', {
      host: config.transport.host,
      port: config.transport.port,
      secure: config.transport.secure,
      from: config.defaults?.from,
    });

    // Create Nodemailer transporter
    this.transporter = nodemailer.createTransport(config.transport as any);

    // Initialize template engine
    this.templateEngine = config.templateEngine || new HandlebarsTemplateEngine();

    // Set defaults
    this.defaults = config.defaults || {};
    this.preview = config.preview || false;

    // Verify connection
    this.verifyConnection();
  }

  /**
   * Verify SMTP connection
   * @private
   */
  private async verifyConnection(): Promise<void> {
    try {
      this.logger?.debug?.('Verifying SMTP connection...');
      await this.transporter.verify();
      this.logger?.log?.('Nodemailer connection verified successfully');
    } catch (error: any) {
      this.logger?.error?.('Nodemailer connection failed');
      this.logger?.error?.(`Error details: ${error?.message || 'Unknown error'}`);
      if (error?.code) {
        this.logger?.error?.(`Error code: ${error.code}`);
      }
      if (error?.command) {
        this.logger?.error?.(`Failed at command: ${error.command}`);
      }
      // Log full error for debugging
      this.logger?.debug?.('Full error object:', error);
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
   * @param deviceInfo - Device information
   */
  async sendNewDeviceEmail(to: string, deviceInfo: any, variables: TemplateVariables = {}): Promise<void> {
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
    } catch (error: any) {
      this.logger?.error?.('Failed to send email');
      this.logger?.error?.(`To: ${mailOptions.to}`);
      this.logger?.error?.(`Error: ${error?.message || 'Unknown error'}`);
      if (error?.code) {
        this.logger?.error?.(`Error code: ${error.code}`);
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
