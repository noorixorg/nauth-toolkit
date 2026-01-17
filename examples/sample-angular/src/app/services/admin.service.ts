import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Admin signup request DTO
 */
export interface AdminSignupRequest {
  email: string;
  password?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  mustChangePassword?: boolean;
  generatePassword?: boolean;
}

/**
 * Admin signup response DTO
 *
 * User object is sanitized (excludes passwordHash and other sensitive fields)
 */
export interface AdminSignupResponse {
  user: {
    sub: string; // External UUID identifier (not internal database ID)
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isActive: boolean;
    mfaEnabled: boolean;
    socialProviders?: string[] | null;
    hasPasswordHash: boolean; // Indicates if password is set (not the hash itself)
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  generatedPassword?: string;
}

/**
 * Admin social signup request DTO
 */
export interface AdminSignupSocialRequest {
  email: string;
  provider: 'google' | 'apple' | 'facebook';
  providerId: string;
  providerEmail?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
  isPhoneVerified?: boolean;
  mustChangePassword?: boolean;
  socialMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Admin social signup response DTO
 */
export interface AdminSignupSocialResponse {
  user: {
    sub: string;
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isActive: boolean;
    mfaEnabled: boolean;
    socialProviders?: string[] | null;
    hasPasswordHash: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  socialAccount: {
    provider: string;
    providerId: string;
    providerEmail: string | null;
  };
}

/**
 * User object (sanitized)
 */
export interface User {
  sub: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  isLocked?: boolean;
  mfaEnabled: boolean;
  hasSocialAuth?: boolean;
  socialProviders?: string[] | null;
  hasPasswordHash: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Get users request DTO
 */
export interface GetUsersRequest {
  page?: number;
  limit?: number;
  email?: string;
  phone?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  hasSocialAuth?: boolean;
  isLocked?: boolean;
  mfaEnabled?: boolean;
  createdAt?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    value: Date | string;
  };
  updatedAt?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    value: Date | string;
  };
  sortBy?: 'email' | 'createdAt' | 'updatedAt' | 'username' | 'phone';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Get users response DTO
 */
export interface GetUsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Delete user request DTO
 */
export interface DeleteUserRequest {
  sub: string;
}

/**
 * Delete user response DTO
 */
export interface DeleteUserResponse {
  success: boolean;
  deletedUserId: string;
  deletedRecords: {
    sessions: number;
    verificationTokens: number;
    mfaDevices: number;
    trustedDevices: number;
    socialAccounts: number;
    loginAttempts: number;
    challengeSessions: number;
    auditLogs: number;
  };
}

/**
 * Disable user request DTO
 */
export interface DisableUserRequest {
  sub: string;
  reason?: string;
}

/**
 * Disable user response DTO
 */
export interface DisableUserResponse {
  success: boolean;
  user: User;
  revokedSessions: number;
}

/**
 * Enable user response DTO
 */
export interface EnableUserResponse {
  success: boolean;
  user: User;
}

/**
 * Admin set password request DTO
 */
export interface AdminSetPasswordRequest {
  identifier: string; // email, username, or phone
  password: string;
}

/**
 * Admin-initiated password reset request DTO
 */
export interface AdminResetPasswordRequest {
  /**
   * Target user sub (UUID v4)
   *
   * NOTE: Admin reset-password endpoints require `sub` (not email/phone).
   */
  sub: string;
  deliveryMethod?: 'email' | 'sms';
  baseUrl?: string;
  codeExpiresIn?: number;
  revokeSessions?: boolean;
  reason?: string;
}

/**
 * Admin-initiated password reset response DTO
 */
export interface AdminResetPasswordResponse {
  success: boolean;
  destination?: string;
  deliveryMedium?: 'email' | 'sms';
  expiresIn?: number;
  sessionsRevoked?: number;
}

/**
 * Admin Service
 *
 * Handles administrative operations for user management.
 * Currently supports admin user creation with override capabilities.
 *
 * Future features:
 * - Reset password for any user
 * - User account management
 * - Bulk operations
 *
 * @example
 * ```typescript
 * const adminService = inject(AdminService);
 * const result = await adminService.createUser({
 *   email: 'user@example.com',
 *   generatePassword: true,
 *   isEmailVerified: true,
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AdminService {
  /**
   * HTTP client for API calls
   */
  private readonly http = inject(HttpClient);

  /**
   * Base URL for admin API endpoints
   */
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/admin`;

  /**
   * Create a new user account with admin privileges
   *
   * Allows creating users with:
   * - Pre-verified email/phone
   * - Auto-generated passwords
   * - Force password change flag
   *
   * @param dto - Admin signup request data
   * @returns Created user and optionally generated password
   * @throws {Error} If API call fails
   *
   * @example
   * ```typescript
   * // Create user with pre-verified email
   * const result = await adminService.createUser({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   isEmailVerified: true,
   * });
   *
   * // Create user with auto-generated password
   * const result = await adminService.createUser({
   *   email: 'user@example.com',
   *   generatePassword: true,
   *   mustChangePassword: true,
   * });
   * // result.generatedPassword contains the temporary password
   * ```
   */
  async createUser(dto: AdminSignupRequest): Promise<AdminSignupResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<AdminSignupResponse>(`${this.baseUrl}/signup`, dto),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to create user');
      }
      throw error;
    }
  }

  /**
   * Get paginated list of users with advanced filtering
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated user list
   * @throws {Error} If API call fails
   */
  async getUsers(params: GetUsersRequest): Promise<GetUsersResponse> {
    try {
      // Build query params using HttpParams for proper encoding
      let httpParams = new HttpParams();

      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.email) httpParams = httpParams.set('email', params.email);
      if (params.phone) httpParams = httpParams.set('phone', params.phone);
      if (params.isEmailVerified !== undefined) {
        httpParams = httpParams.set('isEmailVerified', params.isEmailVerified.toString());
      }
      if (params.isPhoneVerified !== undefined) {
        httpParams = httpParams.set('isPhoneVerified', params.isPhoneVerified.toString());
      }
      if (params.hasSocialAuth !== undefined) {
        httpParams = httpParams.set('hasSocialAuth', params.hasSocialAuth.toString());
      }
      if (params.isLocked !== undefined) {
        httpParams = httpParams.set('isLocked', params.isLocked.toString());
      }
      if (params.mfaEnabled !== undefined) {
        httpParams = httpParams.set('mfaEnabled', params.mfaEnabled.toString());
      }
      if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
      if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

      // Handle date filters with nested object notation
      if (params.createdAt) {
        const dateValue =
          params.createdAt.value instanceof Date
            ? params.createdAt.value.toISOString()
            : params.createdAt.value;
        httpParams = httpParams.set('createdAt[operator]', params.createdAt.operator);
        httpParams = httpParams.set('createdAt[value]', dateValue);
      }
      if (params.updatedAt) {
        const dateValue =
          params.updatedAt.value instanceof Date
            ? params.updatedAt.value.toISOString()
            : params.updatedAt.value;
        httpParams = httpParams.set('updatedAt[operator]', params.updatedAt.operator);
        httpParams = httpParams.set('updatedAt[value]', dateValue);
      }

      const response = await firstValueFrom(
        this.http.get<GetUsersResponse>(`${this.baseUrl}/users`, { params: httpParams }),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to get users');
      }
      throw error;
    }
  }

  /**
   * Delete user with cascade cleanup
   *
   * @param sub - User UUID to delete
   * @returns Deletion confirmation with cascade counts
   * @throws {Error} If API call fails
   */
  async deleteUser(sub: string): Promise<DeleteUserResponse> {
    try {
      const response = await firstValueFrom(
        this.http.delete<DeleteUserResponse>(`${this.baseUrl}/users/${sub}`),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to delete user');
      }
      throw error;
    }
  }

  /**
   * Disable user account (permanent lock)
   *
   * @param sub - User UUID to disable
   * @param reason - Optional reason for locking
   * @returns Lock confirmation with revoked session count
   * @throws {Error} If API call fails
   */
  async disableUser(sub: string, reason?: string): Promise<DisableUserResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<DisableUserResponse>(`${this.baseUrl}/users/${sub}/disable`, { reason }),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to disable user');
      }
      throw error;
    }
  }

  /**
   * Set password for any user (admin operation)
   *
   * @param identifier - User email, username, or phone
   * @param password - New password
   * @returns Success confirmation
   * @throws {Error} If API call fails
   */
  async setPassword(identifier: string, password: string): Promise<{ success: boolean }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean }>(`${this.baseUrl}/set-password`, {
          identifier,
          newPassword: password,
        }),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to set password');
      }
      throw error;
    }
  }

  /**
   * Force password change on next login
   *
   * Requires user to change their password on their next login attempt.
   * User will receive FORCE_CHANGE_PASSWORD challenge when they try to login.
   *
   * @param sub - User UUID to force password change
   * @returns Success confirmation
   * @throws {Error} If API call fails
   */
  async forcePasswordChange(sub: string): Promise<{ success: boolean }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean }>(
          `${this.baseUrl}/users/${sub}/force-password-change`,
          {},
        ),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to force password change');
      }
      throw error;
    }
  }

  /**
   * Enable (unlock) user account
   *
   * Unlocks a previously locked user account by clearing all lock fields.
   * This reverses the effect of disableUser() or rate-limit lockouts.
   *
   * @param sub - User UUID to enable
   * @returns Unlock confirmation with updated user
   * @throws {Error} If API call fails
   */
  async enableUser(sub: string): Promise<EnableUserResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<EnableUserResponse>(`${this.baseUrl}/users/${sub}/enable`, {}),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to enable user');
      }
      throw error;
    }
  }

  /**
   * Import social user (admin operation)
   *
   * Imports existing social users from external platforms (e.g., Cognito, Auth0)
   * with social account linkage.
   *
   * @param dto - Admin social signup request data
   * @returns Created user and social account confirmation
   * @throws {Error} If API call fails
   */
  async importSocialUser(dto: AdminSignupSocialRequest): Promise<AdminSignupSocialResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<AdminSignupSocialResponse>(`${this.baseUrl}/signup-social`, dto),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to import social user');
      }
      throw error;
    }
  }

  /**
   * Initiate admin password reset workflow
   *
   * Sends a verification code (and optional link) to the user via email/SMS.
   * User can then reset their password using the code or link.
   *
   * @param dto - Admin reset password request
   * @returns Reset confirmation with delivery details
   * @throws {Error} If API call fails
   *
   * @example
   * ```typescript
   * const result = await adminService.adminResetPassword({
   *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
   *   deliveryMethod: 'email',
   *   baseUrl: 'https://myapp.com/reset-password',
   *   reason: 'User reported account compromise'
   * });
   * ```
   */
  async adminResetPassword(dto: AdminResetPasswordRequest): Promise<AdminResetPasswordResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<AdminResetPasswordResponse>(`${this.baseUrl}/reset-password/initiate`, dto),
      );
      return response;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'error' in error) {
        const httpError = error as { error?: { message?: string; code?: string } };
        throw new Error(httpError.error?.message || 'Failed to initiate password reset');
      }
      throw error;
    }
  }
}
