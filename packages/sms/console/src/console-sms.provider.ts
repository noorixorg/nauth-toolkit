import { SMSProvider, NAuthLogger, SMSTemplateEngine, SMSTemplateVariables } from '@nauth-toolkit/core';

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

  /**
   * Optional SMS template engine for customizing message content
   */
  private templateEngine?: SMSTemplateEngine;

  /**
   * Global variables available to all SMS templates
   */
  private globalVariables: SMSTemplateVariables = {};

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
   * Set template engine for SMS message customization
   *
   * @param engine - SMS template engine instance
   */
  setTemplateEngine(engine: SMSTemplateEngine): void {
    this.templateEngine = engine;
  }

  /**
   * Set global variables for SMS templates
   *
   * @param variables - Global template variables (appName, companyName, etc.)
   */
  setGlobalVariables(variables: SMSTemplateVariables): void {
    this.globalVariables = variables || {};
  }

  /**
   * Send OTP code via SMS (console output)
   *
   * If template engine is configured, uses template to format message.
   * Otherwise, falls back to hard-coded default message for backward compatibility.
   *
   * @param phone - Recipient phone number
   * @param code - OTP code to send
   * @param templateType - Optional template type (verification, mfa, passwordReset)
   * @param variables - Optional template variables (expiryMinutes, appName, etc.)
   *
   * @example
   * ```typescript
   * // Without templates (backward compatible)
   * await smsProvider.sendOTP('+1234567890', '123456');
   *
   * // With templates
   * await smsProvider.sendOTP('+1234567890', '123456', 'verification', { expiryMinutes: 5 });
   * ```
   */
  async sendOTP(
    phone: string,
    code: string,
    templateType?: string,
    variables?: Record<string, unknown>,
  ): Promise<void> {
    // Store in test database if callback provided (test mode)
    if (this.storageCallback) {
      try {
        await this.storageCallback(phone, code);
      } catch (error) {
        this.logger.error?.(`Failed to store SMS code in test database: ${error}`);
      }
    }

    this.logger.log(`Sending SMS to: ${phone}`);

    let message: string;

    // ============================================================================
    // Template-based message rendering
    // ============================================================================
    if (this.templateEngine && templateType) {
      try {
        // Merge global variables with template-specific variables
        const allVariables: SMSTemplateVariables = {
          ...this.globalVariables,
          code,
          ...(variables as SMSTemplateVariables),
        };

        // Render template
        const template = await this.templateEngine.render(templateType, allVariables);
        message = template.content;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error?.(`Failed to render SMS template: ${errorMessage}`);
        // Fall back to hard-coded message on template rendering error
        message = `Your verification code is: ${code}`;
      }
    } else {
      // ============================================================================
      // Backward compatibility: hard-coded default message
      // ============================================================================
      message = `Your verification code is: ${code}`;
    }

    // Log SMS content in a visually distinct format
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log('SMS MESSAGE');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${phone}`);
    this.logger.log(`Message: ${message}`);
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
