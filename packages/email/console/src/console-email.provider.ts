import { EmailProvider, LoggerService } from '@nauth-toolkit/core';

/**
 * Console Email Provider (Platform-Agnostic)
 *
 * Mock email provider that logs emails to console.
 * Perfect for development and testing without external SMTP dependencies.
 *
 * This simply logs email details to the console for debugging purposes.
 * No actual emails are sent, no templates are rendered.
 *
 * This is a plain TypeScript class with no framework dependencies.
 * Works with any framework (NestJS, Express, Fastify, etc.)
 *
 * @example
 * ```typescript
 * // With custom logger
 * const emailProvider = new ConsoleEmailProvider(myLogger);
 *
 * // With console logger (default)
 * const emailProvider = new ConsoleEmailProvider();
 *
 * AuthModule.forRoot({
 *   emailProvider: new ConsoleEmailProvider(),
 * })
 * ```
 */
export class ConsoleEmailProvider implements EmailProvider {
  private logger: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger || console;
  }

  /**
   * Set logger instance (called by AuthModule to inject NAuthLogger)
   * @param logger - Logger instance to use
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Send verification email with code and/or link
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param code - Verification code (e.g., "123456")
   * @param link - Optional verification link (only logged if provided)
   */
  async sendVerificationEmail(to: string, code: string, link?: string): Promise<void> {
    // Build message similar to SMS format
    let message = `Your verification code is: ${code}`;
    if (link) {
      message += `\nOr use this link: ${link}`;
    }

    // Log email content in a visually distinct format (matching SMS format)
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log('EMAIL MESSAGE');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${to}`);
    this.logger.log(`Message: ${message}`);
    this.logger.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Send password reset email with code and optional link
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param _token - Password reset token (for validation, not logged)
   * @param code - Password reset code (e.g., "123456")
   * @param link - Optional password reset link (e.g., "https://example.com/reset?token=xxx")
   * @param expiryMinutes - Code/link expiry time in minutes
   */
  async sendPasswordResetEmail(
    to: string,
    _token: string,
    code: string,
    link?: string,
    expiryMinutes: number = 60,
  ): Promise<void> {
    let message = `Your password reset code is: ${code}`;
    if (link) {
      message += `\nOr use this link: ${link}`;
    }
    message += `\nThis code expires in ${expiryMinutes} minutes.`;

    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log('EMAIL: Password Reset (simulated)');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${to}`);
    this.logger.log(`Message: ${message}`);
    this.logger.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Send admin-initiated password reset email with code AND optional link.
   * Pattern matches sendVerificationEmail (code + optional link).
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param code - Reset code (e.g., "123456")
   * @param link - Optional reset link with token (for consumer apps)
   * @param expiryMinutes - Code expiry time in minutes
   */
  async sendAdminPasswordResetEmail(
    to: string,
    code: string,
    link?: string,
    expiryMinutes: number = 60,
  ): Promise<void> {
    let message = `Your admin-initiated password reset code is: ${code}`;
    if (link) {
      message += `\nOr use this link: ${link}`;
    }
    message += `\nThis code expires in ${expiryMinutes} minutes.`;

    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log('EMAIL: Admin Password Reset (simulated)');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${to}`);
    this.logger.log(`Message: ${message}`);
    this.logger.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Send welcome email to new users
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param name - User's name
   */
  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    this.logger.log('----------------------------------------------');
    this.logger.log('EMAIL: Welcome email sent (simulated)');
    this.logger.log(`To: ${to}`);
    this.logger.log(`Name: ${name}`);
    this.logger.log('----------------------------------------------');
  }

  /**
   * Send account lockout notification
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param reason - Lockout reason
   * @param duration - Lockout duration in seconds
   */
  async sendLockoutEmail(to: string, reason: string, duration: number): Promise<void> {
    this.logger.warn('----------------------------------------------');
    this.logger.warn('EMAIL: Account lockout notification (simulated)');
    this.logger.warn(`To: ${to}`);
    this.logger.warn(`Reason: ${reason}`);
    this.logger.warn(`Duration: ${Math.round(duration / 60)} minutes`);
    this.logger.warn('----------------------------------------------');
  }

  /**
   * Send new device login notification
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param deviceInfo - Device information (name, type, IP, location)
   */
  async sendNewDeviceEmail(
    to: string,
    deviceInfo: {
      name?: string;
      type?: string;
      ip?: string;
      location?: string;
    },
  ): Promise<void> {
    this.logger.log('----------------------------------------------');
    this.logger.log('EMAIL: New device login notification (simulated)');
    this.logger.log(`To: ${to}`);
    this.logger.log(`Device: ${deviceInfo.name || 'Unknown'}`);
    this.logger.log(`Type: ${deviceInfo.type || 'Unknown'}`);
    this.logger.log(`IP: ${deviceInfo.ip || 'Unknown'}`);
    this.logger.log(`Location: ${deviceInfo.location || 'Unknown'}`);
    this.logger.log('----------------------------------------------');
  }

  /**
   * Send MFA first enabled confirmation
   *
   * Logs email details to the configured logger for debugging.
   *
   * @param to - Recipient email address
   * @param context - MFA enrollment context
   */
  async sendMFAFirstEnabledEmail(
    to: string,
    context: { firstMethod?: string; deviceName?: string; timestamp?: string } = {},
  ): Promise<void> {
    this.logger.log('----------------------------------------------');
    this.logger.log('EMAIL: MFA first enabled (simulated)');
    this.logger.log(`To: ${to}`);
    this.logger.log(`First method: ${context.firstMethod || 'Unknown'}`);
    if (context.deviceName) this.logger.log(`Device name: ${context.deviceName}`);
    if (context.timestamp) this.logger.log(`Timestamp: ${context.timestamp}`);
    this.logger.log('----------------------------------------------');
  }

  /**
   * Send MFA device removed security alert
   *
   * Logs email details to the configured logger for debugging.
   *
   * @param to - Recipient email address
   * @param context - MFA device removal context
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
  ): Promise<void> {
    this.logger.warn('----------------------------------------------');
    this.logger.warn('EMAIL: MFA method/device removed (simulated)');
    this.logger.warn(`To: ${to}`);
    if (context.deviceType) this.logger.warn(`Type: ${context.deviceType}`);
    if (context.deviceName) this.logger.warn(`Device name: ${context.deviceName}`);
    if (context.removedBy) this.logger.warn(`Removed by: ${context.removedBy}`);
    if (context.reason) this.logger.warn(`Reason: ${context.reason}`);
    if (typeof context.remainingDeviceCount === 'number') {
      this.logger.warn(`Remaining devices: ${context.remainingDeviceCount}`);
    }
    this.logger.warn('----------------------------------------------');
  }

  /**
   * Send MFA method added notification
   *
   * Logs email details to the configured logger for debugging.
   *
   * @param to - Recipient email address
   * @param context - MFA method addition context
   */
  async sendMFAMethodAddedEmail(
    to: string,
    context: { method?: string; enabledMethods?: string[]; deviceName?: string; timestamp?: string } = {},
  ): Promise<void> {
    this.logger.log('----------------------------------------------');
    this.logger.log('EMAIL: MFA method added (simulated)');
    this.logger.log(`To: ${to}`);
    if (context.method) this.logger.log(`Method: ${context.method}`);
    if (context.deviceName) this.logger.log(`Device name: ${context.deviceName}`);
    if (context.enabledMethods) this.logger.log(`Enabled methods: ${context.enabledMethods.join(', ')}`);
    if (context.timestamp) this.logger.log(`Timestamp: ${context.timestamp}`);
    this.logger.log('----------------------------------------------');
  }
}
