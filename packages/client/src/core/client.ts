import { resolveConfig, ResolvedNAuthClientConfig } from './config';
import { TokenManager } from './refresh';
import { BrowserStorage } from '../storage/browser';
import { InMemoryStorage } from '../storage/memory';
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
} from '../types/auth.types';
import { NAuthClientConfig } from '../types/config.types';
import { GetChallengeDataResponse, GetSetupDataResponse, MFAStatus } from '../types/mfa.types';
import { LinkedAccountsResponse, SocialLoginOptions, SocialVerifyRequest, SocialProvider } from '../types/social.types';
import {
  AuthUser,
  ChangePasswordRequest,
  ConfirmForgotPasswordRequest,
  ConfirmForgotPasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  UpdateProfileRequest,
} from '../types/user.types';
import { AuditHistoryResponse } from '../types/audit.types';
import { ChallengeRouter } from './challenge-router';

const USER_KEY = 'nauth_user';
const CHALLENGE_KEY = 'nauth_challenge_session';
const hasWindow = (): boolean =>
  typeof globalThis !== 'undefined' && typeof (globalThis as { window?: unknown }).window !== 'undefined';

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
  private currentUser: AuthUser | null = null;

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
    this.challengeRouter = new ChallengeRouter(this.config);
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
   */
  async login(identifier: string, password: string): Promise<AuthResponse> {
    const loginEvent = { type: 'auth:login' as const, data: { identifier }, timestamp: Date.now() };
    this.eventEmitter.emit(loginEvent);

    try {
      const body: LoginRequest = { identifier, password };
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
   */
  async refreshTokens(): Promise<TokenResponse> {
    const tokenDelivery = this.getTokenDeliveryMode();

    // Only check for refresh token in localStorage for JSON mode
    // In cookies mode, refresh token is in httpOnly cookie (backend manages it)
    if (tokenDelivery === 'json') {
      await this.tokenManager.assertHasRefreshToken();
    }

    const body =
      tokenDelivery === 'json'
        ? { refreshToken: (await this.tokenManager.getTokens()).refreshToken }
        : { refreshToken: '' };
    const refreshFn = async () => {
      // In cookies mode, refresh token is sent via httpOnly cookie (no access token needed, auth=false)
      // In JSON mode, refresh token is in body (no access token needed, auth=false)
      // Refresh endpoint is PUBLIC - it doesn't need an access token
      return this.post<TokenResponse>(this.config.endpoints.refresh, body, false);
    };
    const tokens = await this.tokenManager.refreshOnce(refreshFn);
    this.config.onTokenRefresh?.();
    this.eventEmitter.emit({ type: 'auth:refresh', data: { success: true }, timestamp: Date.now() });
    return tokens;
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
      this.eventEmitter.emit({
        type: 'auth:logout',
        data: { forgetDevice: !!forgetDevices, global: true },
        timestamp: Date.now(),
      });
      return { revokedCount: result.revokedCount };
    } catch (error) {
      // If request fails, still clear local state
      await this.clearAuthState(forgetDevices);
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
    const payload: ChangePasswordRequest = { currentPassword: oldPassword, newPassword };
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
   * Request password change (must change on next login).
   */
  async requestPasswordChange(): Promise<void> {
    await this.post(this.config.endpoints.requestPasswordChange, {}, true);
  }

  /**
   * Get MFA status.
   */
  async getMfaStatus(): Promise<MFAStatus> {
    return this.get<MFAStatus>(this.config.endpoints.mfaStatus, true);
  }

  /**
   * Get MFA devices.
   */
  async getMfaDevices(): Promise<unknown[]> {
    return this.get<unknown[]>(this.config.endpoints.mfaDevices, true);
  }

  /**
   * Setup MFA device (authenticated user).
   */
  async setupMfaDevice(method: string): Promise<unknown> {
    return this.post<unknown>(this.config.endpoints.mfaSetupData, { method }, true);
  }

  /**
   * Verify MFA setup (authenticated user).
   */
  async verifyMfaSetup(
    method: string,
    setupData: Record<string, unknown>,
    deviceName?: string,
  ): Promise<{ deviceId: number }> {
    return this.post<{ deviceId: number }>(
      this.config.endpoints.mfaVerifySetup,
      { method, setupData, deviceName },
      true,
    );
  }

  /**
   * Remove MFA method.
   */
  async removeMfaDevice(method: string): Promise<{ message: string }> {
    const path = `${this.config.endpoints.mfaRemove}/${method}`;
    return this.delete<{ message: string }>(path, true);
  }

  /**
   * Set preferred MFA method.
   *
   * @param method - Device method to set as preferred ('totp', 'sms', 'email', or 'passkey'). Cannot be 'backup'.
   * @returns Success message
   */
  async setPreferredMfaMethod(method: 'totp' | 'sms' | 'email' | 'passkey'): Promise<{ message: string }> {
    return this.post<{ message: string }>(this.config.endpoints.mfaPreferred, { method }, true);
  }

  /**
   * Generate backup codes.
   */
  async generateBackupCodes(): Promise<string[]> {
    const result = await this.post<{ codes: string[] }>(this.config.endpoints.mfaBackupCodes, {}, true);
    return result.codes;
  }

  /**
   * Set MFA exemption (admin/test scenarios).
   */
  async setMfaExemption(exempt: boolean, reason?: string): Promise<void> {
    await this.post(this.config.endpoints.mfaExemption, { exempt, reason }, true);
  }

  // ============================================================================
  // Event System
  // ============================================================================

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
      const base = this.config.baseUrl.replace(/\/$/, '');
      const startUrl = new URL(`${base}${startPath}`);

      const returnTo = options?.returnTo ?? this.config.redirects?.success ?? '/';

      startUrl.searchParams.set('returnTo', returnTo);
      // Only include action when deviating from the default ('login').
      if (options?.action === 'link') {
        startUrl.searchParams.set('action', 'link');
      }
      if (typeof options?.appState === 'string' && options.appState.trim() !== '') {
        startUrl.searchParams.set('appState', options.appState);
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

    // Auto-handle navigation
    await this.challengeRouter.handleAuthResponse(result, { source: 'social' });

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
    await this.setDeviceToken(result.deviceToken);
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
   * Get paginated audit history for the current user.
   *
   * Returns authentication and security events with full audit details including:
   * - Event type (login, logout, MFA, etc.)
   * - Event status (success, failure, suspicious)
   * - Device information, location, risk factors
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated audit history response
   *
   * @example
   * ```typescript
   * const history = await client.getAuditHistory({
   *   page: 1,
   *   limit: 20,
   *   eventType: 'LOGIN_SUCCESS'
   * });
   * ```
   */
  async getAuditHistory(params?: Record<string, string | number | boolean>): Promise<AuditHistoryResponse> {
    const entries: [string, string][] = Object.entries(params ?? {}).map(([k, v]) => [k, String(v)]);
    const query = entries.length > 0 ? `?${new URLSearchParams(entries).toString()}` : '';
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

    // Clear device token in JSON mode (cookies mode uses httpOnly cookie cleared by backend)
    if (forgetDevice && this.config.tokenDelivery === 'json') {
      await this.config.storage.removeItem(this.config.deviceTrust.storageKey);
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
   * @private
   */
  private buildUrl(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  /**
   * Build request headers for authentication.
   * @private
   */
  private async buildHeaders(auth: boolean): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

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

    // Add CSRF token for mutating requests in cookies mode
    if (this.config.tokenDelivery === 'cookies' && hasWindow()) {
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
    const headers = await this.buildHeaders(auth);
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
    const headers = await this.buildHeaders(auth);
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
    const headers = await this.buildHeaders(auth);
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
    const headers = await this.buildHeaders(auth);
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
}
