import {
  SMSProvider,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  SMSTemplateEngine,
  SMSTemplateVariables,
} from '@nauth-toolkit/core';
import { TwilioSMSConfig } from './twilio-sms-config.interface';

// ============================================================================
// Twilio SDK (lazy loaded)
// ============================================================================
// WHY: Keep Twilio SDK as an optional dependency while avoiding require() per project rules.
// The client is loaded on-demand in `sendSMS()` (async), keeping the constructor synchronous.

type TwilioClientLike = {
  messages: {
    create: (opts: Record<string, string>) => Promise<{ sid: string; status: string }>;
  };
};
type TwilioFactory = (accountSid: string, authToken: string) => TwilioClientLike;

/**
 * Twilio SMS Provider (Platform-Agnostic)
 *
 * Sends authentication SMS via the Twilio Programmable Messaging API.
 * Supports direct phone numbers and Messaging Services.
 *
 * @example
 * ```typescript
 * // With a direct phone number
 * const provider = new TwilioSMSProvider({
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   fromNumber: '+15551234567',
 * });
 *
 * // With a Messaging Service
 * const provider = new TwilioSMSProvider({
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * });
 *
 * await provider.sendOTP('+1234567890', '123456');
 * ```
 */
export class TwilioSMSProvider implements SMSProvider {
  private logger: NAuthLogger;
  private readonly config: TwilioSMSConfig;

  /** Lazy-initialized Twilio client */
  private client: TwilioClientLike | null = null;
  private twilioFactory: TwilioFactory | null = null;

  /** Optional SMS template engine for customizing message content */
  private templateEngine?: SMSTemplateEngine;

  /** Global variables available to all SMS templates */
  private globalVariables: SMSTemplateVariables = {};

  constructor(config: TwilioSMSConfig) {
    this.logger = new NAuthLogger();
    this.config = config;

    // Validate required configuration
    if (!config.accountSid || !config.authToken) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Twilio SMS Provider: accountSid and authToken are required',
      );
    }

    // Must provide exactly one of fromNumber or messagingServiceSid
    if (!config.fromNumber && !config.messagingServiceSid) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Twilio SMS Provider: either fromNumber or messagingServiceSid is required',
      );
    }

    if (config.fromNumber && config.messagingServiceSid) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Twilio SMS Provider: provide either fromNumber or messagingServiceSid, not both',
      );
    }

    // Twilio client is initialized lazily in sendSMS() (async) to avoid require().
    const mode = config.messagingServiceSid ? 'messagingService' : 'phoneNumber';
    this.logger.log(`Twilio SMS Provider initialized (mode: ${mode})`);
  }

  /**
   * Inject a logger instance from the consuming application.
   *
   * Called by nauth-toolkit core during initialization to replace the default silent logger
   * with the application's logger (NestJS Logger, etc.), enabling provider log output.
   *
   * @param logger - NAuthLogger instance from the consuming application
   */
  setLogger(logger: NAuthLogger): void {
    this.logger = logger;
    this.logger.log('Twilio SMS Provider logger attached');
  }

  /**
   * Lazy-initialize the Twilio client.
   *
   * Uses native dynamic import fallback to prevent TypeScript from converting
   * import() to require() in CommonJS builds, which would fail in packaged npm.
   *
   * @throws {NAuthException} When Twilio SDK cannot be loaded
   */
  private async ensureTwilioInitialized(): Promise<void> {
    if (this.client) {
      return;
    }

    if (!this.twilioFactory) {
      try {
        let twilio: unknown;
        try {
          twilio = await import('twilio');
        } catch {
          // Native dynamic import fallback (avoids TypeScript rewriting to require())
          const nativeImport = new Function('modulePath', 'return import(modulePath)') as (
            modulePath: string,
          ) => Promise<unknown>;
          twilio = await nativeImport('twilio');
        }

        // Twilio exports default in ESM, named in CJS
        const mod = twilio as { default?: unknown };
        this.twilioFactory = (mod.default ?? twilio) as TwilioFactory;
      } catch {
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          'Twilio SMS Provider: Failed to load twilio. Ensure it is installed: pnpm add twilio',
        );
      }
    }

    this.client = this.twilioFactory(this.config.accountSid, this.config.authToken);
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
   * Send OTP code via Twilio
   *
   * Sends an SMS message with the OTP code using the Twilio Programmable Messaging API.
   * If template engine is configured, uses template to format message.
   * Otherwise, falls back to hard-coded default message for backward compatibility.
   *
   * @param phone - Recipient phone number in E.164 format (e.g., '+12345678901')
   * @param code - OTP code to send (typically 6 digits)
   * @param templateType - Optional template type (verification, mfa, passwordReset)
   * @param variables - Optional template variables (expiryMinutes, appName, etc.)
   *
   * @throws {NAuthException} If SMS delivery fails
   *
   * @example
   * ```typescript
   * // Without templates (backward compatible)
   * await provider.sendOTP('+12345678901', '123456');
   *
   * // With templates
   * await provider.sendOTP('+12345678901', '123456', 'verification', { expiryMinutes: 5 });
   * ```
   */
  async sendOTP(
    phone: string,
    code: string,
    templateType?: string,
    variables?: Record<string, unknown>,
  ): Promise<void> {
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
        this.logger.error(`Failed to render SMS template: ${errorMessage}`);
        // Fall back to hard-coded message on template rendering error
        message = `Your verification code is: ${code}`;
      }
    } else {
      // ============================================================================
      // Backward compatibility: hard-coded default message
      // ============================================================================
      message = `Your verification code is: ${code}`;
    }

    await this.sendSMS(phone, message);
  }

  /**
   * Send verification code via Twilio
   *
   * Alias for sendOTP(). Sends the same SMS message.
   *
   * @param phone - Recipient phone number in E.164 format
   * @param code - Verification code to send
   *
   * @throws {NAuthException} If SMS delivery fails
   */
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    await this.sendOTP(phone, code);
  }

  /**
   * Send SMS message via Twilio (Internal)
   *
   * Uses Twilio Programmable Messaging API to deliver the message.
   * Supports both direct phone numbers (`from`) and Messaging Services
   * (`messagingServiceSid`).
   *
   * @param phone - Recipient phone number in E.164 format
   * @param message - SMS message content
   *
   * @throws {NAuthException} If Twilio API call fails
   *
   * @private
   */
  private async sendSMS(phone: string, message: string): Promise<void> {
    try {
      await this.ensureTwilioInitialized();

      const opts: Record<string, string> = {
        to: phone,
        body: message,
      };

      // Use either fromNumber or messagingServiceSid
      if (this.config.fromNumber) {
        opts.from = this.config.fromNumber;
      } else {
        opts.messagingServiceSid = this.config.messagingServiceSid!;
      }

      const result = await this.client!.messages.create(opts);

      this.logger.log(`SMS sent to ${phone} (SID: ${result.sid}, status: ${result.status})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Twilio SMS failed: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Twilio SMS delivery failed: ${errorMessage}`);
    }
  }
}
