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
  currentPassword: string;
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
