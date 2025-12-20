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
  async sendVerificationEmail(to: string, _code: string, _link?: string): Promise<void> {
    // NOTE: Do not log secrets (codes/links) to console.
    // In this repo, simulated codes should be viewed via test endpoints + frontend toast.
    this.logger.log('----------------------------------------------');
    this.logger.log('EMAIL: One-time code sent (simulated)');
    this.logger.log(`To: ${to}`);
    this.logger.log('----------------------------------------------');
  }

  /**
   * Send password reset email with token and link
   *
   * Logs email details to console for debugging.
   *
   * @param to - Recipient email address
   * @param token - Password reset token
   * @param link - Password reset link (e.g., "https://example.com/reset?token=xxx")
   */
  async sendPasswordResetEmail(to: string, _token: string, _link: string): Promise<void> {
    // NOTE: Do not log secrets (tokens/links) to console.
    this.logger.log('----------------------------------------------');
    this.logger.log('EMAIL: Password reset email sent (simulated)');
    this.logger.log(`To: ${to}`);
    this.logger.log('----------------------------------------------');
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
}
