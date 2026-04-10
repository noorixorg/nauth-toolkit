/**
 * Twilio SMS Provider Configuration
 *
 * Minimal configuration for sending authentication SMS via Twilio.
 *
 * You can use either a direct `fromNumber` (E.164 phone number) or a
 * `messagingServiceSid` (Twilio Messaging Service) — but not both.
 *
 * @example
 * ```typescript
 * // With a direct phone number
 * const config: TwilioSMSConfig = {
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   fromNumber: '+15551234567',
 * };
 *
 * // With a Messaging Service
 * const config: TwilioSMSConfig = {
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
 * };
 * ```
 */
export interface TwilioSMSConfig {
  /**
   * Twilio Account SID
   *
   * Found at https://console.twilio.com under "Account Info".
   *
   * @example 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
   */
  accountSid: string;

  /**
   * Twilio Auth Token
   *
   * Found at https://console.twilio.com under "Account Info".
   */
  authToken: string;

  /**
   * Sender phone number in E.164 format
   *
   * Must be a Twilio phone number you own.
   * Provide either `fromNumber` or `messagingServiceSid`, not both.
   *
   * @example '+15551234567'
   */
  fromNumber?: string;

  /**
   * Twilio Messaging Service SID (Optional)
   *
   * Use a Messaging Service for automatic sender selection, sticky sender,
   * opt-out management, and advanced delivery features.
   * Provide either `fromNumber` or `messagingServiceSid`, not both.
   *
   * @example 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
   */
  messagingServiceSid?: string;
}
