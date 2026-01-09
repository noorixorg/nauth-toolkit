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
   * Send password reset email with optional link
   *
   * @param to - Recipient email address
   * @param token - Reset token (for validation)
   * @param link - Reset link (optional, only sent if provided)
   * @param expiryMinutes - Link expiry time in minutes
   */
  sendPasswordResetEmail(to: string, token: string, link?: string, expiryMinutes?: number): Promise<void>;

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

  /**
   * Send password changed security alert
   *
   * @param to - Recipient email address
   * @param context - Password change context (changedBy, sessionsRevoked, etc.)
   */
  sendPasswordChangedEmail?(
    to: string,
    context: {
      changedBy?: 'user' | 'admin' | 'reset';
      sessionsRevoked?: number;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send MFA device removed security alert
   *
   * @param to - Recipient email address
   * @param context - Device removal context (deviceType, deviceName, etc.)
   */
  sendMFADeviceRemovedEmail?(
    to: string,
    context: {
      deviceType?: string;
      deviceName?: string;
      removedBy?: 'user' | 'system';
      reason?: string;
      remainingDeviceCount?: number;
    },
  ): Promise<void>;

  /**
   * Send adaptive MFA risk detection alert
   *
   * @param to - Recipient email address
   * @param context - Risk detection context (riskScore, riskLevel, etc.)
   */
  sendAdaptiveMFARiskAlertEmail?(
    to: string,
    context: {
      riskScore?: number;
      riskLevel?: 'low' | 'medium' | 'high';
      riskFactors?: string[];
      action?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send account disabled notification
   *
   * @param to - Recipient email address
   * @param context - Account disable context (reason, performedBy, etc.)
   */
  sendAccountDisabledEmail?(
    to: string,
    context: {
      reason?: string;
      performedBy?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send account enabled notification
   *
   * @param to - Recipient email address
   * @param context - Account enable context (reason, performedBy, etc.)
   */
  sendAccountEnabledEmail?(
    to: string,
    context: {
      reason?: string;
      performedBy?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send email changed alert (to OLD email address)
   *
   * Security notification when email address is changed.
   *
   * @param to - OLD email address
   * @param context - Email change context (newEmail, deactivatedMFADevices, etc.)
   */
  sendEmailChangedAlertEmail?(
    to: string,
    context: {
      newEmail?: string;
      deactivatedMFADevices?: number;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send email changed confirmation (to NEW email address)
   *
   * Confirmation when email address is changed.
   *
   * @param to - NEW email address
   * @param context - Email change context (oldEmail, timestamp, etc.)
   */
  sendEmailChangedConfirmationEmail?(
    to: string,
    context: {
      oldEmail?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send account locked notification
   *
   * @param to - Recipient email address
   * @param context - Lockout context (reason, lockDuration, etc.)
   */
  sendAccountLockedEmail?(
    to: string,
    context: {
      reason?: string;
      lockType?: 'temporary' | 'permanent';
      lockDuration?: number;
      lockedUntil?: Date;
      ipAddress?: string;
      failedAttempts?: number;
    },
  ): Promise<void>;

  /**
   * Send sessions revoked security alert
   *
   * @param to - Recipient email address
   * @param context - Session revocation context (revokedCount, reason, etc.)
   */
  sendSessionsRevokedEmail?(
    to: string,
    context: {
      revokedCount?: number;
      reason?: string;
      triggerEvent?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send MFA first enabled confirmation
   *
   * @param to - Recipient email address
   * @param context - MFA enrollment context (firstMethod, deviceName, etc.)
   */
  sendMFAFirstEnabledEmail?(
    to: string,
    context: {
      firstMethod?: string;
      deviceName?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Send MFA method added notification
   *
   * Triggered when a user adds an additional MFA method after MFA is already enabled.
   *
   * @param to - Recipient email address
   * @param context - MFA method addition context (method, enabledMethods, etc.)
   */
  sendMFAMethodAddedEmail?(
    to: string,
    context: {
      method?: string;
      enabledMethods?: string[];
      deviceName?: string;
      timestamp?: string;
    },
  ): Promise<void>;

  /**
   * Set NAuth configuration (called during initialization)
   *
   * Allows email provider to access emailNotifications config for suppression logic.
   *
   * @param config - NAuth configuration object
   */
  setConfig?(config: import('./config.interface').NAuthConfig): void;
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
