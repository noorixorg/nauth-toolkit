/**
 * Email provider interface for sending emails
 */
export interface EmailProvider {
  /**
   * Send email verification code/link
   * @param to - Recipient email address
   * @param code - Verification code (e.g., "123456")
   * @param link - Optional verification link (only sent if provided by consumer app)
   */
  sendVerificationEmail(to: string, code: string, link?: string): Promise<void>;

  /**
   * Send password reset email
   */
  sendPasswordResetEmail(to: string, token: string, link: string): Promise<void>;

  /**
   * Send admin-initiated password reset email with code AND optional link
   * Pattern matches sendVerificationEmail (code + optional link)
   *
   * @param to - Recipient email address
   * @param code - Reset code (e.g., "123456")
   * @param link - Optional reset link with token (for consumer apps to build UI)
   * @param expiryMinutes - Code expiry time in minutes
   */
  sendAdminPasswordResetEmail(to: string, code: string, link?: string, expiryMinutes?: number): Promise<void>;

  /**
   * Send welcome email
   */
  sendWelcomeEmail(to: string, name: string): Promise<void>;

  /**
   * Send account lockout notification
   */
  sendLockoutEmail?(to: string, reason: string, duration: number): Promise<void>;

  /**
   * Send new device login notification
   */
  sendNewDeviceEmail?(to: string, deviceInfo: any, location?: any): Promise<void>;
}

/**
 * SMS provider interface for sending text messages
 */
export interface SMSProvider {
  /**
   * Send OTP code via SMS
   *
   * @param phone - Recipient phone number in E.164 format
   * @param code - OTP code to send
   * @param templateType - Optional template type (verification, mfa, passwordReset)
   * @param variables - Optional template variables (expiryMinutes, appName, etc.)
   *
   * @example
   * ```typescript
   * await provider.sendOTP('+1234567890', '123456');
   * // With template support:
   * await provider.sendOTP('+1234567890', '123456', 'verification', { expiryMinutes: 5 });
   * ```
   */
  sendOTP(phone: string, code: string, templateType?: string, variables?: Record<string, unknown>): Promise<void>;

  /**
   * Send verification code
   *
   * Alias for sendOTP(). Sends the same SMS message.
   *
   * @param phone - Recipient phone number in E.164 format
   * @param code - Verification code to send
   *
   * @example
   * ```typescript
   * await provider.sendVerificationCode('+1234567890', '123456');
   * ```
   */
  sendVerificationCode?(phone: string, code: string): Promise<void>;

  /**
   * Set template engine for SMS message customization
   *
   * Optional method to enable template-based SMS messages.
   * If not set, provider will use hard-coded default messages.
   *
   * @param engine - SMS template engine instance
   *
   * @example
   * ```typescript
   * const engine = new SMSTemplateEngine();
   * provider.setTemplateEngine(engine);
   * ```
   */
  setTemplateEngine?(engine: import('./sms-template.interface').SMSTemplateEngine): void;

  /**
   * Set global variables for SMS templates
   *
   * Optional method to set global variables (appName, companyName, etc.)
   * that will be available to all SMS templates.
   *
   * @param variables - Global template variables
   *
   * @example
   * ```typescript
   * provider.setGlobalVariables({
   *   appName: 'My App',
   *   companyName: 'My Company Inc.',
   *   supportPhone: '+1-800-123-4567',
   * });
   * ```
   */
  setGlobalVariables?(variables: import('./sms-template.interface').SMSTemplateVariables): void;
}
