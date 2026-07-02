import { resolveConfig, ResolvedNAuthClientConfig } from './config';
import { TokenManager } from './refresh';
import { BrowserStorage } from '../storage/browser';
import { InMemoryStorage } from '../storage/memory';
import type { NAuthStorageAdapter } from '../storage/interface';
import { EventEmitter, AuthEventType, AuthEventListener } from './events';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';
import { FetchAdapter } from '../adapters/fetch-adapter';
import {
  AuthChallenge,
  ChallengeResponse,
  GetChallengeDataRequest,
  GetSetupDataRequest,
  LoginRequest,
  LogoutAllRequest,
  AuthResponse,
  ResendCodeRequest,
  SignupRequest,
  TokenResponse,
  MFACodeResponse,
  MFAPasskeyResponse,
} from '../types/auth.types';
import { NAuthClientConfig } from '../types/config.types';
import {
  GetChallengeDataResponse,
  GetSetupDataResponse,
  GetMFADevicesResponse,
  MFAStatus,
  RemoveMFADeviceResponse,
} from '../types/mfa.types';
import { AuditHistoryResponse } from '../types/audit.types';
import { LinkedAccountsResponse, SocialLoginOptions, SocialVerifyRequest, SocialProvider } from '../types/social.types';
import {
  AuthUser,
  ChangePasswordRequest,
  ConfirmForgotPasswordRequest,
  ConfirmForgotPasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordWithCodeRequest,
  ResetPasswordWithCodeResponse,
  UpdateProfileRequest,
} from '../types/user.types';
import { ChallengeRouter } from './challenge-router';
import { AdminOperations } from './admin-operations';
import { ApiKeyOperations } from './api-key-operations';

const USER_KEY = 'nauth_user';
const CHALLENGE_KEY = 'nauth_challenge_session';
const OAUTH_STATE_KEY = 'nauth_oauth_state';
const hasWindow = (): boolean =>
  typeof globalThis !== 'undefined' && typeof (globalThis as { window?: unknown }).window !== 'undefined';

/**
 * Get sessionStorage-based storage for ephemeral OAuth state.
 * Falls back to main storage if sessionStorage is unavailable.
 */
const getOauthStorage = (mainStorage: NAuthStorageAdapter): NAuthStorageAdapter => {
  if (hasWindow() && typeof window.sessionStorage !== 'undefined') {
    return new BrowserStorage(window.sessionStorage);
  }
  // Fallback to main storage (memory storage in SSR, localStorage in browser without sessionStorage)
  return mainStorage;
};

/**
 * Choose default storage implementation.
 */
const defaultStorage = () => {
  if (hasWindow() && typeof window.localStorage !== 'undefined') {
    return new BrowserStorage();
  }
  return new InMemoryStorage();
};

/**
 * Primary client for interacting with nauth-toolkit backend.
 */
export class NAuthClient {
  private readonly config: ResolvedNAuthClientConfig;
  private readonly tokenManager: TokenManager;
  private readonly eventEmitter: EventEmitter;
  private readonly challengeRouter: ChallengeRouter;
  private readonly oauthStorage: NAuthStorageAdapter;
  private currentUser: AuthUser | null = null;

  /**
   * Internally tracked MFA device ID
   * When user selects a specific device (e.g., "Microsoft Authenticator" vs "Google Authenticator"),
   * SDK stores it here and auto-injects into respondToChallenge()
   */
  private selectedDeviceId?: number;

  /**
   * Admin operations (available if admin config provided).
   *
   * Provides admin-level user management methods:
   * - User CRUD operations
   * - Password management
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
   *     pathPrefix: '/admin',
   *   },
   * });
   *
   * // Use admin operations
   * const users = await client.admin.getUsers({ page: 1 });
   * await client.admin.deleteUser('user-uuid');
   * ```
   */
  public readonly admin?: AdminOperations;

  /**
   * API key management operations (create/list/update/revoke/delete).
   *
   * Calls your backend's API-key endpoints (default base path `{baseUrl}/api-keys`).
   *
   * @example
   * ```typescript
   * const { key } = await client.apiKeys.create({ expiresInDays: 90, allowedIps: ['203.0.113.0/24'] });
   * const keys = await client.apiKeys.list();
   * await client.apiKeys.update(keyId, { allowedIps: ['203.0.113.5'] });
   * await client.apiKeys.revoke(keyId);
   * ```
   */
  public readonly apiKeys: ApiKeyOperations;

  /**
   * Create a new client instance.
   *
   * @param userConfig - Client configuration
   */
  constructor(userConfig: NAuthClientConfig) {
    const storage = userConfig.storage ?? defaultStorage();
    const defaultAdapter = userConfig.httpAdapter ?? new FetchAdapter();
    this.config = resolveConfig({ ...userConfig, storage }, defaultAdapter);
    this.tokenManager = new TokenManager(storage);
    this.eventEmitter = new EventEmitter();
    this.oauthStorage = getOauthStorage(storage);
    this.challengeRouter = new ChallengeRouter(this.config, this.oauthStorage);

    // Initialize admin operations if configured
    if (this.config.admin) {
      this.admin = new AdminOperations(this.config);
    }

    // API key operations (endpoints default to `{baseUrl}/api-keys`)
    this.apiKeys = new ApiKeyOperations(this.config);

    if (hasWindow()) {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (hasWindow()) {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
  }

  /**
   * Login with identifier and password.
   *
   * @param identifier - Username or email
   * @param password - User password
   * @param recaptchaToken - Optional reCAPTCHA token for bot protection
   *
   * @example Basic login
   * ```typescript
   * const response = await client.login('user@example.com', 'password123');
   * ```
   *
   * @example With reCAPTCHA
   * ```typescript
   * const token = await grecaptcha.execute(siteKey, { action: 'login' });
   * const response = await client.login('user@example.com', 'password123', token);
   * ```
   */
  async login(identifier: string, password: string, recaptchaToken?: string): Promise<AuthResponse> {
    const loginEvent = { type: 'auth:login' as const, data: { identifier }, timestamp: Date.now() };
    this.eventEmitter.emit(loginEvent);

    try {
      const body: LoginRequest = { identifier, password, recaptchaToken };
      const response = await this.post<AuthResponse>(this.config.endpoints.login, body);
      await this.handleAuthResponse(response);

      // Emit success or challenge event
      if (response.challengeName) {
        const challengeEvent = { type: 'auth:challenge' as const, data: response, timestamp: Date.now() };
        this.eventEmitter.emit(challengeEvent);
      } else {
        const successEvent = { type: 'auth:success' as const, data: response, timestamp: Date.now() };
        this.eventEmitter.emit(successEvent);
      }

      // Auto-handle navigation
      await this.challengeRouter.handleAuthResponse(response, { source: 'login' });

      return response;
    } catch (error) {
      const authError =
        error instanceof NAuthClientError
          ? error
          : new NAuthClientError(NAuthErrorCode.AUTH_INVALID_CREDENTIALS, (error as Error).message || 'Login failed');
      const errorEvent = { type: 'auth:error' as const, data: authError, timestamp: Date.now() };
      this.eventEmitter.emit(errorEvent);
      throw authError;
    }
  }

  /**
   * Signup with credentials.
   */
  async signup(payload: SignupRequest): Promise<AuthResponse> {
    this.eventEmitter.emit({ type: 'auth:signup', data: { email: payload.email }, timestamp: Date.now() });

    try {
      const response = await this.post<AuthResponse>(this.config.endpoints.signup, payload);
      await this.handleAuthResponse(response);

      // Emit success or challenge event
      if (response.challengeName) {
        this.eventEmitter.emit({ type: 'auth:challenge', data: response, timestamp: Date.now() });
      } else {
        this.eventEmitter.emit({ type: 'auth:success', data: response, timestamp: Date.now() });
      }

      // Auto-handle navigation
      await this.challengeRouter.handleAuthResponse(response, { source: 'signup' });

      return response;
    } catch (error) {
      const authError =
        error instanceof NAuthClientError
          ? error
          : new NAuthClientError(NAuthErrorCode.AUTH_INVALID_CREDENTIALS, (error as Error).message || 'Signup failed');
      this.eventEmitter.emit({ type: 'auth:error', data: authError, timestamp: Date.now() });
      throw authError;
    }
  }

  /**
   * Refresh tokens manually.
   *
   * @throws {NAuthClientError} When refresh fails (e.g., session expired)
   *
   * @example
   * ```typescript
   * try {
   *   await client.refreshTokens();
   * } catch (error) {
   *   // Session expired - user is already logged out automatically
   *   router.navigate(['/login']);
   * }
   * ```
   */
  async refreshTokens(): Promise<TokenResponse> {
    const tokenDelivery = this.getTokenDeliveryMode();

    // Only check for refresh token in localStorage for JSON mode
    // In cookies mode, refresh token is in httpOnly cookie (backend manages it)
    if (tokenDelivery === 'json') {
      await this.tokenManager.assertHasRefreshToken();
    }

    // In cookies mode, the refresh token is in the httpOnly cookie -- no need to send it in the body.
    // Sending an empty string is misleading and can confuse backend validation.
    const body = tokenDelivery === 'json' ? { refreshToken: (await this.tokenManager.getTokens()).refreshToken } : {};
    const refreshFn = async () => {
      // In cookies mode, refresh token is sent via httpOnly cookie (no access token needed, auth=false)
      // In JSON mode, refresh token is in body (no access token needed, auth=false)
      // Refresh endpoint is PUBLIC - it doesn't need an access token
      return this.post<TokenResponse>(this.config.endpoints.refresh, body, false);
    };

    try {
      // Cookies mode MUST NEVER persist tokens to storage, even if a misconfigured backend
      // accidentally returns tokens in the response body (security footgun).
      const tokens = await this.tokenManager.refreshOnce(refreshFn, { persist: tokenDelivery === 'json' });
      this.config.onTokenRefresh?.();
      this.eventEmitter.emit({ type: 'auth:refresh', data: { success: true }, timestamp: Date.now() });
      return tokens;
    } catch (error) {
      // Handle session expiration (401 error)
      // Clear local auth state to prevent isAuthenticated() from returning true with stale data
      if (error instanceof NAuthClientError && error.statusCode === 401) {
        await this.clearLocalAuthState();
        this.config.onSessionExpired?.();
        this.eventEmitter.emit({ type: 'auth:session_expired', data: {}, timestamp: Date.now() });
      }
      throw error;
    }
  }

  // ============================================================================
  // Local state management (no network)
  // ============================================================================

  /**
   * Clear all local auth state without making any network requests.
   *
   * WHY:
   * - When refresh fails with 401 (session expired), clients should immediately drop any cached
   *   auth state (user + tokens) to prevent "sticky auth" across hard reloads.
   * - In cookie delivery modes, httpOnly cookies can only be cleared by the backend; this method
   *   only clears client-side state (e.g., cached user + persisted tokens in JSON mode).
   *
   * IMPORTANT: Also clears any pending challenge sessions to prevent ghost states where the UI
   * shows a challenge screen but the backend session is invalid.
   *
   * @param options - Optional behavior flags
   * @returns Promise that resolves when local state is cleared
   *
   * @example
   * ```typescript
   * // Called by framework adapters/interceptors when refresh fails with 401
   * await client.clearLocalAuthState();
   * ```
   */
  async clearLocalAuthState(options?: { forgetDevice?: boolean }): Promise<void> {
    await this.clearAuthState(options?.forgetDevice ?? false);
    // ============================================================================
    // IMPORTANT: Clear challenge session to prevent ghost states
    // ============================================================================
    // WHY: If a user's session expires while they have a pending challenge (MFA, email verification, etc.),
    // the challenge session token becomes invalid. We must clear it to prevent the UI from showing
    // challenge screens that will fail. This fixes the "ghost session" issue where users get stuck
    // in challenge flows with stale auth data.
    await this.clearChallenge();
  }

  /**
   * Logout current session.
   *
   * Uses GET request to avoid CSRF token issues.
   *
   * @param forgetDevice - If true, also untrust the device (require MFA on next login)
   */
  async logout(forgetDevice?: boolean): Promise<void> {
    const queryParams = forgetDevice ? '?forgetMe=true' : '';
    try {
      await this.get(this.config.endpoints.logout + queryParams, true);
    } catch (error) {
      // Ignore logout errors (session might already be invalid)
      console.warn('[nauth] Logout request failed (session may already be invalid):', error);
    } finally {
      // Always clear local state even if request fails
      // Pass forgetDevice flag to clear device token in JSON mode
      await this.clearAuthState(forgetDevice);
      // Also clear any pending challenge sessions
      await this.clearChallenge();
      this.eventEmitter.emit({
        type: 'auth:logout',
        data: { forgetDevice: !!forgetDevice, global: false },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Logout all sessions.
   *
   * Revokes all active sessions for the current user across all devices.
   * Optionally revokes all trusted devices if forgetDevices is true.
   *
   * @param forgetDevices - If true, also revokes all trusted devices (default: false)
   * @returns Number of sessions revoked
   */
  async logoutAll(forgetDevices?: boolean): Promise<{ revokedCount: number }> {
    try {
      const payload: LogoutAllRequest = {
        forgetDevices: forgetDevices ?? false,
      };
      const result = await this.post<{ message: string; revokedCount: number }>(
        this.config.endpoints.logoutAll,
        payload,
        true,
      );
      // Clear device token in JSON mode if forgetDevices is true
      await this.clearAuthState(forgetDevices);
      // Also clear any pending challenge sessions
      await this.clearChallenge();
      this.eventEmitter.emit({
        type: 'auth:logout',
        data: { forgetDevice: !!forgetDevices, global: true },
        timestamp: Date.now(),
      });
      return { revokedCount: result.revokedCount };
    } catch (error) {
      // If request fails, still clear local state
      await this.clearAuthState(forgetDevices);
      // Also clear any pending challenge sessions
      await this.clearChallenge();
      this.eventEmitter.emit({
        type: 'auth:logout',
        data: { forgetDevice: !!forgetDevices, global: true },
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Respond to a challenge.
   *
   * Validates challenge response data before sending to backend.
   * Provides helpful error messages for common validation issues.
   *
   * @param response - Challenge response data
   * @returns Auth response from backend
   * @throws {NAuthClientError} If validation fails
   */
  async respondToChallenge(response: ChallengeResponse): Promise<AuthResponse> {
    // Auto-inject deviceId if SDK has one stored and this is MFA verification
    // This allows SDK to handle device selection internally - consumers don't need to pass deviceId
    if (
      this.selectedDeviceId !== undefined &&
      response.type === AuthChallenge.MFA_REQUIRED &&
      (response.method === 'totp' || response.method === 'passkey')
    ) {
      // TypeScript knows response is MFACodeResponse or MFAPasskeyResponse at this point
      // Both have deviceId?: number property, so we can safely assign it
      const mfaResponse = response as MFACodeResponse | MFAPasskeyResponse;
      mfaResponse.deviceId = this.selectedDeviceId;
    }

    // Validate TOTP setup requires both secret and code
    if (response.type === AuthChallenge.MFA_SETUP_REQUIRED && response.method === 'totp') {
      const setupData = response.setupData;
      if (!setupData || typeof setupData !== 'object') {
        throw new NAuthClientError(
          NAuthErrorCode.VALIDATION_FAILED,
          'TOTP setup requires setupData with both secret and code',
          { details: { field: 'setupData' } },
        );
      }

      const secret = setupData['secret'];
      const code = setupData['code'];

      if (!secret || typeof secret !== 'string') {
        throw new NAuthClientError(
          NAuthErrorCode.VALIDATION_FAILED,
          'TOTP setup requires secret in setupData. Make sure to include the secret from getSetupData() response.',
          { details: { field: 'secret' } },
        );
      }

      if (!code || typeof code !== 'string') {
        throw new NAuthClientError(
          NAuthErrorCode.VALIDATION_FAILED,
          'TOTP setup requires code in setupData. Please enter the verification code from your authenticator app.',
          { details: { field: 'code' } },
        );
      }
    }

    try {
      const result = await this.post<AuthResponse>(this.config.endpoints.respondChallenge, response);
      await this.handleAuthResponse(result);

      // Clear selected device on successful authentication (no more challenges)
      if (result.user && !result.challengeName) {
        this.selectedDeviceId = undefined;
      }

      // Emit success or challenge event
      if (result.challengeName) {
        const challengeEvent = { type: 'auth:challenge' as const, data: result, timestamp: Date.now() };
        this.eventEmitter.emit(challengeEvent);
      } else {
        const successEvent = { type: 'auth:success' as const, data: result, timestamp: Date.now() };
        this.eventEmitter.emit(successEvent);
      }

      // Auto-handle navigation
      await this.challengeRouter.handleAuthResponse(result, { source: 'challenge' });

      return result;
    } catch (error) {
      const authError =
        error instanceof NAuthClientError
          ? error
          : new NAuthClientError(
              NAuthErrorCode.CHALLENGE_INVALID,
              (error as Error).message || 'Challenge response failed',
            );
      const errorEvent = { type: 'auth:error' as const, data: authError, timestamp: Date.now() };
      this.eventEmitter.emit(errorEvent);
      throw authError;
    }
  }

  /**
   * Select an MFA device for verification
   *
   * Call this when user selects a specific device from the MFA selector UI.
   * SDK stores the deviceId internally and auto-injects it when respondToChallenge() is called.
   *
   * @param deviceId - ID of the device user selected
   *
   * @example
   * ```typescript
   * // User clicks "Microsoft Authenticator" button
   * client.selectMFADevice(48);
   *
   * // Later, when submitting OTP code:
   * await client.respondToChallenge({
   *   type: 'MFA_REQUIRED',
   *   session: 'abc123',
   *   method: 'totp',
   *   code: '123456',
   *   // SDK auto-injects deviceId=48 here!
   * });
   * ```
   */
  selectMFADevice(deviceId: number): void {
    this.selectedDeviceId = deviceId;
  }

  /**
   * Get available MFA devices from challenge response
   *
   * Returns array of devices for methods that support multiple devices (TOTP, Passkey).
   * Use this to render device selection UI only.
   *
   * @param challenge - Challenge response from login/signup
   * @returns Array of MFA devices with id, name, and type
   *
   * @example
   * ```typescript
   * const devices = client.getMFADevices(challengeResponse);
   * // Returns: [
   * //   { id: 48, name: "Microsoft Authenticator", type: "totp" },
   * //   { id: 3, name: "Google Authenticator", type: "totp" }
   * // ]
   * ```
   */
  getMFADevices(challenge: AuthResponse): Array<{ id: number; name: string; type: string }> {
    const devices = challenge.challengeParameters?.['devices'];
    if (Array.isArray(devices)) {
      return devices as Array<{ id: number; name: string; type: string }>;
    }
    return [];
  }

  /**
   * Clear any selected MFA device
   *
   * Useful if user navigates back to device selector or cancels MFA flow.
   */
  clearSelectedDevice(): void {
    this.selectedDeviceId = undefined;
  }

  /**
   * Resend a challenge code.
   */
  async resendCode(session: string): Promise<{ destination: string }> {
    const payload: ResendCodeRequest = { session };
    return this.post<{ destination: string }>(this.config.endpoints.resendCode, payload);
  }

  /**
   * Get setup data for MFA.
   *
   * Returns method-specific setup information:
   * - TOTP: { secret, qrCode, manualEntryKey }
   * - SMS: { maskedPhone }
   * - Email: { maskedEmail }
   * - Passkey: WebAuthn registration options
   *
   * @param session - Challenge session token
   * @param method - MFA method to set up
   * @returns Setup data wrapped in GetSetupDataResponse
   */
  async getSetupData(session: string, method: GetSetupDataRequest['method']): Promise<GetSetupDataResponse> {
    const payload: GetSetupDataRequest = { session, method };
    return this.post<GetSetupDataResponse>(this.config.endpoints.getSetupData, payload);
  }

  /**
   * Get challenge data (e.g., WebAuthn options).
   *
   * Returns challenge-specific data for verification flows.
   *
   * @param session - Challenge session token
   * @param method - Challenge method to get data for
   * @returns Challenge data wrapped in GetChallengeDataResponse
   */
  async getChallengeData(
    session: string,
    method: GetChallengeDataRequest['method'],
  ): Promise<GetChallengeDataResponse> {
    const payload: GetChallengeDataRequest = { session, method };
    return this.post<GetChallengeDataResponse>(this.config.endpoints.getChallengeData, payload);
  }

  /**
   * Get current user profile.
   */
  async getProfile(): Promise<AuthUser> {
    const profile = await this.get<AuthUser>(this.config.endpoints.profile, true);
    await this.setUser(profile);
    return profile;
  }

  /**
   * Update user profile.
   */
  async updateProfile(updates: UpdateProfileRequest): Promise<AuthUser> {
    const updated = await this.put<AuthUser>(this.config.endpoints.updateProfile, updates, true);
    await this.setUser(updated);
    return updated;
  }

  /**
   * Change user password.
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const payload: ChangePasswordRequest = { oldPassword, newPassword };
    await this.post(this.config.endpoints.changePassword, payload, true);
  }

  /**
   * Request a password reset code (forgot password).
   */
  async forgotPassword(identifier: string): Promise<ForgotPasswordResponse> {
    const payload: ForgotPasswordRequest = { identifier };
    return this.post<ForgotPasswordResponse>(this.config.endpoints.forgotPassword, payload);
  }

  /**
   * Confirm a password reset code and set a new password.
   */
  async confirmForgotPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<ConfirmForgotPasswordResponse> {
    const payload: ConfirmForgotPasswordRequest = { identifier, code, newPassword };
    const result = await this.post<ConfirmForgotPasswordResponse>(this.config.endpoints.confirmForgotPassword, payload);
    // ============================================================================
    // IMPORTANT: Password reset revokes all sessions
    // ============================================================================
    // WHY: The backend invalidates all sessions as a security measure. Clearing local auth state avoids
    // stale UI (e.g., still showing social-only/no-password state from cached user) and prevents the
    // client from attempting further authenticated calls with invalid tokens/cookies.
    await this.clearAuthState(false);
    return result;
  }

  /**
   * Reset password with verification code (works for both admin-initiated and user-initiated resets).
   *
   * NOTE:
   * - Links (when provided by the backend email provider) include the same verification code as a query param
   *   (e.g., `...?code=123456`) so consumer apps stay code-only and consistent.
   *
   * WHY: Generic method that works for both admin-initiated (adminResetPassword) and
   * user-initiated (forgotPassword) password resets. Uses same backend endpoint.
   *
   * @param identifier - User identifier (email, username, phone)
   * @param code - Verification code from email/SMS (6-10 digits)
   * @param newPassword - New password
   * @returns Success response
   * @throws {NAuthClientError} When reset fails
   *
   * @example
   * ```typescript
   * await client.resetPasswordWithCode('user@example.com', '123456', 'NewPass123!');
   * ```
   */
  async resetPasswordWithCode(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<ResetPasswordWithCodeResponse> {
    const payload: ResetPasswordWithCodeRequest = {
      identifier,
      code,
      newPassword,
    };

    const result = await this.post<ResetPasswordWithCodeResponse>(
      this.config.endpoints.confirmAdminResetPassword,
      payload,
    );

    // ============================================================================
    // IMPORTANT: Password reset revokes all sessions
    // ============================================================================
    // WHY: The backend invalidates all sessions as a security measure. Clearing local auth state avoids
    // stale UI (e.g., still showing social-only/no-password state from cached user) and prevents the
    // client from attempting further authenticated calls with invalid tokens/cookies.
    await this.clearAuthState(false);

    return result;
  }

  /**
   * Get MFA status for current user.
   *
   * @returns Promise of MFA status
   *
   * @example
   * ```typescript
   * const status = await this.client.getMfaStatus();
   * console.log('MFA enabled:', status.enabled);
   * ```
   */
  async getMfaStatus(): Promise<MFAStatus> {
    return this.get<MFAStatus>(this.config.endpoints.mfaStatus, true);
  }

  /**
   * Get MFA devices.
   *
   * @returns Promise of MFA devices response
   *
   * @example
   * ```typescript
   * const result = await client.getMfaDevices();
   * console.log('Devices:', result.devices);
   * ```
   */
  async getMfaDevices(): Promise<GetMFADevicesResponse> {
    return this.get<GetMFADevicesResponse>(this.config.endpoints.mfaDevices, true);
  }

  /**
   * Setup MFA device (authenticated user).
   *
   * Returns method-specific setup information:
   * - TOTP: { secret, qrCode, manualEntryKey }
   * - SMS: { maskedPhone } or { deviceId, autoCompleted: true }
   * - Email: { maskedEmail } or { deviceId, autoCompleted: true }
   * - Passkey: WebAuthn registration options
   *
   * @param method - MFA method to set up
   * @returns Promise of setup data response
   *
   * @example
   * ```typescript
   * const result = await client.setupMfaDevice('totp');
   * console.log('QR Code:', result.setupData.qrCode);
   * ```
   */
  async setupMfaDevice(method: string): Promise<GetSetupDataResponse> {
    // Backend expects `methodName` (SetupMFADTO). We keep the public SDK method name `method`
    // for ergonomics, but serialize as `methodName` to match the API contract.
    return this.post<GetSetupDataResponse>(this.config.endpoints.mfaSetupData, { methodName: method }, true);
  }

  /**
   * Verify MFA setup (authenticated user).
   *
   * Completes MFA device setup by verifying the setup data. The structure of `setupData` varies by method:
   *
   * **TOTP:**
   * - Requires both `secret` (from `getSetupData()` response) and `code` (from authenticator app)
   * - Example: `{ secret: 'JBSWY3DPEHPK3PXP', code: '123456' }`
   *
   * **SMS:**
   * - Requires `phoneNumber` and `code` (verification code sent to phone)
   * - Example: `{ phoneNumber: '+1234567890', code: '123456' }`
   *
   * **Email:**
   * - Requires `code` (verification code sent to email)
   * - Example: `{ code: '123456' }`
   *
   * **Passkey:**
   * - Requires `credential` (WebAuthn credential from registration) and `expectedChallenge`
   * - Example: `{ credential: {...}, expectedChallenge: '...' }`
   *
   * @param method - MFA method ('totp', 'sms', 'email', 'passkey')
   * @param setupData - Method-specific setup verification data
   * @param deviceName - Optional device name (can also be included in setupData for some methods)
   * @returns Promise with device ID of the created MFA device
   *
   * @example TOTP Setup
   * ```typescript
   * // Step 1: Get setup data
   * const setupData = await client.setupMfaDevice('totp');
   * // Returns: { setupData: { secret: 'JBSWY3DPEHPK3PXP', qrCode: '...', ... } }
   *
   * // Step 2: User scans QR code and enters code from authenticator app
   * const code = '123456'; // From authenticator app
   *
   * // Step 3: Verify setup (requires both secret and code)
   * const result = await client.verifyMfaSetup('totp', {
   *   secret: setupData.setupData.secret,
   *   code: code,
   * }, 'Google Authenticator');
   * // Returns: { deviceId: 123 }
   * ```
   *
   * @example SMS Setup
   * ```typescript
   * const result = await client.verifyMfaSetup('sms', {
   *   phoneNumber: '+1234567890', // Phone number receiving the code
   *   code: '123456', // Code sent to phone
   * }, 'My iPhone');
   * ```
   *
   * @example Passkey Setup
   * ```typescript
   * const credential = await navigator.credentials.create({
   *   publicKey: setupData.setupData.options
   * });
   * const result = await client.verifyMfaSetup('passkey', {
   *   credential: credential,
   *   expectedChallenge: setupData.setupData.challenge,
   * }, 'MacBook Pro');
   * ```
   */
  async verifyMfaSetup(
    method: string,
    setupData: Record<string, unknown>,
    deviceName?: string,
  ): Promise<{ deviceId: number }> {
    return this.post<{ deviceId: number }>(
      this.config.endpoints.mfaVerifySetup,
      // Backend expects `methodName` (SetupMFADTO). `deviceName` is optional and may be ignored
      // by consumer controllers depending on their DTO/validation strategy.
      { methodName: method, setupData, deviceName },
      true,
    );
  }

  /**
   * Remove ALL MFA devices for a specific method type.
   *
   * WARNING: This removes ALL devices of the specified method.
   * For example, if you have 3 TOTP devices, this will remove all 3.
   *
   * **Prefer `removeMfaDeviceById()`** to remove individual devices.
   *
   * @param method - MFA method type ('totp', 'sms', 'email', 'passkey')
   * @returns Success message
   *
   * @example
   * ```typescript
   * // Removes ALL TOTP devices (all authenticator apps)
   * await client.removeMfaDevice('totp');
   * ```
   */

  /**
   * Remove a single MFA device by device ID.
   *
   * @param deviceId - MFA device ID
   * @returns Removal response
   */
  async removeMfaDeviceById(deviceId: number): Promise<RemoveMFADeviceResponse> {
    const path = `${this.config.endpoints.mfaDevices}/${deviceId}`;
    return this.delete<RemoveMFADeviceResponse>(path, true);
  }

  /**
   * Set a specific MFA device as preferred.
   *
   * This marks the device as preferred and updates the user's preferred MFA method.
   *
   * @param deviceId - MFA device ID
   * @returns Success message
   */
  async setPreferredMfaDevice(deviceId: number): Promise<{ message: string }> {
    const path = `${this.config.endpoints.mfaDevices}/${deviceId}/preferred`;
    return this.post<{ message: string }>(path, {}, true);
  }

  /**
   * Generate backup codes.
   */
  async generateBackupCodes(): Promise<string[]> {
    const result = await this.post<{ codes: string[] }>(this.config.endpoints.mfaBackupCodes, {}, true);
    return result.codes;
  }

  /**
   * ============================================================================
   * Event System
   * ============================================================================
   */

  /**
   * Subscribe to authentication events.
   *
   * Emits events throughout the auth lifecycle for custom logic, analytics, or UI updates.
   *
   * @param event - Event type to listen for, or '*' for all events
   * @param listener - Callback function to handle the event
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * // Listen to successful authentication
   * const unsubscribe = client.on('auth:success', (event) => {
   *   console.log('User logged in:', event.data.user);
   *   analytics.track('login_success');
   * });
   *
   * // Listen to all events
   * client.on('*', (event) => {
   *   console.log('Auth event:', event.type, event.data);
   * });
   *
   * // Unsubscribe when done
   * unsubscribe();
   * ```
   */
  on(event: AuthEventType | '*', listener: AuthEventListener): () => void {
    return this.eventEmitter.on(event, listener);
  }

  /**
   * Unsubscribe from authentication events.
   *
   * @param event - Event type
   * @param listener - Callback function to remove
   */
  off(event: AuthEventType | '*', listener: AuthEventListener): void {
    this.eventEmitter.off(event, listener);
  }

  // ============================================================================
  // Social Authentication
  // ============================================================================

  /**
   * Start redirect-first social OAuth flow (web).
   *
   * This performs a browser navigation to:
   * `GET {baseUrl}/social/:provider/redirect?returnTo=...&appState=...`
   *
   * The backend:
   * - generates and stores CSRF state (cluster-safe)
   * - redirects the user to the provider
   * - completes OAuth on callback and sets cookies (or issues an exchange token)
   * - redirects back to `returnTo` with `appState` (and `exchangeToken` for json/hybrid)
   *
   * @param provider - OAuth provider ('google', 'apple', 'facebook')
   * @param options - Optional redirect options
   *
   * @example
   * ```typescript
   * await client.loginWithSocial('google', { returnTo: '/auth/callback', appState: '12345' });
   * ```
   */
  async loginWithSocial(provider: SocialProvider, options?: SocialLoginOptions): Promise<void> {
    // Emit event
    this.eventEmitter.emit({ type: 'oauth:started', data: { provider }, timestamp: Date.now() });

    if (hasWindow()) {
      const startPath = this.config.endpoints.socialRedirectStart.replace(':provider', provider);
      // Use buildUrl to ensure authPathPrefix is applied
      const fullUrl = this.buildUrl(startPath);
      const startUrl = new URL(fullUrl);

      const redirects = this.config.redirects;
      // Default returnTo to configured post-login success route (best-effort).
      // Consumers are expected to pass an explicit callback route (e.g. '/auth/callback').
      const returnTo = options?.returnTo ?? redirects?.loginSuccess ?? redirects?.success ?? '/';

      startUrl.searchParams.set('returnTo', returnTo);
      // Only include action when deviating from the default ('login').
      if (options?.action === 'link') {
        startUrl.searchParams.set('action', 'link');
      }
      if (typeof options?.appState === 'string' && options.appState.trim() !== '') {
        startUrl.searchParams.set('appState', options.appState);
      }

      // Serialize oauthParams as JSON string
      if (options?.oauthParams && Object.keys(options.oauthParams).length > 0) {
        startUrl.searchParams.set('oauthParams', JSON.stringify(options.oauthParams));
      }

      window.location.href = startUrl.toString();
    }
  }

  /**
   * Exchange an `exchangeToken` (from redirect callback URL) into an AuthResponse.
   *
   * Used for `tokenDelivery: 'json'` or hybrid flows where the backend redirects back
   * with `exchangeToken` instead of setting cookies.
   *
   * @param exchangeToken - One-time exchange token from the callback URL
   * @returns AuthResponse
   */
  async exchangeSocialRedirect(exchangeToken: string): Promise<AuthResponse> {
    const token = exchangeToken?.trim();
    if (!token) {
      throw new NAuthClientError(NAuthErrorCode.CHALLENGE_INVALID, 'Missing exchangeToken');
    }
    const result = await this.post<AuthResponse>(this.config.endpoints.socialExchange, { exchangeToken: token });
    await this.handleAuthResponse(result);

    // Read appState from sessionStorage WITHOUT clearing (consumer may want to retrieve it later via getLastOauthState())
    const appState = await this.oauthStorage.getItem(OAUTH_STATE_KEY);

    // Auto-handle navigation with appState in context
    await this.challengeRouter.handleAuthResponse(result, {
      source: 'social',
      appState: appState ?? undefined,
    });

    return result;
  }

  /**
   * Verify native social token (mobile).
   */
  async verifyNativeSocial(request: SocialVerifyRequest): Promise<AuthResponse> {
    try {
      const path = this.config.endpoints.socialVerify.replace(':provider', request.provider);
      const result = await this.post<AuthResponse>(path, request);
      await this.handleAuthResponse(result);

      // Emit success or challenge event
      if (result.challengeName) {
        const challengeEvent = { type: 'auth:challenge' as const, data: result, timestamp: Date.now() };
        this.eventEmitter.emit(challengeEvent);
      } else {
        const successEvent = { type: 'auth:success' as const, data: result, timestamp: Date.now() };
        this.eventEmitter.emit(successEvent);
      }

      return result;
    } catch (error) {
      const authError =
        error instanceof NAuthClientError
          ? error
          : new NAuthClientError(
              NAuthErrorCode.SOCIAL_TOKEN_INVALID,
              (error as Error).message || 'Social verification failed',
            );
      const errorEvent = { type: 'auth:error' as const, data: authError, timestamp: Date.now() };
      this.eventEmitter.emit(errorEvent);
      throw authError;
    }
  }

  /**
   * Get linked accounts.
   */
  async getLinkedAccounts(): Promise<LinkedAccountsResponse> {
    return this.get<LinkedAccountsResponse>(this.config.endpoints.socialLinked, true);
  }

  /**
   * Link social account.
   */
  async linkSocialAccount(provider: string, code: string, state: string): Promise<{ message: string }> {
    return this.post<{ message: string }>(this.config.endpoints.socialLink, { provider, code, state }, true);
  }

  /**
   * Unlink social account.
   */
  async unlinkSocialAccount(provider: string): Promise<{ message: string }> {
    return this.post<{ message: string }>(this.config.endpoints.socialUnlink, { provider }, true);
  }

  /**
   * Trust current device.
   */
  async trustDevice(): Promise<{ deviceToken: string }> {
    const result = await this.post<{ deviceToken: string }>(this.config.endpoints.trustDevice, {}, true);

    // Only store device token in JSON mode (cookies mode uses httpOnly cookie)
    if (this.config.tokenDelivery === 'json' && result.deviceToken) {
      await this.setDeviceToken(result.deviceToken);
    }

    return result;
  }

  /**
   * Check if the current device is trusted.
   *
   * Returns whether the current device is trusted based on the device token
   * (from cookie in cookies mode, or header in JSON mode).
   *
   * This performs a server-side validation of the device token and checks:
   * - Device token exists and is valid
   * - Device token matches a trusted device record in the database
   * - Trust has not expired
   *
   * @returns Object with trusted status
   *
   * @example
   * ```typescript
   * const result = await client.isTrustedDevice();
   * if (result.trusted) {
   *   console.log('This device is trusted');
   * }
   * ```
   */
  async isTrustedDevice(): Promise<{ trusted: boolean }> {
    return this.get<{ trusted: boolean }>(this.config.endpoints.isTrustedDevice, true);
  }

  /**
   * Get authentication audit history for current user.
   *
   * @param params - Optional query parameters (page, limit, eventType, etc.)
   * @returns Paginated audit history
   *
   * @example
   * ```typescript
   * const history = await client.getAuditHistory({
   *   page: 1,
   *   limit: 20,
   *   eventTypes: ['LOGIN_SUCCESS'],
   *   eventStatus: ['FAILURE'],
   * });
   * ```
   */
  async getAuditHistory(
    params?: Record<string, string | number | boolean | Array<string | number | boolean>>,
  ): Promise<AuditHistoryResponse> {
    const searchParams = new URLSearchParams();

    for (const [key, rawValue] of Object.entries(params ?? {})) {
      if (Array.isArray(rawValue)) {
        for (const item of rawValue) {
          searchParams.append(key, String(item));
        }
        continue;
      }

      searchParams.append(key, String(rawValue));
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const path = `${this.config.endpoints.auditHistory}${query}`;
    return this.get<AuditHistoryResponse>(path, true);
  }

  /**
   * Initialize client by hydrating state from storage.
   * Call this on app startup to restore auth state.
   */
  async initialize(): Promise<void> {
    const userJson = await this.config.storage.getItem(USER_KEY);
    if (userJson) {
      try {
        this.currentUser = JSON.parse(userJson) as AuthUser;
        this.config.onAuthStateChange?.(this.currentUser);
      } catch {
        // Invalid stored user - clear it
        await this.config.storage.removeItem(USER_KEY);
      }
    }
  }

  /**
   * Determine if user is authenticated (async - checks tokens).
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.tokenManager.getTokens();
    return Boolean(tokens.accessToken);
  }

  /**
   * Determine if user is authenticated (sync - checks cached user).
   * Use this for guards and sync checks. Use `isAuthenticated()` for definitive check.
   */
  isAuthenticatedSync(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Get current access token (may be null).
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.tokenManager.getTokens();
    return tokens.accessToken ?? null;
  }

  /**
   * Get current user (cached, sync).
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Get stored challenge session (for resuming challenge flows).
   */
  async getStoredChallenge(): Promise<AuthResponse | null> {
    const raw = await this.config.storage.getItem(CHALLENGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      return null;
    }
  }

  /**
   * Clear stored challenge session.
   */
  async clearStoredChallenge(): Promise<void> {
    await this.config.storage.removeItem(CHALLENGE_KEY);
  }

  /**
   * Internal: handle auth response (tokens or challenge).
   *
   * In cookies mode: Tokens are set as httpOnly cookies by backend, not stored in client storage.
   * In JSON mode: Tokens are stored in tokenManager for Authorization header.
   */
  private async handleAuthResponse(response: AuthResponse): Promise<void> {
    if (response.challengeName) {
      await this.persistChallenge(response);
      return;
    }

    // Only store tokens in JSON mode (cookies mode uses httpOnly cookies set by backend)
    if (this.config.tokenDelivery === 'json' && response.accessToken && response.refreshToken) {
      await this.tokenManager.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        accessTokenExpiresAt: response.accessTokenExpiresAt ?? 0,
        refreshTokenExpiresAt: response.refreshTokenExpiresAt ?? 0,
      });
    }

    // Device token handling (only for JSON mode - cookies mode uses httpOnly cookie)
    if (this.config.tokenDelivery === 'json' && response.deviceToken) {
      await this.setDeviceToken(response.deviceToken);
    }

    // Always store user info (needed for both modes)
    if (response.user) {
      const user = response.user as AuthUser;
      // WHY: Consumers often need to know if the current session was created via password
      // or via a specific social provider (google/apple/facebook).
      user.sessionAuthMethod = response.authMethod ?? null;
      await this.setUser(user);
    }

    await this.clearChallenge();
  }

  /**
   * Persist challenge state.
   */
  private async persistChallenge(challenge: AuthResponse): Promise<void> {
    await this.config.storage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
  }

  /**
   * Clear challenge state.
   */
  private async clearChallenge(): Promise<void> {
    await this.config.storage.removeItem(CHALLENGE_KEY);
  }

  /**
   * Persist user.
   */
  private async setUser(user: AuthUser): Promise<void> {
    this.currentUser = user;
    await this.config.storage.setItem(USER_KEY, JSON.stringify(user));
    this.config.onAuthStateChange?.(user);
  }

  /**
   * Clear all auth state.
   *
   * @param forgetDevice - If true, also clear device token (for JSON mode)
   */
  private async clearAuthState(forgetDevice?: boolean): Promise<void> {
    this.currentUser = null;
    await this.tokenManager.clearTokens();
    await this.config.storage.removeItem(USER_KEY);

    // Clear device token when forgetDevice is true
    if (forgetDevice) {
      // ============================================================================
      // Defensive cleanup: Always attempt to remove device token from localStorage
      // ============================================================================
      // WHY: In JSON mode, device token should be in localStorage and must be cleared.
      // In cookies mode, device token shouldn't be in localStorage, but we attempt cleanup
      // anyway as a defensive measure in case of bugs or mode switches.
      try {
        await this.config.storage.removeItem(this.config.deviceTrust.storageKey);
      } catch {
        // Non-fatal: storage can fail in restricted environments (private mode, SSR, etc.)
      }
    }

    // ============================================================================
    // Clear OAuth state to prevent stale appState from being reused
    // ============================================================================
    // WHY: If user logs out or session expires during/after OAuth flow, the stored appState
    // should be cleared to prevent it from being incorrectly applied to a future login.
    try {
      await this.oauthStorage.removeItem(OAUTH_STATE_KEY);
    } catch {
      // Non-fatal: OAuth state is in sessionStorage which might fail in restricted environments
    }

    this.config.onAuthStateChange?.(null);
  }

  /**
   * Persist device token (json mode mobile).
   */
  private async setDeviceToken(token: string): Promise<void> {
    await this.config.storage.setItem(this.config.deviceTrust.storageKey, token);
  }

  /**
   * Determine token delivery mode for this environment.
   */
  private getTokenDeliveryMode(): 'json' | 'cookies' {
    return this.config.tokenDelivery;
  }

  /**
   * Build request URL by combining baseUrl with path.
   * Automatically prepends authPathPrefix if configured and not already in path.
   * @private
   */
  private buildUrl(path: string): string {
    // Prepend authPathPrefix if configured and path doesn't already start with it
    // Ensure path starts with '/' for proper prefix concatenation
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const effectivePath =
      this.config.authPathPrefix && !normalizedPath.startsWith(this.config.authPathPrefix)
        ? `${this.config.authPathPrefix}${normalizedPath}`
        : normalizedPath;
    return `${this.config.baseUrl}${effectivePath}`;
  }

  /**
   * Build request headers for authentication.
   *
   * @param auth - Whether to include authentication headers
   * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @returns Headers object with auth, CSRF, and device trust headers
   * @private
   */
  private async buildHeaders(
    auth: boolean,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.config.headers,
    };

    // Set Content-Type for mutating requests
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    // Add access token in JSON mode
    if (auth && this.config.tokenDelivery === 'json') {
      const accessToken = (await this.tokenManager.getTokens()).accessToken;
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    // ============================================================================
    // Trusted Device Header (JSON mode)
    // ============================================================================
    // In cookies mode the device token is sent automatically via httpOnly cookie.
    // In JSON mode the backend expects the device token via a header (default: X-Device-Token).
    //
    // This is required for:
    // - Checking trust status (`isTrustedDevice`)
    // - Skipping MFA on future logins when a device is trusted
    //
    // We intentionally send it on all requests in JSON mode so the backend can
    // consistently associate requests with a trusted device when present.
    if (this.config.tokenDelivery === 'json') {
      try {
        const deviceToken = await this.config.storage.getItem(this.config.deviceTrust.storageKey);
        if (deviceToken) {
          headers[this.config.deviceTrust.headerName] = deviceToken;
        }
      } catch {
        // Non-fatal: storage can fail in restricted environments (private mode, SSR, etc.).
      }
    }

    // ============================================================================
    // CSRF Token (Cookies mode, mutating requests only)
    // ============================================================================
    // CSRF protection is required for mutating HTTP methods (POST, PUT, PATCH, DELETE)
    // to prevent cross-site request forgery attacks when using cookie-based auth.
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
   * Get CSRF token from cookie (browser only).
   * @private
   */
  private getCsrfToken(): string | null {
    if (!hasWindow() || typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${this.config.csrf.cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  }

  /**
   * Execute GET request.
   * Note: 401 refresh is handled by framework interceptors (Angular) or manually.
   */
  private async get<T>(path: string, auth = false): Promise<T> {
    const url = this.buildUrl(path);
    const headers = await this.buildHeaders(auth, 'GET');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    const response = await this.config.httpAdapter.request<T>({
      method: 'GET',
      url,
      headers,
      credentials,
    });
    return response.data;
  }

  /**
   * Execute POST request.
   * Note: 401 refresh is handled by framework interceptors (Angular) or manually.
   */
  private async post<T>(path: string, body: unknown, auth = false): Promise<T> {
    const url = this.buildUrl(path);
    const headers = await this.buildHeaders(auth, 'POST');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    const response = await this.config.httpAdapter.request<T>({
      method: 'POST',
      url,
      headers,
      body,
      credentials,
    });
    return response.data;
  }

  /**
   * Execute PUT request.
   * Note: 401 refresh is handled by framework interceptors (Angular) or manually.
   */
  private async put<T>(path: string, body: unknown, auth = false): Promise<T> {
    const url = this.buildUrl(path);
    const headers = await this.buildHeaders(auth, 'PUT');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    const response = await this.config.httpAdapter.request<T>({
      method: 'PUT',
      url,
      headers,
      body,
      credentials,
    });
    return response.data;
  }

  /**
   * Execute DELETE request.
   * Note: 401 refresh is handled by framework interceptors (Angular) or manually.
   */
  private async delete<T>(path: string, auth = false): Promise<T> {
    const url = this.buildUrl(path);
    const headers = await this.buildHeaders(auth, 'DELETE');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';

    const response = await this.config.httpAdapter.request<T>({
      method: 'DELETE',
      url,
      headers,
      credentials,
    });
    return response.data;
  }

  /**
   * Handle cross-tab storage updates.
   */
  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === 'nauth_sync') {
      // Best-effort reload of user state
      this.config.storage
        .getItem(USER_KEY)
        .then((value: string | null) => (value ? (JSON.parse(value) as AuthUser) : null))
        .then((user: AuthUser | null) => {
          this.currentUser = user;
          this.config.onAuthStateChange?.(user);
        })
        .catch(() => {
          // ignore
        });
    }
  };

  /**
   * Get challenge router for manual navigation control.
   * Useful for guards that need to handle errors or build custom URLs.
   *
   * @returns ChallengeRouter instance
   *
   * @example
   * ```typescript
   * const router = client.getChallengeRouter();
   * await router.navigateToError('oauth');
   * ```
   */
  getChallengeRouter(): ChallengeRouter {
    return this.challengeRouter;
  }

  /**
   * Store OAuth appState from social redirect callback.
   *
   * This is called automatically by the social redirect callback guard
   * when appState is present in the callback URL. The stored state can
   * be retrieved using getLastOauthState().
   *
   * Stores in sessionStorage (ephemeral) for better security.
   *
   * @param appState - OAuth appState value from callback URL
   *
   * @example
   * ```typescript
   * await client.storeOauthState('invite-code-123');
   * ```
   */
  async storeOauthState(appState: string): Promise<void> {
    if (appState && appState.trim() !== '') {
      await this.oauthStorage.setItem(OAUTH_STATE_KEY, appState);
    }
  }

  /**
   * Get the last OAuth appState from social redirect callback.
   *
   * Returns the appState that was stored during the most recent social
   * login redirect callback. This is useful for restoring UI state,
   * applying invite codes, or tracking referral information.
   *
   * The state is automatically cleared after retrieval to prevent reuse.
   * Stored in sessionStorage (ephemeral) for better security.
   *
   * @returns The stored appState, or null if none exists
   *
   * @example
   * ```typescript
   * const appState = await client.getLastOauthState();
   * if (appState) {
   *   // Apply invite code or restore UI state
   *   console.log('OAuth state:', appState);
   * }
   * ```
   */
  async getLastOauthState(): Promise<string | null> {
    const stored = await this.oauthStorage.getItem(OAUTH_STATE_KEY);
    if (stored) {
      // Clear after retrieval to prevent reuse
      await this.oauthStorage.removeItem(OAUTH_STATE_KEY);
      return stored;
    }
    return null;
  }
}
