import { ResolvedNAuthClientConfig } from './config';
import { NAuthAdminEndpoints } from '../types/config.types';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';
import type {
  AdminSignupRequest,
  AdminSignupResponse,
  AdminSignupSocialRequest,
  AdminSignupSocialResponse,
  GetUsersRequest,
  GetUsersResponse,
  DeleteUserResponse,
  DisableUserResponse,
  EnableUserResponse,
  AdminResetPasswordRequest,
  AdminResetPasswordResponse,
  GetUserSessionsResponse,
  AdminAuditHistoryRequest,
} from '../types/admin.types';
import type { AuthUser } from '../types/user.types';
import type { MFAStatus, RemoveMFADeviceResponse } from '../types/mfa.types';
import type { AuditHistoryResponse } from '../types/audit.types';

const hasWindow = (): boolean =>
  typeof globalThis !== 'undefined' && typeof (globalThis as { window?: unknown }).window !== 'undefined';

/**
 * Admin operations for user and system management.
 * Accessed via client.admin.*
 *
 * Provides admin-level operations including:
 * - User CRUD operations
 * - Password management (set, reset)
 * - Session management
 * - MFA management
 * - Audit history
 *
 * @example
 * ```typescript
 * const client = new NAuthClient({
 *   baseUrl: 'https://api.example.com/auth',
 *   tokenDelivery: 'cookies',
 *   admin: {
 *     pathPrefix: '/admin'
 *   }
 * });
 *
 * // User management
 * const user = await client.admin.createUser({
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   isEmailVerified: true,
 * });
 *
 * // Get users with filters
 * const users = await client.admin.getUsers({
 *   page: 1,
 *   limit: 20,
 *   mfaEnabled: false
 * });
 *
 * // Delete user (handles :sub path param)
 * await client.admin.deleteUser('user-uuid');
 * ```
 */
export class AdminOperations {
  private readonly config: ResolvedNAuthClientConfig;
  private readonly adminEndpoints: NAuthAdminEndpoints;
  private readonly adminPathPrefix: string;
  private readonly adminHeaders: Record<string, string>;

  /**
   * Create admin operations instance.
   *
   * @param config - Resolved client configuration
   */
  constructor(config: ResolvedNAuthClientConfig) {
    if (!config.admin) {
      throw new Error('Admin operations require admin configuration');
    }

    this.config = config;
    this.adminEndpoints = config.admin.endpoints;
    this.adminPathPrefix = config.admin.pathPrefix;
    this.adminHeaders = config.admin.headers;
  }

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Create a new user (admin operation)
   *
   * Allows creating users with:
   * - Pre-verified email/phone
   * - Auto-generated passwords
   * - Force password change flag
   *
   * @param request - User creation request
   * @returns Created user and optional generated password
   * @throws {NAuthClientError} If creation fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.createUser({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   isEmailVerified: true,
   * });
   *
   * // With auto-generated password
   * const result = await client.admin.createUser({
   *   email: 'user@example.com',
   *   generatePassword: true,
   *   mustChangePassword: true,
   * });
   * console.log('Generated password:', result.generatedPassword);
   * ```
   */
  async createUser(request: AdminSignupRequest): Promise<AdminSignupResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.signup);
    return this.post<AdminSignupResponse>(path, request);
  }

  /**
   * Import social user (admin operation)
   *
   * Imports existing social users from external platforms (e.g., Cognito, Auth0)
   * with social account linkage.
   *
   * @param request - Social user import request
   * @returns Created user and social account info
   * @throws {NAuthClientError} If import fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.importSocialUser({
   *   email: 'user@example.com',
   *   provider: 'google',
   *   providerId: 'google_12345',
   *   providerEmail: 'user@gmail.com',
   * });
   * ```
   */
  async importSocialUser(request: AdminSignupSocialRequest): Promise<AdminSignupSocialResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.signupSocial);
    return this.post<AdminSignupSocialResponse>(path, request);
  }

  /**
   * Get users with filters and pagination
   *
   * @param params - Filter and pagination params
   * @returns Paginated user list
   * @throws {NAuthClientError} If request fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.getUsers({
   *   page: 1,
   *   limit: 20,
   *   isEmailVerified: true,
   *   mfaEnabled: false,
   *   sortBy: 'createdAt',
   *   sortOrder: 'DESC',
   * });
   * ```
   */
  async getUsers(params: GetUsersRequest = {}): Promise<GetUsersResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.getUsers);
    const queryString = this.buildQueryString(params as unknown as Record<string, unknown>);
    return this.get<GetUsersResponse>(`${path}${queryString}`);
  }

  /**
   * Get user by sub (UUID)
   *
   * @param sub - User UUID
   * @returns User object
   * @throws {NAuthClientError} If user not found
   *
   * @example
   * ```typescript
   * const user = await client.admin.getUser('a21b654c-2746-4168-acee-c175083a65cd');
   * ```
   */
  async getUser(sub: string): Promise<AuthUser> {
    const path = this.buildAdminUrl(this.adminEndpoints.getUser, { sub });
    return this.get<AuthUser>(path);
  }

  /**
   * Delete user with cascade cleanup
   *
   * @param sub - User UUID
   * @returns Deletion confirmation with cascade counts
   * @throws {NAuthClientError} If deletion fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.deleteUser('user-uuid');
   * console.log('Deleted records:', result.deletedRecords);
   * ```
   */
  async deleteUser(sub: string): Promise<DeleteUserResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.deleteUser, { sub });
    return this.delete<DeleteUserResponse>(path);
  }

  /**
   * Disable user account (permanent lock)
   *
   * @param sub - User UUID
   * @param reason - Optional reason for disabling
   * @returns Disable confirmation with revoked session count
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.disableUser(
   *   'user-uuid',
   *   'Account compromised'
   * );
   * console.log('Revoked sessions:', result.revokedSessions);
   * ```
   */
  async disableUser(sub: string, reason?: string): Promise<DisableUserResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.disableUser, { sub });
    return this.post<DisableUserResponse>(path, { reason });
  }

  /**
   * Enable (unlock) user account
   *
   * @param sub - User UUID
   * @returns Enable confirmation with updated user
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.enableUser('user-uuid');
   * console.log('User enabled:', result.user);
   * ```
   */
  async enableUser(sub: string): Promise<EnableUserResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.enableUser, { sub });
    return this.post<EnableUserResponse>(path, {});
  }

  /**
   * Force password change on next login
   *
   * @param sub - User UUID
   * @returns Success confirmation
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * await client.admin.forcePasswordChange('user-uuid');
   * ```
   */
  async forcePasswordChange(sub: string): Promise<{ success: boolean }> {
    const path = this.buildAdminUrl(this.adminEndpoints.forcePasswordChange, { sub });
    return this.post<{ success: boolean }>(path, {});
  }

  // ============================================================================
  // Password Management
  // ============================================================================

  /**
   * Set password for any user (admin operation)
   *
   * @param identifier - User email, username, or phone
   * @param newPassword - New password
   * @returns Success confirmation
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * await client.admin.setPassword('user@example.com', 'NewSecurePass123!');
   * ```
   */
  async setPassword(identifier: string, newPassword: string): Promise<{ success: boolean }> {
    const path = this.buildAdminUrl(this.adminEndpoints.setPassword);
    return this.post<{ success: boolean }>(path, { identifier, newPassword });
  }

  /**
   * Initiate password reset workflow (sends code/link to user)
   *
   * @param request - Password reset request
   * @returns Reset confirmation with delivery details
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.initiatePasswordReset({
   *   sub: 'user-uuid',
   *   deliveryMethod: 'email',
   *   baseUrl: 'https://myapp.com/reset-password',
   *   reason: 'User requested password reset',
   * });
   * console.log('Code sent to:', result.destination);
   * ```
   */
  async initiatePasswordReset(request: AdminResetPasswordRequest): Promise<AdminResetPasswordResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.resetPasswordInitiate);
    return this.post<AdminResetPasswordResponse>(path, request);
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Get all sessions for a user
   *
   * @param sub - User UUID
   * @returns User sessions
   * @throws {NAuthClientError} If request fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.getUserSessions('user-uuid');
   * console.log('Active sessions:', result.sessions);
   * ```
   */
  async getUserSessions(sub: string): Promise<GetUserSessionsResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.getUserSessions, { sub });
    return this.get<GetUserSessionsResponse>(path);
  }

  /**
   * Logout all sessions for a user (admin-initiated)
   *
   * @param sub - User UUID
   * @param forgetDevices - If true, also revokes all trusted devices
   * @returns Number of sessions revoked
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.logoutAllSessions('user-uuid', true);
   * console.log(`Revoked ${result.revokedCount} sessions`);
   * ```
   */
  async logoutAllSessions(sub: string, forgetDevices = false): Promise<{ revokedCount: number }> {
    const path = this.buildAdminUrl(this.adminEndpoints.logoutAll, { sub });
    return this.post<{ revokedCount: number }>(path, { forgetDevices });
  }

  // ============================================================================
  // MFA Management
  // ============================================================================

  /**
   * Get MFA status for a user
   *
   * @param sub - User UUID
   * @returns MFA status
   * @throws {NAuthClientError} If request fails
   *
   * @example
   * ```typescript
   * const status = await client.admin.getMfaStatus('user-uuid');
   * console.log('MFA enabled:', status.enabled);
   * ```
   */
  async getMfaStatus(sub: string): Promise<MFAStatus> {
    const path = this.buildAdminUrl(this.adminEndpoints.getMfaStatus, { sub });
    return this.get<MFAStatus>(path);
  }

  /**
   * Set preferred MFA method for a user
   *
   * @param sub - User UUID
   * Remove MFA devices for a user
   *
   * @param sub - User UUID
   * @param method - MFA method to remove
   * @returns Success message
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * await client.admin.removeMfaDevices('user-uuid', 'sms');
   * ```
   */

  /**
   * Remove a single MFA device by device ID (admin).
   *
   * @param deviceId - MFA device ID
   * @returns Removal result
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * const result = await client.admin.removeMfaDeviceById(123);
   * console.log(result.removedDeviceId);
   * ```
   */
  async removeMfaDeviceById(deviceId: number): Promise<RemoveMFADeviceResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.removeMfaDeviceById, { deviceId: String(deviceId) });
    return this.delete<RemoveMFADeviceResponse>(path);
  }

  /**
   * Set preferred MFA device for a user (admin operation).
   *
   * @param sub - User identifier
   * @param deviceId - Device ID to set as preferred
   * @returns Success message
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * await client.admin.setPreferredMfaDevice('user-uuid', 123);
   * ```
   */
  async setPreferredMfaDevice(sub: string, deviceId: number): Promise<{ message: string }> {
    const path = this.buildAdminUrl(this.adminEndpoints.setPreferredMfaDevice, { sub, deviceId: String(deviceId) });
    return this.post<{ message: string }>(path, {});
  }

  /**
   * Grant or revoke MFA exemption for a user
   *
   * @param sub - User UUID
   * @param exempt - True to exempt from MFA, false to require
   * @param reason - Optional reason for exemption
   * @returns Success message
   * @throws {NAuthClientError} If operation fails
   *
   * @example
   * ```typescript
   * await client.admin.setMfaExemption('user-uuid', true, 'Service account');
   * ```
   */
  async setMfaExemption(sub: string, exempt: boolean, reason?: string): Promise<{ message: string }> {
    const path = this.buildAdminUrl(this.adminEndpoints.setMfaExemption);
    return this.post<{ message: string }>(path, { sub, exempt, reason });
  }

  // ============================================================================
  // Audit
  // ============================================================================

  /**
   * Get audit history for a user
   *
   * @param params - Audit history request params
   * @returns Paginated audit events
   * @throws {NAuthClientError} If request fails
   *
   * @example
   * ```typescript
   * const history = await client.admin.getAuditHistory({
   *   sub: 'user-uuid',
   *   page: 1,
   *   limit: 50,
   *   eventType: 'LOGIN_SUCCESS',
   * });
   * ```
   */
  async getAuditHistory(params: AdminAuditHistoryRequest): Promise<AuditHistoryResponse> {
    const path = this.buildAdminUrl(this.adminEndpoints.getAuditHistory);
    const queryString = this.buildQueryString(params as unknown as Record<string, unknown>);
    return this.get<AuditHistoryResponse>(`${path}${queryString}`);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build admin endpoint URL with path parameter replacement
   *
   * Path construction order:
   * 1. Start with endpoint: '/users/:sub'
   * 2. Replace params: '/users/uuid-123'
   * 3. Apply adminPathPrefix: '/admin/users/uuid-123'
   * 4. Apply authPathPrefix if exists: '/auth/admin/users/uuid-123'
   * 5. Combine with baseUrl: 'https://api.example.com/auth/admin/users/uuid-123'
   *
   * @param endpointPath - Endpoint path (may contain :sub, :provider, etc.)
   * @param pathParams - Path parameters to replace
   * @returns Full URL
   * @private
   */
  private buildAdminUrl(endpointPath: string, pathParams?: Record<string, string>): string {
    let path = endpointPath;

    // Replace path parameters (e.g., :sub, :provider)
    if (pathParams) {
      Object.entries(pathParams).forEach(([key, value]) => {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      });
    }

    // Apply admin path prefix
    const prefix = this.adminPathPrefix.startsWith('/') ? this.adminPathPrefix : `/${this.adminPathPrefix}`;
    path = `${prefix}${path.startsWith('/') ? '' : '/'}${path}`;

    // Apply authPathPrefix if configured (e.g., '/auth')
    if (this.config.authPathPrefix) {
      const authPrefix = this.config.authPathPrefix.startsWith('/')
        ? this.config.authPathPrefix
        : `/${this.config.authPathPrefix}`;
      path = `${authPrefix}${path}`;
    }

    // Combine with baseUrl
    const normalizedBase = this.config.baseUrl.endsWith('/') ? this.config.baseUrl.slice(0, -1) : this.config.baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${normalizedBase}${normalizedPath}`;
  }

  /**
   * Build query string from params object
   *
   * Handles:
   * - Simple values (string, number, boolean)
   * - Arrays (multiple values for same key)
   * - Nested objects (e.g., createdAt[operator], createdAt[value])
   * - Dates (converted to ISO string)
   *
   * @param params - Query parameters
   * @returns Query string (e.g., '?page=1&limit=20')
   * @private
   */
  private buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();

    for (const [key, rawValue] of Object.entries(params)) {
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      // Handle arrays
      if (Array.isArray(rawValue)) {
        for (const item of rawValue) {
          searchParams.append(key, String(item));
        }
        continue;
      }

      // Handle nested objects (e.g., createdAt: { operator: 'gte', value: Date })
      if (typeof rawValue === 'object' && rawValue !== null && !(rawValue instanceof Date)) {
        const nestedObj = rawValue as Record<string, unknown>;
        for (const [nestedKey, nestedValue] of Object.entries(nestedObj)) {
          const nestedParamKey = `${key}[${nestedKey}]`;
          const valueToAppend = nestedValue instanceof Date ? nestedValue.toISOString() : String(nestedValue);
          searchParams.append(nestedParamKey, valueToAppend);
        }
        continue;
      }

      // Handle dates
      if (rawValue instanceof Date) {
        searchParams.append(key, rawValue.toISOString());
        continue;
      }

      // Handle simple values
      searchParams.append(key, String(rawValue));
    }

    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }

  /**
   * Build request headers for authentication
   *
   * @param auth - Whether to include authentication headers
   * @param method - HTTP method
   * @returns Headers object
   * @private
   */
  private async buildHeaders(
    auth: boolean,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...this.adminHeaders,
    };

    // Set Content-Type for mutating requests
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    // Add access token in JSON mode
    // In cookies mode, tokens are sent automatically via httpOnly cookies
    if (auth && this.config.tokenDelivery === 'json') {
      try {
        const ACCESS_TOKEN_KEY = 'nauth_access_token';
        const token = await this.config.storage.getItem(ACCESS_TOKEN_KEY);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Non-fatal: storage can fail in restricted environments
      }
    }

    // Add device token header in JSON mode
    // In cookies mode, device token is sent automatically via httpOnly cookie
    if (this.config.tokenDelivery === 'json') {
      try {
        const deviceToken = await this.config.storage.getItem(this.config.deviceTrust.storageKey);
        if (deviceToken) {
          headers[this.config.deviceTrust.headerName] = deviceToken;
        }
      } catch {
        // Non-fatal: storage can fail in restricted environments
      }
    }

    // Add CSRF header in cookies mode for mutating requests
    const mutatingMethods: readonly ('POST' | 'PUT' | 'PATCH' | 'DELETE')[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (
      this.config.tokenDelivery === 'cookies' &&
      hasWindow() &&
      (mutatingMethods as readonly string[]).includes(method)
    ) {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        headers[this.config.csrf.headerName] = csrfToken;
      }
    }

    return headers;
  }

  /**
   * Get CSRF token from cookie (browser only)
   *
   * @returns CSRF token or null
   * @private
   */
  private getCsrfToken(): string | null {
    if (!hasWindow() || typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${this.config.csrf.cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  }

  /**
   * Execute GET request
   *
   * @param path - Full URL path
   * @returns Response data
   * @private
   */
  private async get<T>(path: string): Promise<T> {
    const headers = await this.buildHeaders(true, 'GET');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    try {
      const response = await this.config.httpAdapter.request<T>({
        method: 'GET',
        url: path,
        headers,
        credentials,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute POST request
   *
   * @param path - Full URL path
   * @param body - Request body
   * @returns Response data
   * @private
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.buildHeaders(true, 'POST');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    try {
      const response = await this.config.httpAdapter.request<T>({
        method: 'POST',
        url: path,
        headers,
        body,
        credentials,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute DELETE request
   *
   * @param path - Full URL path
   * @returns Response data
   * @private
   */
  private async delete<T>(path: string): Promise<T> {
    const headers = await this.buildHeaders(true, 'DELETE');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    try {
      const response = await this.config.httpAdapter.request<T>({
        method: 'DELETE',
        url: path,
        headers,
        credentials,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle HTTP errors and convert to NAuthClientError
   *
   * @param error - Error from HTTP adapter
   * @returns NAuthClientError
   * @private
   */
  private handleError(error: unknown): NAuthClientError {
    if (error instanceof NAuthClientError) {
      return error;
    }

    // Try to extract error info from adapter response
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { status?: number; data?: unknown } };
      const status = httpError.response?.status ?? 500;
      const errorData =
        typeof httpError.response?.data === 'object' && httpError.response.data !== null
          ? (httpError.response.data as Record<string, unknown>)
          : {};

      const code =
        typeof errorData['code'] === 'string' ? (errorData['code'] as NAuthErrorCode) : NAuthErrorCode.INTERNAL_ERROR;
      const message =
        typeof errorData['message'] === 'string'
          ? (errorData['message'] as string)
          : `Request failed with status ${status}`;

      return new NAuthClientError(code, message, {
        statusCode: status,
        details: errorData,
      });
    }

    return new NAuthClientError(
      NAuthErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
