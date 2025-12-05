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
   */
  sendOTP(phone: string, code: string): Promise<void>;

  /**
   * Send verification code
   */
  sendVerificationCode?(phone: string, code: string): Promise<void>;
}
