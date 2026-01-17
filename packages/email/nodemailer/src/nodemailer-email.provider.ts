import {
  EmailProvider,
  TemplateType,
  TemplateVariables,
  LoggerService,
  TemplateEngine,
  NAuthException,
  AuthErrorCode,
} from '@nauth-toolkit/core';
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
  private config?: import('@nauth-toolkit/core').NAuthConfig;

  /**
   * Set logger instance (called by AuthModule to inject NAuthLogger)
   * @param logger - Logger instance to use
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Set NAuth configuration (called during initialization)
   *
   * Allows email provider to access emailNotifications config for suppression logic.
   *
   * @param config - NAuth configuration object
   */
  setConfig(config: import('@nauth-toolkit/core').NAuthConfig): void {
    this.config = config;
  }

  /**
   * Set global template variables (called by AuthModule to inject email config)
   * @param variables - Global variables to merge with all template variables
   */
  setGlobalVariables(variables: TemplateVariables): void {
    this.globalVariables = variables || {};
  }

  /**
   * Get the template engine instance
   *
   * Allows AuthModule to register custom templates on the engine
   *
   * @returns The template engine instance
   */
  getTemplateEngine(): HandlebarsTemplateEngine {
    return this.templateEngine;
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
    this.logger?.debug?.('Preparing verification email', { to, hasLink: !!link, expiryMinutes });

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

    let email;
    try {
      this.logger?.debug?.('Rendering verification email template');
      email = await this.templateEngine.render(TemplateType.VERIFICATION, templateVariables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(
        `Failed to render verification email template (${TemplateType.VERIFICATION}): ${errorMessage}`,
        { error },
      );
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Failed to render verification email template: ${errorMessage}`,
        { originalError: errorMessage, templateType: TemplateType.VERIFICATION },
      );
    }

    try {
      await this.sendMail({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      // sendMail already logs errors, but we add context here
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Verification email delivery failed for ${to}: ${errorMessage}`);
      // Re-throw to let caller handle
      throw error;
    }
  }

  /**
   * Send password reset email with code and optional link
   *
   * @param to - Recipient email address
   * @param _token - Password reset token (for validation, not used in template)
   * @param code - Password reset code (e.g., "123456")
   * @param link - Password reset link (optional)
   * @param expiryMinutes - Code/link expiry time in minutes
   */
  async sendPasswordResetEmail(
    to: string,
    _token: string,
    code: string,
    link?: string,
    expiryMinutes: number = 60,
    variables: TemplateVariables = {},
  ): Promise<void> {
    this.logger?.debug?.('Preparing password reset email', { to, hasLink: !!link, expiryMinutes });

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

    let email;
    try {
      this.logger?.debug?.('Rendering password reset email template');
      email = await this.templateEngine.render(TemplateType.PASSWORD_RESET, templateVariables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(
        `Failed to render password reset email template (${TemplateType.PASSWORD_RESET}): ${errorMessage}`,
        { error },
      );
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Failed to render password reset email template: ${errorMessage}`,
        { originalError: errorMessage, templateType: TemplateType.PASSWORD_RESET },
      );
    }

    try {
      await this.sendMail({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      // sendMail already logs errors, but we add context here
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Password reset email delivery failed for ${to}: ${errorMessage}`);
      // Re-throw to let caller handle (password-reset.service will catch and log)
      throw error;
    }
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
    this.logger?.debug?.('Preparing admin password reset email', { to, hasLink: !!link, expiryMinutes });

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

    let email;
    try {
      this.logger?.debug?.('Rendering admin password reset email template');
      email = await this.templateEngine.render(TemplateType.ADMIN_PASSWORD_RESET, templateVariables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(
        `Failed to render admin password reset email template (${TemplateType.ADMIN_PASSWORD_RESET}): ${errorMessage}`,
        { error },
      );
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Failed to render admin password reset email template: ${errorMessage}`,
        { originalError: errorMessage, templateType: TemplateType.ADMIN_PASSWORD_RESET },
      );
    }

    try {
      await this.sendMail({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      // sendMail already logs errors, but we add context here
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Admin password reset email delivery failed for ${to}: ${errorMessage}`);
      // Re-throw to let caller handle
      throw error;
    }
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
   * Send password changed security alert
   *
   * @param to - Recipient email address
   * @param context - Password change context
   * @param variables - Additional template variables
   */
  async sendPasswordChangedEmail(
    to: string,
    context: {
      changedBy?: 'user' | 'admin' | 'reset';
      sessionsRevoked?: number;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('passwordChanged')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      changedBy: context.changedBy || 'user',
      sessionsRevoked: context.sessionsRevoked,
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.PASSWORD_CHANGED, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send MFA device removed security alert
   *
   * @param to - Recipient email address
   * @param context - Device removal context
   * @param variables - Additional template variables
   */
  async sendMFADeviceRemovedEmail(
    to: string,
    context: {
      deviceType?: string;
      deviceName?: string;
      removedBy?: 'user' | 'admin' | 'system';
      reason?: string;
      remainingDeviceCount?: number;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('mfaDeviceRemoved')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      deviceType: context.deviceType || 'Unknown',
      deviceName: context.deviceName || 'Unknown Device',
      removedBy: context.removedBy || 'user',
      reason: context.reason || 'User request',
      remainingDeviceCount: context.remainingDeviceCount || 0,
      timestamp: new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.MFA_DEVICE_REMOVED, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send adaptive MFA risk detection alert
   *
   * @param to - Recipient email address
   * @param context - Risk detection context
   * @param variables - Additional template variables
   */
  async sendAdaptiveMFARiskAlertEmail(
    to: string,
    context: {
      riskScore?: number;
      riskLevel?: 'low' | 'medium' | 'high';
      riskFactors?: string[];
      action?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('adaptiveMfaRiskDetected')) return;

    const riskFactorsText =
      context.riskFactors && context.riskFactors.length > 0 ? context.riskFactors.join(', ') : undefined;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      riskScore: context.riskScore || 0,
      riskLevel: context.riskLevel || 'medium',
      // Only set this variable when we actually have factors. Templates use {{#if riskFactors}}.
      riskFactors: riskFactorsText,
      action: context.action || 'require_mfa',
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.ADAPTIVE_MFA_RISK_ALERT, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send account disabled notification
   *
   * @param to - Recipient email address
   * @param context - Account disable context
   * @param variables - Additional template variables
   */
  async sendAccountDisabledEmail(
    to: string,
    context: {
      reason?: string;
      performedBy?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('accountDisabled')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      reason: context.reason || 'Administrative action',
      performedBy: context.performedBy || 'Administrator',
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.ACCOUNT_DISABLED, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send account enabled notification
   *
   * @param to - Recipient email address
   * @param context - Account enable context
   * @param variables - Additional template variables
   */
  async sendAccountEnabledEmail(
    to: string,
    context: {
      reason?: string;
      performedBy?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('accountEnabled')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      reason: context.reason || 'Administrative action',
      performedBy: context.performedBy || 'Administrator',
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.ACCOUNT_ENABLED, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send email changed alert (to OLD email address)
   *
   * @param to - OLD email address
   * @param context - Email change context
   * @param variables - Additional template variables
   */
  async sendEmailChangedAlertEmail(
    to: string,
    context: {
      newEmail?: string;
      deactivatedMFADevices?: number;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('emailChangedOld')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      newEmail: context.newEmail || 'Unknown',
      deactivatedMFADevices: context.deactivatedMFADevices || 0,
      timestamp: context.timestamp || new Date().toISOString(),
      isOldEmail: true,
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.EMAIL_CHANGED_OLD, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send email changed confirmation (to NEW email address)
   *
   * @param to - NEW email address
   * @param context - Email change context
   * @param variables - Additional template variables
   */
  async sendEmailChangedConfirmationEmail(
    to: string,
    context: {
      oldEmail?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('emailChangedNew')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      oldEmail: context.oldEmail || 'Unknown',
      timestamp: context.timestamp || new Date().toISOString(),
      isOldEmail: false,
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.EMAIL_CHANGED_NEW, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send account locked notification
   *
   * @param to - Recipient email address
   * @param context - Lockout context
   * @param variables - Additional template variables
   */
  async sendAccountLockedEmail(
    to: string,
    context: {
      reason?: string;
      lockType?: 'temporary' | 'permanent';
      lockDuration?: number;
      lockedUntil?: Date;
      ipAddress?: string;
      failedAttempts?: number;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('accountLockout')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      reason: context.reason || 'Multiple failed login attempts',
      lockType: context.lockType || 'temporary',
      lockDuration: context.lockDuration,
      durationMinutes: context.lockDuration ? Math.round(context.lockDuration / 60) : undefined,
      lockedUntil: context.lockedUntil?.toISOString(),
      ipAddress: context.ipAddress,
      failedAttempts: context.failedAttempts,
      timestamp: new Date().toISOString(),
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
   * Send sessions revoked security alert
   *
   * @param to - Recipient email address
   * @param context - Session revocation context
   * @param variables - Additional template variables
   */
  async sendSessionsRevokedEmail(
    to: string,
    context: {
      revokedCount?: number;
      reason?: string;
      triggerEvent?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('sessionsRevoked')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      revokedCount: context.revokedCount || 0,
      reason: context.reason || 'Security action',
      triggerEvent: context.triggerEvent,
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.SESSIONS_REVOKED, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send MFA first enabled confirmation
   *
   * @param to - Recipient email address
   * @param context - MFA enrollment context
   * @param variables - Additional template variables
   */
  async sendMFAFirstEnabledEmail(
    to: string,
    context: {
      firstMethod?: string;
      deviceName?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('mfaFirstEnabled')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      firstMethod: context.firstMethod || 'TOTP',
      deviceName: context.deviceName,
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.MFA_ENABLED, templateVariables);

    await this.sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  /**
   * Send MFA method added notification
   *
   * @param to - Recipient email address
   * @param context - MFA method addition context
   * @param variables - Additional template variables
   */
  async sendMFAMethodAddedEmail(
    to: string,
    context: {
      method?: string;
      enabledMethods?: string[];
      deviceName?: string;
      timestamp?: string;
    } = {},
    variables: TemplateVariables = {},
  ): Promise<void> {
    if (!this.shouldSendEmail('mfaMethodAdded')) return;

    const templateVariables: TemplateVariables = {
      ...this.globalVariables,
      userName: to.split('@')[0],
      userEmail: to,
      method: context.method || 'unknown',
      enabledMethods: context.enabledMethods,
      deviceName: context.deviceName,
      timestamp: context.timestamp || new Date().toISOString(),
      ...variables,
    };

    const email = await this.templateEngine.render(TemplateType.MFA_METHOD_ADDED, templateVariables);

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
   * Check if email notification should be sent based on config
   *
   * Checks global enabled flag and per-notification suppression settings.
   * Code emails (verification, password reset, admin password reset) cannot be suppressed
   * and are always sent when the global kill switch is enabled.
   *
   * @param notificationType - Type of notification (matches suppress config keys)
   * @returns True if email should be sent, false if suppressed
   * @private
   */
  private shouldSendEmail(notificationType: string): boolean {
    const notifications = this.config?.emailNotifications;

    // Check global kill switch
    if (notifications?.enabled === false) {
      this.logger?.debug?.(`[EmailNotifications] Global kill switch: ${notificationType} email suppressed`);
      return false;
    }

    // Code emails cannot be suppressed - always send when global switch is enabled
    const codeEmails = ['emailVerification', 'passwordReset', 'adminPasswordReset'];
    if (codeEmails.includes(notificationType)) {
      return true;
    }

    // Check per-notification suppression for optional notifications (default to true = DISABLED)
    const suppress = notifications?.suppress as Record<string, boolean | undefined> | undefined;
    const isSuppressed = suppress?.[notificationType];
    const shouldSuppress = isSuppressed !== undefined ? isSuppressed : true;

    if (shouldSuppress) {
      this.logger?.debug?.(`[EmailNotifications] ${notificationType} email suppressed by config`);
      return false;
    }

    return true;
  }

  /**
   * Close transporter connection
   */
  async close(): Promise<void> {
    this.transporter.close();
    this.logger?.log?.('Nodemailer transporter closed');
  }
}
