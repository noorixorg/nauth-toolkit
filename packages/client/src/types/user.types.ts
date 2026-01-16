/**
 * Full user profile returned from profile endpoints.
 */
export interface AuthUser {
  sub: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive?: boolean;
  mfaEnabled?: boolean;
  socialProviders?: string[] | null;
  hasPasswordHash: boolean;
  /**
   * Authentication method used to create the current session.
   *
   * This is session-scoped (how the user logged in this time), not an account capability.
   * Use `hasPasswordHash` and `socialProviders` to determine what login methods the account supports.
   */
  sessionAuthMethod?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Profile update request.
 */
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

/**
 * Change password request.
 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/**
 * Forgot password request payload.
 */
export interface ForgotPasswordRequest {
  identifier: string;
}

/**
 * Forgot password response payload.
 */
export interface ForgotPasswordResponse {
  success: boolean;
  destination?: string;
  deliveryMedium?: 'email' | 'sms';
  expiresIn?: number;
}

/**
 * Confirm forgot password request payload.
 */
export interface ConfirmForgotPasswordRequest {
  identifier: string;
  code: string;
  newPassword: string;
}

/**
 * Confirm forgot password response payload.
 */
export interface ConfirmForgotPasswordResponse {
  success: boolean;
  mustChangePassword: boolean;
}

/**
 * Reset password with code request (generic for both admin-initiated and user-initiated resets).
 */
export interface ResetPasswordWithCodeRequest {
  identifier: string;
  code: string;
  newPassword: string;
}

/**
 * Reset password with code response.
 */
export interface ResetPasswordWithCodeResponse {
  success: boolean;
}
