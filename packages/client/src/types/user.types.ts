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
