/**
 * AWS SNS SMS Configuration
 *
 * Minimal configuration for sending authentication SMS via AWS SNS.
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
 * // With IAM role (EC2, ECS, Lambda)
 * const config: AWSSMSConfig = {
 *   region: 'us-east-1',
 *   originationNumber: '+12345678901',
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
   * @example '+12345678901'
   * @example 'MyApp'
   */
  originationNumber: string;

  /**
   * AWS SNS Configuration Set Name (Optional)
   *
   * Use configuration sets to control:
   * - CloudWatch metrics and logging
   * - Event destinations (Kinesis, SQS, SNS)
   * - Delivery status tracking
   * - Spend limits and price controls
   *
   * Configure these settings in AWS Console, not here.
   *
   * @example 'my-sms-config-set'
   */
  configurationSetName?: string;
}
