import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AngularHttpAdapter } from './http-adapter';
import {
  NAuthClient,
  NAuthClientConfig,
  ChallengeResponse,
  AuthResponse,
  TokenResponse,
  AuthUser,
  ConfirmForgotPasswordResponse,
  ForgotPasswordResponse,
  ResetPasswordWithCodeResponse,
  UpdateProfileRequest,
  GetChallengeDataResponse,
  GetSetupDataResponse,
  MFAStatus,
  MFADevice,
  AuthEvent,
  SocialProvider,
  SocialLoginOptions,
  LinkedAccountsResponse,
  SocialVerifyRequest,
  AuditHistoryResponse,
} from '@nauth-toolkit/client';

/**
 * Angular wrapper around NAuthClient that provides promise-based auth methods and reactive state.
 *
 * This service provides:
 * - Reactive state (currentUser$, isAuthenticated$, challenge$)
 * - All core auth methods as Promises (login, signup, logout, refresh)
 * - Profile management (getProfile, updateProfile, changePassword)
 * - Challenge flow methods (respondToChallenge, resendCode)
 * - MFA management (getMfaStatus, setupMfaDevice, etc.)
 * - Social authentication and account linking
 * - Device trust management
 * - Audit history
 *
 * @example
 * ```typescript
 * constructor(private auth: AuthService) {}
 *
 * // Reactive state
 * this.auth.currentUser$.subscribe(user => ...);
 * this.auth.isAuthenticated$.subscribe(isAuth => ...);
 *
 * // Auth operations with async/await
 * const response = await this.auth.login(email, password);
 *
 * // Profile management
 * await this.auth.changePassword(oldPassword, newPassword);
 * const user = await this.auth.updateProfile({ firstName: 'John' });
 *
 * // MFA operations
 * const status = await this.auth.getMfaStatus();
 * ```
 */
@Injectable()
export class AuthService {
  private readonly client: NAuthClient;
  private readonly config: NAuthClientConfig;
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly challengeSubject = new BehaviorSubject<AuthResponse | null>(null);
  private readonly authEventsSubject = new Subject<AuthEvent>();
  private initialized = false;

  /**
   * @param config - Injected client configuration (required)
   * @param httpAdapter - Angular HTTP adapter for making requests (required)
   */
  constructor(@Inject(NAUTH_CLIENT_CONFIG) config: NAuthClientConfig, httpAdapter: AngularHttpAdapter) {
    this.config = config;

    // Use provided httpAdapter (from config or injected)
    const adapter = config.httpAdapter ?? httpAdapter;
    if (!adapter) {
      throw new Error(
        'HttpAdapter not found. Either provide httpAdapter in NAUTH_CLIENT_CONFIG or ensure HttpClient is available.',
      );
    }

    this.client = new NAuthClient({
      ...config,
      httpAdapter: adapter,
      onAuthStateChange: (user) => {
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(Boolean(user));
        config.onAuthStateChange?.(user);
      },
    });

    // Forward all client events to Observable stream
    this.client.on('*', (event) => {
      this.authEventsSubject.next(event);
    });

    // Auto-initialize on construction (hydrate from storage)
    this.initialize();
  }

  // ============================================================================
  // Reactive State Observables
  // ============================================================================

  /**
   * Current user observable.
   */
  get currentUser$(): Observable<AuthUser | null> {
    return this.currentUserSubject.asObservable();
  }

  /**
   * Authenticated state observable.
   */
  get isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  /**
   * Current challenge observable (for reactive challenge navigation).
   */
  get challenge$(): Observable<AuthResponse | null> {
    return this.challengeSubject.asObservable();
  }

  /**
   * Authentication events stream.
   * Emits all auth lifecycle events for custom logic, analytics, or UI updates.
   */
  get authEvents$(): Observable<AuthEvent> {
    return this.authEventsSubject.asObservable();
  }

  /**
   * Successful authentication events stream.
   * Emits when user successfully authenticates (login, signup, social auth).
   */
  get authSuccess$(): Observable<AuthEvent> {
    return this.authEventsSubject.pipe(filter((e) => e.type === 'auth:success'));
  }

  /**
   * Authentication error events stream.
   * Emits when authentication fails (login error, OAuth error, etc.).
   */
  get authError$(): Observable<AuthEvent> {
    return this.authEventsSubject.pipe(filter((e) => e.type === 'auth:error' || e.type === 'oauth:error'));
  }

  // ============================================================================
  // Sync State Accessors (for guards, templates)
  // ============================================================================

  /**
   * Check if authenticated (sync, uses cached state).
   */
  isAuthenticated(): boolean {
    return this.client.isAuthenticatedSync();
  }

  /**
   * Get current user (sync, uses cached state).
   */
  getCurrentUser(): AuthUser | null {
    return this.client.getCurrentUser();
  }

  /**
   * Get current challenge (sync).
   */
  getCurrentChallenge(): AuthResponse | null {
    return this.challengeSubject.value;
  }

  /**
   * Get challenge router for manual navigation control.
   * Useful for guards that need to handle errors or build custom URLs.
   *
   * @returns ChallengeRouter instance
   *
   * @example
   * ```typescript
   * const router = this.auth.getChallengeRouter();
   * await router.navigateToError('oauth');
   * ```
   */
  getChallengeRouter() {
    return this.client.getChallengeRouter();
  }

  // ============================================================================
  // Core Auth Methods
  // ============================================================================

  /**
   * Login with identifier and password.
   *
   * @param identifier - User email or username
   * @param password - User password
   * @returns Promise with auth response or challenge
   *
   * @example
   * ```typescript
   * const response = await this.auth.login('user@example.com', 'password');
   * if (response.challengeName) {
   *   // Handle challenge
   * } else {
   *   // Login successful
   * }
   * ```
   */
  async login(identifier: string, password: string): Promise<AuthResponse> {
    const res = await this.client.login(identifier, password);
    return this.updateChallengeState(res);
  }

  /**
   * Signup with credentials.
   *
   * @param payload - Signup request payload
   * @returns Promise with auth response or challenge
   *
   * @example
   * ```typescript
   * const response = await this.auth.signup({
   *   email: 'new@example.com',
   *   password: 'SecurePass123!',
   *   firstName: 'John',
   * });
   * ```
   */
  async signup(payload: Parameters<NAuthClient['signup']>[0]): Promise<AuthResponse> {
    const res = await this.client.signup(payload);
    return this.updateChallengeState(res);
  }

  /**
   * Logout current session.
   *
   * @param forgetDevice - If true, removes device trust
   *
   * @example
   * ```typescript
   * await this.auth.logout();
   * ```
   */
  async logout(forgetDevice?: boolean): Promise<void> {
    await this.client.logout(forgetDevice);
    this.challengeSubject.next(null);
    // Explicitly update auth state after logout
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);

    // Clear CSRF token cookie if in cookies mode
    // Note: Backend should clear httpOnly cookies, but we clear non-httpOnly ones
    if (this.config.tokenDelivery === 'cookies' && typeof document !== 'undefined') {
      const csrfCookieName = this.config.csrf?.cookieName ?? 'nauth_csrf_token';
      // Extract domain from baseUrl if possible
      try {
        const url = new URL(this.config.baseUrl);
        document.cookie = `${csrfCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${url.hostname}`;
        // Also try without domain (for localhost)
        document.cookie = `${csrfCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      } catch {
        // Fallback if baseUrl parsing fails
        document.cookie = `${csrfCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      }
    }
  }

  /**
   * Logout all sessions.
   *
   * Revokes all active sessions for the current user across all devices.
   * Optionally revokes all trusted devices if forgetDevices is true.
   *
   * @param forgetDevices - If true, also revokes all trusted devices (default: false)
   * @returns Promise with number of sessions revoked
   *
   * @example
   * ```typescript
   * const result = await this.auth.logoutAll();
   * console.log(`Revoked ${result.revokedCount} sessions`);
   * ```
   */
  async logoutAll(forgetDevices?: boolean): Promise<{ revokedCount: number }> {
    const res = await this.client.logoutAll(forgetDevices);
    this.challengeSubject.next(null);
    // Explicitly update auth state after logout
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    return res;
  }

  /**
   * Refresh tokens.
   *
   * @returns Promise with new tokens
   *
   * @example
   * ```typescript
   * const tokens = await this.auth.refresh();
   * ```
   */
  async refresh(): Promise<TokenResponse> {
    return this.client.refreshTokens();
  }

  // ============================================================================
  // Account Recovery (Forgot Password)
  // ============================================================================

  /**
   * Request a password reset code (forgot password).
   *
   * @param identifier - User email, username, or phone
   * @returns Promise with password reset response
   *
   * @example
   * ```typescript
   * await this.auth.forgotPassword('user@example.com');
   * ```
   */
  async forgotPassword(identifier: string): Promise<ForgotPasswordResponse> {
    return this.client.forgotPassword(identifier);
  }

  /**
   * Confirm a password reset code and set a new password.
   *
   * @param identifier - User email, username, or phone
   * @param code - One-time reset code
   * @param newPassword - New password
   * @returns Promise with confirmation response
   *
   * @example
   * ```typescript
   * await this.auth.confirmForgotPassword('user@example.com', '123456', 'NewPass123!');
   * ```
   */
  async confirmForgotPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<ConfirmForgotPasswordResponse> {
    return this.client.confirmForgotPassword(identifier, code, newPassword);
  }

  /**
   * Reset password with code or token (generic method for both admin and user-initiated resets).
   *
   * Accepts either:
   * - code: Short numeric code from email/SMS (6-10 digits)
   * - token: Long hex token from reset link (64 chars)
   *
   * @param identifier - User identifier (email, username, phone)
   * @param codeOrToken - Verification code OR token from link
   * @param newPassword - New password
   * @returns Promise with success response
   *
   * @example
   * ```typescript
   * // With code from email
   * await this.auth.resetPasswordWithCode('user@example.com', '123456', 'NewPass123!');
   *
   * // With token from link
   * await this.auth.resetPasswordWithCode('user@example.com', '64-char-token', 'NewPass123!');
   * ```
   */
  async resetPasswordWithCode(
    identifier: string,
    codeOrToken: string,
    newPassword: string,
  ): Promise<ResetPasswordWithCodeResponse> {
    return this.client.resetPasswordWithCode(identifier, codeOrToken, newPassword);
  }

  /**
   * Change user password (requires current password).
   *
   * @param oldPassword - Current password
   * @param newPassword - New password (must meet requirements)
   * @returns Promise that resolves when password is changed
   *
   * @example
   * ```typescript
   * await this.auth.changePassword('oldPassword123', 'newSecurePassword456!');
   * ```
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return this.client.changePassword(oldPassword, newPassword);
  }

  /**
   * Request password change (must change on next login).
   *
   * @returns Promise that resolves when request is sent
   *
   * @example
   * ```typescript
   * await this.auth.requestPasswordChange();
   * ```
   */
  async requestPasswordChange(): Promise<void> {
    return this.client.requestPasswordChange();
  }

  // ============================================================================
  // Profile Management
  // ============================================================================

  /**
   * Get current user profile.
   *
   * @returns Promise of current user profile
   *
   * @example
   * ```typescript
   * const user = await this.auth.getProfile();
   * console.log('User profile:', user);
   * ```
   */
  async getProfile(): Promise<AuthUser> {
    const user = await this.client.getProfile();
    // Update local state when profile is fetched
    this.currentUserSubject.next(user);
    return user;
  }

  /**
   * Update user profile.
   *
   * @param updates - Profile fields to update
   * @returns Promise of updated user profile
   *
   * @example
   * ```typescript
   * const user = await this.auth.updateProfile({ firstName: 'John', lastName: 'Doe' });
   * console.log('Profile updated:', user);
   * ```
   */
  async updateProfile(updates: UpdateProfileRequest): Promise<AuthUser> {
    const user = await this.client.updateProfile(updates);
    // Update local state when profile is updated
    this.currentUserSubject.next(user);
    return user;
  }

  // ============================================================================
  // Challenge Flow Methods (Essential for any auth flow)
  // ============================================================================

  /**
   * Respond to a challenge (VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, etc.).
   *
   * @param response - Challenge response data
   * @returns Promise with auth response or next challenge
   *
   * @example
   * ```typescript
   * const result = await this.auth.respondToChallenge({
   *   session: challengeSession,
   *   type: 'VERIFY_EMAIL',
   *   code: '123456',
   * });
   * ```
   */
  async respondToChallenge(response: ChallengeResponse): Promise<AuthResponse> {
    const res = await this.client.respondToChallenge(response);
    return this.updateChallengeState(res);
  }

  /**
   * Resend challenge code.
   *
   * @param session - Challenge session token
   * @returns Promise with destination information
   *
   * @example
   * ```typescript
   * const result = await this.auth.resendCode(session);
   * console.log('Code sent to:', result.destination);
   * ```
   */
  async resendCode(session: string): Promise<{ destination: string }> {
    return this.client.resendCode(session);
  }

  /**
   * Get MFA setup data (for MFA_SETUP_REQUIRED challenge).
   *
   * Returns method-specific setup information:
   * - TOTP: { secret, qrCode, manualEntryKey }
   * - SMS: { maskedPhone }
   * - Email: { maskedEmail }
   * - Passkey: WebAuthn registration options
   *
   * @param session - Challenge session token
   * @param method - MFA method to set up
   * @returns Promise of setup data response
   *
   * @example
   * ```typescript
   * const setupData = await this.auth.getSetupData(session, 'totp');
   * console.log('QR Code:', setupData.setupData.qrCode);
   * ```
   */
  async getSetupData(session: string, method: string): Promise<GetSetupDataResponse> {
    return this.client.getSetupData(session, method as Parameters<NAuthClient['getSetupData']>[1]);
  }

  /**
   * Get MFA challenge data (for MFA_REQUIRED challenge - e.g., passkey options).
   *
   * @param session - Challenge session token
   * @param method - Challenge method
   * @returns Promise of challenge data response
   *
   * @example
   * ```typescript
   * const challengeData = await this.auth.getChallengeData(session, 'passkey');
   * ```
   */
  async getChallengeData(session: string, method: string): Promise<GetChallengeDataResponse> {
    return this.client.getChallengeData(session, method as Parameters<NAuthClient['getChallengeData']>[1]);
  }

  /**
   * Clear stored challenge (when navigating away from challenge flow).
   *
   * @returns Promise that resolves when challenge is cleared
   *
   * @example
   * ```typescript
   * await this.auth.clearChallenge();
   * ```
   */
  async clearChallenge(): Promise<void> {
    await this.client.clearStoredChallenge();
    this.challengeSubject.next(null);
  }

  /**
   * Get current access token (JSON mode only).
   *
   * This is primarily useful for consumers using Angular `HttpClient` directly
   * (outside of the SDK methods) and relying on an interceptor to attach Bearer tokens.
   *
   * @returns Access token, or null if not available
   *
   * @example
   * ```typescript
   * const token = await this.auth.getAccessToken();
   * ```
   */
  async getAccessToken(): Promise<string | null> {
    return await this.client.getAccessToken();
  }

  // ============================================================================
  // Social Authentication
  // ============================================================================

  /**
   * Initiate social OAuth login flow.
   * Redirects the browser to backend `/auth/social/:provider/redirect`.
   *
   * @param provider - Social provider ('google', 'apple', 'facebook')
   * @param options - Optional redirect options
   * @returns Promise that resolves when redirect starts
   *
   * @example
   * ```typescript
   * await this.auth.loginWithSocial('google', { returnTo: '/auth/callback' });
   * ```
   */
  async loginWithSocial(provider: SocialProvider, options?: SocialLoginOptions): Promise<void> {
    return this.client.loginWithSocial(provider, options);
  }

  /**
   * Exchange an exchangeToken (from redirect callback URL) into an AuthResponse.
   *
   * Used for `tokenDelivery: 'json'` or hybrid flows where the backend redirects back
   * with `exchangeToken` instead of setting cookies.
   *
   * @param exchangeToken - One-time exchange token from the callback URL
   * @returns Promise of AuthResponse
   *
   * @example
   * ```typescript
   * const response = await this.auth.exchangeSocialRedirect(exchangeToken);
   * ```
   */
  async exchangeSocialRedirect(exchangeToken: string): Promise<AuthResponse> {
    const res = await this.client.exchangeSocialRedirect(exchangeToken);
    return this.updateChallengeState(res);
  }

  /**
   * Verify native social token (mobile).
   *
   * @param request - Social verification request with provider and token
   * @returns Promise of AuthResponse
   *
   * @example
   * ```typescript
   * const result = await this.auth.verifyNativeSocial({
   *   provider: 'google',
   *   idToken: nativeIdToken,
   * });
   * ```
   */
  async verifyNativeSocial(request: SocialVerifyRequest): Promise<AuthResponse> {
    const res = await this.client.verifyNativeSocial(request);
    return this.updateChallengeState(res);
  }

  /**
   * Get linked social accounts.
   *
   * @returns Promise of linked accounts response
   *
   * @example
   * ```typescript
   * const accounts = await this.auth.getLinkedAccounts();
   * console.log('Linked providers:', accounts.providers);
   * ```
   */
  async getLinkedAccounts(): Promise<LinkedAccountsResponse> {
    return this.client.getLinkedAccounts();
  }

  /**
   * Link social account.
   *
   * @param provider - Social provider to link
   * @param code - OAuth authorization code
   * @param state - OAuth state parameter
   * @returns Promise with success message
   *
   * @example
   * ```typescript
   * await this.auth.linkSocialAccount('google', code, state);
   * ```
   */
  async linkSocialAccount(provider: string, code: string, state: string): Promise<{ message: string }> {
    return this.client.linkSocialAccount(provider, code, state);
  }

  /**
   * Unlink social account.
   *
   * @param provider - Social provider to unlink
   * @returns Promise with success message
   *
   * @example
   * ```typescript
   * await this.auth.unlinkSocialAccount('google');
   * ```
   */
  async unlinkSocialAccount(provider: string): Promise<{ message: string }> {
    return this.client.unlinkSocialAccount(provider);
  }

  // ============================================================================
  // MFA Management
  // ============================================================================

  /**
   * Get MFA status for the current user.
   *
   * @returns Promise of MFA status
   *
   * @example
   * ```typescript
   * const status = await this.auth.getMfaStatus();
   * console.log('MFA enabled:', status.enabled);
   * ```
   */
  async getMfaStatus(): Promise<MFAStatus> {
    return this.client.getMfaStatus();
  }

  /**
   * Get MFA devices for the current user.
   *
   * @returns Promise of MFA devices array
   *
   * @example
   * ```typescript
   * const devices = await this.auth.getMfaDevices();
   * ```
   */
  async getMfaDevices(): Promise<MFADevice[]> {
    return this.client.getMfaDevices() as Promise<MFADevice[]>;
  }

  /**
   * Setup MFA device (authenticated user).
   *
   * @param method - MFA method to set up
   * @returns Promise of setup data
   *
   * @example
   * ```typescript
   * const setupData = await this.auth.setupMfaDevice('totp');
   * ```
   */
  async setupMfaDevice(method: string): Promise<unknown> {
    return this.client.setupMfaDevice(method);
  }

  /**
   * Verify MFA setup (authenticated user).
   *
   * @param method - MFA method
   * @param setupData - Setup data from setupMfaDevice
   * @param deviceName - Optional device name
   * @returns Promise with device ID
   *
   * @example
   * ```typescript
   * const result = await this.auth.verifyMfaSetup('totp', { code: '123456' }, 'My Phone');
   * ```
   */
  async verifyMfaSetup(
    method: string,
    setupData: Record<string, unknown>,
    deviceName?: string,
  ): Promise<{ deviceId: number }> {
    return this.client.verifyMfaSetup(method, setupData, deviceName);
  }

  /**
   * Remove MFA device.
   *
   * @param method - MFA method to remove
   * @returns Promise with success message
   *
   * @example
   * ```typescript
   * await this.auth.removeMfaDevice('sms');
   * ```
   */
  async removeMfaDevice(method: string): Promise<{ message: string }> {
    return this.client.removeMfaDevice(method);
  }

  /**
   * Set preferred MFA method.
   *
   * @param method - Device method to set as preferred ('totp', 'sms', 'email', or 'passkey')
   * @returns Promise with success message
   *
   * @example
   * ```typescript
   * await this.auth.setPreferredMfaMethod('totp');
   * ```
   */
  async setPreferredMfaMethod(method: 'totp' | 'sms' | 'email' | 'passkey'): Promise<{ message: string }> {
    return this.client.setPreferredMfaMethod(method);
  }

  /**
   * Generate backup codes.
   *
   * @returns Promise of backup codes array
   *
   * @example
   * ```typescript
   * const codes = await this.auth.generateBackupCodes();
   * console.log('Backup codes:', codes);
   * ```
   */
  async generateBackupCodes(): Promise<string[]> {
    return this.client.generateBackupCodes();
  }

  /**
   * Set MFA exemption (admin/test scenarios).
   *
   * @param exempt - Whether to exempt user from MFA
   * @param reason - Optional reason for exemption
   * @returns Promise that resolves when exemption is set
   *
   * @example
   * ```typescript
   * await this.auth.setMfaExemption(true, 'Test account');
   * ```
   */
  async setMfaExemption(exempt: boolean, reason?: string): Promise<void> {
    return this.client.setMfaExemption(exempt, reason);
  }

  // ============================================================================
  // Device Trust
  // ============================================================================

  /**
   * Trust current device.
   *
   * @returns Promise with device token
   *
   * @example
   * ```typescript
   * const result = await this.auth.trustDevice();
   * console.log('Device trusted:', result.deviceToken);
   * ```
   */
  async trustDevice(): Promise<{ deviceToken: string }> {
    return this.client.trustDevice();
  }

  /**
   * Check if the current device is trusted.
   *
   * @returns Promise with trusted status
   *
   * @example
   * ```typescript
   * const result = await this.auth.isTrustedDevice();
   * if (result.trusted) {
   *   console.log('This device is trusted');
   * }
   * ```
   */
  async isTrustedDevice(): Promise<{ trusted: boolean }> {
    return this.client.isTrustedDevice();
  }

  // ============================================================================
  // Audit History
  // ============================================================================

  /**
   * Get paginated audit history for the current user.
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Promise of audit history response
   *
   * @example
   * ```typescript
   * const history = await this.auth.getAuditHistory({
   *   page: 1,
   *   limit: 20,
   *   eventType: 'LOGIN_SUCCESS'
   * });
   * console.log('Audit history:', history);
   * ```
   */
  async getAuditHistory(params?: Record<string, string | number | boolean>): Promise<AuditHistoryResponse> {
    return this.client.getAuditHistory(params);
  }

  // ============================================================================
  // Escape Hatch
  // ============================================================================

  /**
   * Expose underlying NAuthClient for advanced scenarios.
   *
   * @deprecated All core functionality is now exposed directly on AuthService as Promises.
   * Use the direct methods on AuthService instead (e.g., `auth.changePassword()` instead of `auth.getClient().changePassword()`).
   * This method is kept for backward compatibility only and may be removed in a future version.
   *
   * @returns The underlying NAuthClient instance
   *
   * @example
   * ```typescript
   * // Deprecated - use direct methods instead
   * const status = await this.auth.getClient().getMfaStatus();
   *
   * // Preferred - use direct methods
   * const status = await this.auth.getMfaStatus();
   * ```
   */
  getClient(): NAuthClient {
    return this.client;
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Initialize by hydrating state from storage.
   * Called automatically on construction.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.client.initialize();

    // Hydrate challenge state
    const storedChallenge = await this.client.getStoredChallenge();
    if (storedChallenge) {
      this.challengeSubject.next(storedChallenge);
    }

    // Update subjects from client state
    const user = this.client.getCurrentUser();
    if (user) {
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
    }
  }

  /**
   * Update challenge state after auth response.
   */
  private updateChallengeState(response: AuthResponse): AuthResponse {
    if (response.challengeName) {
      this.challengeSubject.next(response);
    } else {
      this.challengeSubject.next(null);
    }
    return response;
  }
}
