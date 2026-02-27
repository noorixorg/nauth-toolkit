/**
 * AWS SMS API Mode
 *
 * Determines which AWS service to use for sending SMS messages:
 * - `sns`: Legacy SNS Publish API (default, no configuration set support)
 * - `end-user-messaging-sms`: AWS End User Messaging SMS API (supports configuration sets, delivery events)
 */
export type AWSSMSApiMode = 'sns' | 'end-user-messaging-sms';

/**
 * AWS SNS SMS Configuration
 *
 * Minimal configuration for sending authentication SMS via AWS SNS or AWS End User Messaging.
 * All messages are sent as transactional (highest priority).
 *
 * AWS credentials are optional - SDK will auto-discover from:
 * - EC2 instance IAM role
 * - ECS task role
 * - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - AWS credentials file (~/.aws/credentials)
 * - AWS profile (AWS_PROFILE environment variable)
 *
 * @example
 * ```typescript
 * // Legacy SNS API (default, backward compatible)
 * const config: AWSSMSConfig = {
 *   region: 'us-east-1',
 *   originationNumber: '+12345678901',
 * };
 *
 * // New End User Messaging SMS API with configuration set
 * const config: AWSSMSConfig = {
 *   region: 'ap-southeast-2',
 *   originationNumber: 'anyspaces',
 *   apiMode: 'end-user-messaging-sms',
 *   configurationSetName: 'default',
 * };
 *
 * // With explicit credentials (if needed)
 * const config: AWSSMSConfig = {
 *   region: 'us-east-1',
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   originationNumber: '+12345678901',
 * };
 * ```
 */
export interface AWSSMSConfig {
  /**
   * AWS Region
   * @example 'us-east-1'
   */
  region: string;

  /**
   * AWS Access Key ID (Optional)
   *
   * If not provided, AWS SDK will auto-discover credentials from:
   * - IAM instance role
   * - Environment variables
   * - AWS credentials file
   */
  accessKeyId?: string;

  /**
   * AWS Secret Access Key (Optional)
   *
   * Required only if accessKeyId is provided.
   */
  secretAccessKey?: string;

  /**
   * Origination Number (E.164 format) or Sender ID
   *
   * - **US/Canada:** Phone number required (e.g., '+12345678901')
   * - **Other regions:** Alphanumeric sender ID supported (e.g., 'MyApp')
   *
   * For `end-user-messaging-sms` mode:
   * - Can be PhoneNumberId, PhoneNumberArn, SenderId, SenderIdArn, PoolId, or PoolArn
   * - Alphanumeric sender IDs supported in regions that allow them
   *
   * @example '+12345678901'
   * @example 'MyApp'
   */
  originationNumber: string;

  /**
   * AWS SMS API Mode (Optional)
   *
   * Choose which AWS service to use for sending SMS:
   * - `sns` (default): Legacy SNS Publish API
   *   - Simple, backward compatible
   *   - Configuration sets NOT supported (AWS rejects AWS.* attributes)
   *   - Use for basic SMS sending without delivery tracking
   *
   * - `end-user-messaging-sms`: AWS End User Messaging SMS API
   *   - Modern SMS/MMS messaging service
   *   - Configuration sets fully supported
   *   - Delivery events to SNS, CloudWatch, Kinesis
   *   - Required for delivery tracking and event destinations
   *
   * @default 'sns'
   * @example 'end-user-messaging-sms'
   */
  apiMode?: AWSSMSApiMode;

  /**
   * AWS Configuration Set Name (Optional)
   *
   * **IMPORTANT:** Only works with `apiMode: 'end-user-messaging-sms'`
   *
   * Configuration sets control:
   * - CloudWatch metrics and logging
   * - Event destinations (SNS topics for delivery/failure events)
   * - Delivery status tracking
   * - Spend limits and price controls
   *
   * Configure event destinations in AWS Console:
   * End User Messaging SMS → Configuration sets → [your-set] → Event destinations
   *
   * With `apiMode: 'sns'` (default), this setting is ignored (SNS does not support it).
   *
   * @example 'default'
   * @example 'my-sms-config-set'
   */
  configurationSetName?: string;
}
