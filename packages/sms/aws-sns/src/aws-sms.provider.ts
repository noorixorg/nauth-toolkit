import {
  SMSProvider,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  SMSTemplateEngine,
  SMSTemplateVariables,
} from '@nauth-toolkit/core';
import type { SendTextMessageRequest } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { AWSSMSConfig, AWSSMSApiMode } from './aws-sms-config.interface';

// ============================================================================
// AWS SDK (lazy loaded)
// ============================================================================
// WHY: Keep AWS SDKs as optional dependencies while avoiding require() per project rules.
// The modules are loaded on-demand in `sendSMS()` (async), keeping the constructor synchronous.

// SNS (legacy)
type SNSClientLike = { send: (cmd: unknown) => Promise<{ MessageId?: string }> };
type SNSClientCtor = new (config: Record<string, unknown>) => SNSClientLike;
type PublishCommandCtor = new (input: Record<string, unknown>) => unknown;

// End User Messaging SMS (modern API, package still named pinpoint-sms-voice-v2)
type EndUserMessagingSMSClientLike = { send: (cmd: unknown) => Promise<{ MessageId?: string }> };
type EndUserMessagingSMSClientCtor = new (config: Record<string, unknown>) => EndUserMessagingSMSClientLike;
type SendTextMessageCommandCtor = new (input: Record<string, unknown>) => unknown;

/**
 * AWS SNS & End User Messaging SMS Provider (Platform-Agnostic)
 *
 * Sends authentication SMS via:
 * - AWS SNS Publish API (legacy, default)
 * - AWS End User Messaging SMS API - modern, supports configuration sets
 *
 * All messages sent as transactional (highest priority).
 *
 * @example
 * ```typescript
 * // Legacy SNS API (backward compatible)
 * const provider = new AWSSMSProvider({
 *   region: 'us-east-1',
 *   originationNumber: '+12345678901',
 * });
 *
 * // New End User Messaging SMS API with configuration set
 * const provider = new AWSSMSProvider({
 *   region: 'ap-southeast-2',
 *   originationNumber: 'anyspaces',
 *   apiMode: 'end-user-messaging-sms',
 *   configurationSetName: 'default',
 * });
 *
 * await provider.sendOTP('+1234567890', '123456');
 * ```
 */
export class AWSSMSProvider implements SMSProvider {
  private logger: NAuthLogger;
  private readonly config: AWSSMSConfig;
  private readonly apiMode: AWSSMSApiMode;

  // SNS (legacy)
  private snsClient: SNSClientLike | null = null;
  private snsClientClass: SNSClientCtor | null = null;
  private publishCommandClass: PublishCommandCtor | null = null;

  // End User Messaging SMS (modern)
  private endUserMessagingClient: EndUserMessagingSMSClientLike | null = null;
  private endUserMessagingClientClass: EndUserMessagingSMSClientCtor | null = null;
  private sendTextMessageCommandClass: SendTextMessageCommandCtor | null = null;

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
    this.apiMode = config.apiMode || 'sns';

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

    // Warn if configuration set used with SNS mode (not supported)
    if (this.apiMode === 'sns' && config.configurationSetName) {
      this.logger.warn(
        `AWS SMS Provider: configurationSetName is ignored with apiMode='sns'. Use apiMode='end-user-messaging-sms' for configuration set support.`,
      );
    }

    // AWS SDK + client are initialized lazily in sendSMS() (async) to avoid require().
    this.logger.log(`AWS SMS Provider initialized (region: ${config.region}, mode: ${this.apiMode})`);
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
    this.logger.log(`AWS SMS Provider logger attached (mode: ${this.apiMode})`);
  }

  /**
   * Lazy-initialize AWS SNS SDK and client (legacy mode).
   *
   * Uses native dynamic import fallback to prevent TypeScript from converting
   * import() to require() in CommonJS builds, which would fail in packaged npm.
   *
   * @throws {NAuthException} When AWS SDK cannot be loaded
   */
  private async ensureSNSInitialized(): Promise<void> {
    if (this.snsClient) {
      return;
    }

    if (!this.snsClientClass || !this.publishCommandClass) {
      try {
        // Try standard import first
        let awsSdk: typeof import('@aws-sdk/client-sns');
        try {
          awsSdk = await import('@aws-sdk/client-sns');
        } catch {
          // Native dynamic import fallback (avoids TypeScript rewriting to require())
          const nativeImport = new Function('modulePath', 'return import(modulePath)') as (
            modulePath: string,
          ) => Promise<unknown>;
          awsSdk = (await nativeImport('@aws-sdk/client-sns')) as typeof import('@aws-sdk/client-sns');
        }

        this.snsClientClass = awsSdk.SNSClient as unknown as SNSClientCtor;
        this.publishCommandClass = awsSdk.PublishCommand as unknown as PublishCommandCtor;
      } catch {
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          'AWS SMS Provider: Failed to load @aws-sdk/client-sns. Ensure it is installed.',
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
   * Lazy-initialize AWS End User Messaging SMS SDK and client.
   *
   * Note: The SDK package is still named @aws-sdk/client-pinpoint-sms-voice-v2
   * but represents the AWS End User Messaging SMS service.
   *
   * Uses native dynamic import fallback to prevent TypeScript from converting
   * import() to require() in CommonJS builds, which would fail in packaged npm.
   *
   * @throws {NAuthException} When AWS SDK cannot be loaded
   */
  private async ensureEndUserMessagingSMSInitialized(): Promise<void> {
    if (this.endUserMessagingClient) {
      return;
    }

    if (!this.endUserMessagingClientClass || !this.sendTextMessageCommandClass) {
      try {
        // Note: Package name still references pinpoint-sms-voice-v2, but this is AWS End User Messaging SMS
        let awsSdk: typeof import('@aws-sdk/client-pinpoint-sms-voice-v2');
        try {
          awsSdk = await import('@aws-sdk/client-pinpoint-sms-voice-v2');
        } catch {
          // Native dynamic import fallback (avoids TypeScript rewriting to require())
          const nativeImport = new Function('modulePath', 'return import(modulePath)') as (
            modulePath: string,
          ) => Promise<unknown>;
          awsSdk = (await nativeImport(
            '@aws-sdk/client-pinpoint-sms-voice-v2',
          )) as typeof import('@aws-sdk/client-pinpoint-sms-voice-v2');
        }

        this.endUserMessagingClientClass = awsSdk.PinpointSMSVoiceV2Client as unknown as EndUserMessagingSMSClientCtor;
        this.sendTextMessageCommandClass = awsSdk.SendTextMessageCommand as unknown as SendTextMessageCommandCtor;
      } catch {
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          'AWS SMS Provider: Failed to load @aws-sdk/client-pinpoint-sms-voice-v2. Ensure it is installed.',
        );
      }
    }

    // Initialize End User Messaging SMS client - credentials are optional (SDK auto-discovers)
    const clientConfig: Record<string, unknown> = { region: this.config.region };

    // Only add credentials if explicitly provided
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      };
    }

    this.endUserMessagingClient = new this.endUserMessagingClientClass!(clientConfig);
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
   * Send SMS message via AWS (Internal)
   *
   * Routes to either SNS Publish or End User Messaging SMS based on apiMode configuration.
   *
   * **SNS Mode (legacy):**
   * - Uses SNS Publish API
   * - Configuration sets NOT supported
   * - Message attributes: AWS.SNS.SMS.SenderID, AWS.SNS.SMS.SMSType, AWS.MM.SMS.OriginationNumber
   *
   * **End User Messaging SMS Mode (modern):**
   * - Uses End User Messaging SMS SendTextMessage API
   * - Configuration sets fully supported
   * - Delivery events to SNS topics, CloudWatch, Kinesis
   * - Modern API for SMS/MMS messaging
   *
   * @param phone - Recipient phone number in E.164 format
   * @param message - SMS message content
   *
   * @throws {Error} If AWS API call fails
   *
   * @private
   */
  private async sendSMS(phone: string, message: string): Promise<void> {
    if (this.apiMode === 'sns') {
      await this.sendViaSNS(phone, message);
    } else {
      await this.sendViaEndUserMessagingSMS(phone, message);
    }
  }

  /**
   * Send SMS via AWS SNS Publish API (legacy mode)
   *
   * **AWS SNS Attributes:**
   * - `AWS.SNS.SMS.SenderID`: Sender name or origination number
   * - `AWS.SNS.SMS.SMSType`: Transactional or Promotional
   * - `AWS.MM.SMS.OriginationNumber`: Phone number for US/Canada
   * - `AWS.SNS.SMS.MaxPrice`: Maximum price per SMS
   *
   * **Note:** Configuration sets are NOT supported with SNS Publish.
   * AWS rejects message attributes starting with 'AWS.' or 'Amazon.'
   *
   * @param phone - Recipient phone number in E.164 format
   * @param message - SMS message content
   *
   * @throws {NAuthException} If AWS SNS API call fails
   *
   * @private
   */
  private async sendViaSNS(phone: string, message: string): Promise<void> {
    try {
      await this.ensureSNSInitialized();

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

      // Note: Configuration sets are NOT supported with SNS Publish API
      // Use apiMode: 'end-user-messaging-sms' for configuration set support

      const command = new this.publishCommandClass!(input);
      const response = await this.snsClient!.send(command);

      this.logger.log(`SMS sent to ${phone} (MessageId: ${response.MessageId})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AWS SMS failed: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `AWS SMS delivery failed: ${errorMessage}`);
    }
  }

  /**
   * Send SMS via AWS End User Messaging SMS API (modern mode)
   *
   * **Features:**
   * - Full configuration set support
   * - Delivery events to SNS topics, CloudWatch, Kinesis
   * - Modern API for SMS/MMS messaging
   * - Supports phone numbers, sender IDs, and pools
   *
   * @param phone - Recipient phone number in E.164 format
   * @param message - SMS message content
   *
   * @throws {NAuthException} If AWS End User Messaging SMS API call fails
   *
   * @private
   */
  private async sendViaEndUserMessagingSMS(phone: string, message: string): Promise<void> {
    try {
      await this.ensureEndUserMessagingSMSInitialized();

      // Build SendTextMessage input to match API shape (ensures ConfigurationSetName is sent when set)
      const input: SendTextMessageRequest = {
        DestinationPhoneNumber: phone,
        MessageBody: message,
        MessageType: 'TRANSACTIONAL',
        OriginationIdentity: this.config.originationNumber,
        ...(this.config.configurationSetName ? { ConfigurationSetName: this.config.configurationSetName } : {}),
      };

      if (this.config.configurationSetName) {
        this.logger.log(
          `Sending SMS with configuration set: ${this.config.configurationSetName} (ensure this set has event destinations in AWS End User Messaging SMS)`,
        );
        this.logger.debug(
          `End User Messaging SMS request: ConfigurationSetName=${this.config.configurationSetName}, OriginationIdentity=${this.config.originationNumber}, MessageType=TRANSACTIONAL`,
        );
      }

      const command = new this.sendTextMessageCommandClass!(input as unknown as Record<string, unknown>);
      const response = await this.endUserMessagingClient!.send(command);

      this.logger.log(`SMS sent to ${phone} (MessageId: ${response.MessageId})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AWS End User Messaging SMS failed: ${errorMessage}`);

      // Provide clearer message for protect-configuration blocks (destination country / number)
      const userMessage = this.getEndUserMessagingSMSUserMessage(errorMessage);
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, userMessage);
    }
  }

  /**
   * Map AWS End User Messaging SMS errors to user-facing messages.
   * Protect configuration blocks are an AWS account/config issue, not an app bug.
   *
   * @param awsMessage - Raw error message from AWS SDK
   * @returns User-facing message
   * @private
   */
  private getEndUserMessagingSMSUserMessage(awsMessage: string): string {
    if (awsMessage.includes('DESTINATION_COUNTRY_BLOCKED_BY_PROTECT_CONFIGURATION')) {
      return (
        'AWS End User Messaging SMS delivery failed: destination country is blocked by your AWS protect configuration. ' +
        'Allow the country in AWS End User Messaging SMS (protect configuration) or use a configuration set without that protect association.'
      );
    }
    if (awsMessage.includes('DESTINATION_PHONE_NUMBER_BLOCKED_BY_PROTECT_NUMBER_OVERRIDE')) {
      return (
        'AWS End User Messaging SMS delivery failed: destination number is blocked by your AWS protect number override. ' +
        'Update or remove the override in AWS End User Messaging SMS.'
      );
    }
    if (awsMessage.includes('TEXT_PROTECT_BLOCKED')) {
      return (
        'AWS End User Messaging SMS delivery failed: message blocked by AWS Text Protect. ' +
        'Check your protect configuration in AWS End User Messaging SMS.'
      );
    }
    return `AWS End User Messaging SMS delivery failed: ${awsMessage}`;
  }
}
