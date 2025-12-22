import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
}

