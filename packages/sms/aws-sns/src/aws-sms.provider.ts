import {
  SMSProvider,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  SMSTemplateEngine,
  SMSTemplateVariables,
} from '@nauth-toolkit/core';
import { AWSSMSConfig } from './aws-sms-config.interface';

// ============================================================================
// AWS SDK (lazy loaded)
// ============================================================================
// WHY: Keep @aws-sdk/client-sns as an optional dependency while avoiding require() per project rules.
// The module is loaded on-demand in `sendSMS()` (async), keeping the constructor synchronous.
type SNSClientLike = { send: (cmd: unknown) => Promise<{ MessageId?: string }> };
type SNSClientCtor = new (config: Record<string, unknown>) => SNSClientLike;
type PublishCommandCtor = new (input: Record<string, unknown>) => unknown;

/**
 * AWS SNS SMS Provider (Platform-Agnostic)
 *
 * Sends authentication SMS via AWS Simple Notification Service.
 * All messages sent as transactional (highest priority).
 *
 * @example
 * ```typescript
 * const provider = new AWSSMSProvider({
 *   region: 'us-east-1',
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   originationNumber: '+12345678901',
 * });
 *
 * await provider.sendOTP('+1234567890', '123456');
 * ```
 */
export class AWSSMSProvider implements SMSProvider {
  private readonly logger: NAuthLogger;
  private snsClient: SNSClientLike | null = null;
  private readonly config: AWSSMSConfig;
  private snsClientClass: SNSClientCtor | null = null;
  private publishCommandClass: PublishCommandCtor | null = null;

  /**
   * Optional SMS template engine for customizing message content
   */
  private templateEngine?: SMSTemplateEngine;

  /**
   * Global variables available to all SMS templates
   */
  private globalVariables: SMSTemplateVariables = {};

  constructor(config: AWSSMSConfig) {
    this.logger = new NAuthLogger();
    this.config = config;

    // Validate required configuration
    if (!config.region || !config.originationNumber) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'AWS SMS Provider: region and originationNumber are required',
      );
    }

    // If accessKeyId provided, secretAccessKey must also be provided
    if (config.accessKeyId && !config.secretAccessKey) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'AWS SMS Provider: secretAccessKey is required when accessKeyId is provided',
      );
    }

    // AWS SDK + client are initialized lazily in sendSMS() (async) to avoid require().
    this.logger.log(`AWS SMS Provider initialized (region: ${config.region})`);
  }

  /**
   * Lazy-initialize AWS SNS SDK and client.
   *
   * @throws {NAuthException} When AWS SDK cannot be loaded
   */
  private async ensureAwsInitialized(): Promise<void> {
    if (this.snsClient) {
      return;
    }

    if (!this.snsClientClass || !this.publishCommandClass) {
      try {
        const awsSdk = await import('@aws-sdk/client-sns');
        this.snsClientClass = awsSdk.SNSClient as unknown as SNSClientCtor;
        this.publishCommandClass = awsSdk.PublishCommand as unknown as PublishCommandCtor;
      } catch {
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          'AWS SMS Provider: Failed to load @aws-sdk/client-sns. Ensure @nauth-toolkit/sms-aws-sns is properly installed.',
        );
      }
    }

    // Initialize SNS client - credentials are optional (SDK auto-discovers)
    const clientConfig: Record<string, unknown> = { region: this.config.region };

    // Only add credentials if explicitly provided
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      };
    }

    this.snsClient = new this.snsClientClass!(clientConfig);
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
   * Send OTP code via AWS SNS
   *
   * Sends a transactional SMS message with the OTP code using AWS SNS.
   * If template engine is configured, uses template to format message.
   * Otherwise, falls back to hard-coded default message for backward compatibility.
   *
   * **Message Format (without templates):**
   * ```
   * Your verification code is: 123456
   * ```
   *
   * **Message Format (with templates):**
   * Uses configured template with variables (code, expiryMinutes, appName, etc.)
   *
   * **Delivery Time:**
   * - US: ~2-5 seconds
   * - International: ~5-30 seconds
   *
   * @param phone - Recipient phone number in E.164 format (e.g., '+12345678901')
   * @param code - OTP code to send (typically 6 digits)
   * @param templateType - Optional template type (verification, mfa, passwordReset)
   * @param variables - Optional template variables (expiryMinutes, appName, etc.)
   *
   * @throws {Error} If SMS delivery fails
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
   * Send verification code via AWS SNS
   *
   * Alias for sendOTP(). Sends the same transactional SMS message.
   *
   * @param phone - Recipient phone number in E.164 format
   * @param code - Verification code to send
   *
   * @throws {Error} If SMS delivery fails
   */
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    await this.sendOTP(phone, code);
  }

  /**
   * Send SMS message via AWS SNS (Internal)
   *
   * Low-level method for sending SMS with full AWS SNS configuration.
   *
   * **AWS SNS Attributes:**
   * - `AWS.SNS.SMS.SenderID`: Sender name or origination number
   * - `AWS.SNS.SMS.SMSType`: Transactional or Promotional
   * - `AWS.MM.SMS.OriginationNumber`: Phone number for US/Canada
   * - `AWS.SNS.SMS.MaxPrice`: Maximum price per SMS
   *
   * @param phone - Recipient phone number in E.164 format
   * @param message - SMS message content
   *
   * @throws {Error} If AWS SNS API call fails
   *
   * @private
   */
  private async sendSMS(phone: string, message: string): Promise<void> {
    try {
      await this.ensureAwsInitialized();

      // Build SMS attributes - always transactional for auth messages
      interface MessageAttribute {
        DataType: string;
        StringValue: string;
      }

      const messageAttributes: Record<string, MessageAttribute> = {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      };

      // Determine if using phone number or sender ID
      const isPhoneNumber = this.config.originationNumber.startsWith('+');

      if (isPhoneNumber) {
        messageAttributes['AWS.MM.SMS.OriginationNumber'] = {
          DataType: 'String',
          StringValue: this.config.originationNumber,
        };
      } else {
        messageAttributes['AWS.SNS.SMS.SenderID'] = {
          DataType: 'String',
          StringValue: this.config.originationNumber,
        };
      }

      // Build publish command
      const input: Record<string, unknown> = {
        PhoneNumber: phone,
        Message: message,
        MessageAttributes: messageAttributes,
      };

      // Add configuration set if provided
      if (this.config.configurationSetName) {
        // Note: Configuration sets control delivery tracking, logging, etc.
        // Configure these in AWS Console, not here
        (input as { MessageAttributes: Record<string, MessageAttribute> }).MessageAttributes[
          'AWS.SNS.SMS.ConfigurationSetName'
        ] = {
          DataType: 'String',
          StringValue: this.config.configurationSetName,
        };
      }

      const command = new this.publishCommandClass!(input);
      const response = await this.snsClient!.send(command);

      this.logger.log(`SMS sent to ${phone} (MessageId: ${response.MessageId})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AWS SMS failed: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `AWS SMS delivery failed: ${errorMessage}`);
    }
  }
}
