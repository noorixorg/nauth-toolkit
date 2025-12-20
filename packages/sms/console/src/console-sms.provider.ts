import { SMSProvider, NAuthLogger } from '@nauth-toolkit/core';

/**
 * Console SMS Provider (Platform-Agnostic)
 *
 * Development-only SMS provider that logs messages to console instead of sending real SMS.
 *
 * This is a plain TypeScript class with no framework dependencies.
 * Works with any framework (NestJS, Express, Fastify, etc.)
 *
 * **Use Case:**
 * - Development and testing environments
 * - No external dependencies required
 * - See SMS content without sending actual messages
 *
 * **Security Note:**
 * - NEVER use in production (exposes sensitive codes in logs)
 * - For production, use real SMS providers like Twilio, AWS SNS, MessageBird
 *
 * @example
 * ```typescript
 * // In AuthModule configuration
 * AuthModule.forRoot({
 *   sms: {
 *     provider: new ConsoleSMSProvider(),
 *   },
 * })
 * ```
 */
export class ConsoleSMSProvider implements SMSProvider {
  private logger: NAuthLogger;
  private storageCallback?: (phone: string, code: string) => Promise<void>;

  constructor(logger?: NAuthLogger) {
    this.logger = logger || new NAuthLogger();
  }

  /**
   * Set logger for this provider
   * Used by auth module to inject the configured logger
   */
  setLogger(logger: NAuthLogger): void {
    this.logger = logger;
  }

  /**
   * Set storage callback for test mode
   * Used to store SMS codes in test database for E2E testing
   */
  setStorageCallback(callback: (phone: string, code: string) => Promise<void>): void {
    this.storageCallback = callback;
  }

  /**
   * Send OTP code via SMS (console output)
   *
   * @param phone - Recipient phone number
   * @param code - OTP code to send
   *
   * @example
   * ```typescript
   * await smsProvider.sendOTP('+1234567890', '123456');
   * // Console output:
   * // ============================================================
   * // SMS MESSAGE
   * // ============================================================
   * // To: +1234567890
   * // Message: Your verification code is: 123456
   * // ============================================================
   * ```
   */
  async sendOTP(phone: string, code: string): Promise<void> {
    // Store in test database if callback provided (test mode)
    if (this.storageCallback) {
      try {
        await this.storageCallback(phone, code);
      } catch (error) {
        this.logger.error?.(`Failed to store SMS code in test database: ${error}`);
      }
    }

    this.logger.log(`Sending SMS to: ${phone}`);

    // Log SMS content in a visually distinct format
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log('SMS MESSAGE');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${phone}`);
    this.logger.log(`Message: Your verification code is: ${code}`);
    this.logger.log(`${'='.repeat(60)}\n`);

    this.logger.log(`SMS sent successfully to: ${phone}`);
  }

  /**
   * Send verification code via SMS (console output)
   *
   * @param phone - Recipient phone number
   * @param code - Verification code to send
   */
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    // Use the same implementation as sendOTP
    await this.sendOTP(phone, code);
  }
}
