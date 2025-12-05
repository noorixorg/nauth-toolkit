import { SMSProvider, NAuthLogger, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { AWSSMSConfig } from './aws-sms-config.interface';

// Lazy-load AWS SDK types (installed as optionalDependency)
type SNSClient = unknown;

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
  private readonly snsClient: SNSClient;
  private readonly config: AWSSMSConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private SNSClientClass: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private PublishCommandClass: any = null;

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

    // Lazy-load AWS SDK (optional dependency)
    try {
      const awsSdk = require('@aws-sdk/client-sns');
      this.SNSClientClass = awsSdk.SNSClient;
      this.PublishCommandClass = awsSdk.PublishCommand;
    } catch (error) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        'AWS SMS Provider: Failed to load @aws-sdk/client-sns. Ensure @nauth-toolkit/sms-aws-sns is properly installed.',
      );
    }

    // Initialize SNS client - credentials are optional (SDK auto-discovers)
    const clientConfig: Record<string, unknown> = { region: config.region };

    // Only add credentials if explicitly provided
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.snsClient = new this.SNSClientClass(clientConfig) as SNSClient;
    this.logger.log(`AWS SMS Provider initialized (region: ${config.region})`);
  }

  /**
   * Send OTP code via AWS SNS
   *
   * Sends a transactional SMS message with the OTP code using AWS SNS.
   * Automatically formats the message and applies configured settings.
   *
   * **Message Format:**
   * ```
   * Your verification code is: 123456
   * ```
   *
   * **Delivery Time:**
   * - US: ~2-5 seconds
   * - International: ~5-30 seconds
   *
   * @param phone - Recipient phone number in E.164 format (e.g., '+12345678901')
   * @param code - OTP code to send (typically 6 digits)
   *
   * @throws {Error} If SMS delivery fails
   *
   * @example
   * ```typescript
   * await provider.sendOTP('+12345678901', '123456');
   * // SMS delivered: "Your verification code is: 123456"
   * ```
   */
  async sendOTP(phone: string, code: string): Promise<void> {
    const message = `Your verification code is: ${code}`;
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

      if (!this.PublishCommandClass) {
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'AWS SDK not initialized');
      }

      const command = new this.PublishCommandClass(input);
      const response = await (this.snsClient as { send: (cmd: unknown) => Promise<{ MessageId?: string }> }).send(
        command,
      );

      this.logger.log(`SMS sent to ${phone} (MessageId: ${response.MessageId})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AWS SMS failed: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `AWS SMS delivery failed: ${errorMessage}`);
    }
  }
}
