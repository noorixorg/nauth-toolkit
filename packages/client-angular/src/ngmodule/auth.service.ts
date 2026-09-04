import { Inject, Injectable, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AngularHttpAdapter } from './http-adapter';
import { RecaptchaService } from '../lib/recaptcha.service';
import {
  NAuthClient,
  NAuthClientConfig,
  AuthResponseContext,
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
  GetMFADevicesResponse,
  MFAStatus,
  RemoveMFADeviceResponse,
  AuthEvent,
  SocialProvider,
  SocialLoginOptions,
  LinkedAccountsResponse,
  SocialVerifyRequest,
  AuditHistoryResponse,
  AdminOperations,
  OIDCOperations,
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
   * @param router - Angular Router (optional, automatically used for navigation if available)
   * @param recaptchaService - RecaptchaService (optional, for automatic token generation)
   */
  constructor(
    @Inject(NAUTH_CLIENT_CONFIG) config: NAuthClientConfig,
    httpAdapter: AngularHttpAdapter,
    @Optional() private router?: Router,
    @Optional() private recaptchaService?: RecaptchaService,
  ) {
    this.config = config;

    // Use provided httpAdapter (from config or injected)
    const adapter = config.httpAdapter ?? httpAdapter;
    if (!adapter) {
      throw new Error(
        'HttpAdapter not found. Either provide httpAdapter in NAUTH_CLIENT_CONFIG or ensure HttpClient is available.',
      );
    }

    // ============================================================================
    // Automatic Angular Router integration
    // ============================================================================
    // If Router is available and no custom navigationHandler is provided,
    // automatically use Angular Router's navigateByUrl() to prevent page refreshes
    const navigationHandler =
      config.navigationHandler ??
      (this.router
        ? async (url: string): Promise<void> => {
            await this.router!.navigateByUrl(url);
          }
        : undefined);

    // ============================================================================
    // IMPORTANT: Challenge-state hydration BEFORE navigation (Angular guard safety)
    // ============================================================================
    // WHY: `NAuthClient.login()` auto-navigates via ChallengeRouter *before* returning.
    // The Angular sample app uses a synchronous guard (`challengeRouteGuard`) that
    // reads the current challenge via `AuthService.getCurrentChallenge()` (backed by
    // `challengeSubject.value`). If navigation happens before `challengeSubject` is
    // updated, the guard incorrectly redirects back to `/login`.
    //
    // Fix: intercept the SDK's auto-navigation hook (`onAuthResponse`), publish the
    // challenge state immediately, then perform default navigation (or delegate to
    // the user's custom `onAuthResponse` if provided).
    const userOnAuthResponse = config.onAuthResponse;

    this.client = new NAuthClient({
      ...config,
      httpAdapter: adapter,
      navigationHandler,
      onAuthResponse: async (response: AuthResponse, context: AuthResponseContext): Promise<void> => {
        // Ensure guards can synchronously see the active challenge before navigation.
        this.updateChallengeState(response);

        // If the consumer provided their own handler, let them take full control.
        if (userOnAuthResponse) {
          await userOnAuthResponse(response, context);
          return;
        }

        // Default navigation behavior (matches ChallengeRouter.handleAuthResponse)
        const router = this.client.getChallengeRouter();
        if (response.challengeName) {
          await router.navigateToChallenge(response);
          return;
        }

        // Prefer appState provided via context (social redirect guard / exchange flow).
        // IMPORTANT: Do not consume/clear persisted OAuth state here; leave it available
        // for consumers via getLastOauthState().
        await router.navigateToSuccess(context.appState ? { appState: context.appState } : undefined, context);
      },
      onAuthStateChange: (user: AuthUser | null) => {
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(Boolean(user));
        config.onAuthStateChange?.(user);
      },
    });

    // Forward all client events to Observable stream
    this.client.on('*', (event: AuthEvent) => {
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
   * Automatically generates reCAPTCHA token if configured (v3 only).
   * For v2 manual mode, pass the token explicitly.
   *
   * @param identifier - User email or username
   * @param password - User password
   * @param recaptchaToken - Optional reCAPTCHA token (for v2 manual mode or when auto-generation is disabled)
   * @returns Promise with auth response or challenge
   *
   * @example Basic Login
   * ```typescript
   * const response = await this.auth.login('user@example.com', 'password');
   * ```
   *
   * @example With Manual reCAPTCHA (v2)
   * ```typescript
   * const response = await this.auth.login('user@example.com', 'password', recaptchaToken);
   * ```
   */
  async login(identifier: string, password: string, recaptchaToken?: string): Promise<AuthResponse> {
    const token = await this.getRecaptchaToken(recaptchaToken, 'login');
    const res = await this.client.login(identifier, password, token);
    return this.updateChallengeState(res);
  }

  /**
   * Signup with credentials.
   *
   * Automatically generates reCAPTCHA token if configured (v3 only).
   * For v2 manual mode, include token in payload.
   *
   * @param payload - Signup request payload
   * @returns Promise with auth response or challenge
   *
   * @example Basic Signup
   * ```typescript
   * const response = await this.auth.signup({
   *   email: 'new@example.com',
   *   password: 'SecurePass123!',
   *   firstName: 'John',
   * });
   * ```
   *
   * @example With Manual reCAPTCHA (v2)
   * ```typescript
   * const response = await this.auth.signup({
   *   email: 'new@example.com',
   *   password: 'SecurePass123!',
   *   recaptchaToken: token,
   * });
   * ```
   */
  async signup(payload: Parameters<NAuthClient['signup']>[0]): Promise<AuthResponse> {
    // Auto-generate reCAPTCHA token for v3 if configured and not already provided
    const payloadWithRecaptcha = payload as { recaptchaToken?: string };

    if (!payloadWithRecaptcha.recaptchaToken) {
      const token = await this.getRecaptchaToken(undefined, 'signup');
      if (token) {
        payload = { ...payload, recaptchaToken: token };
      }
    }

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

  /**
   * Get the last OAuth appState from social redirect callback.
   *
   * Returns the appState that was stored during the most recent social
   * login redirect callback. This is useful for restoring UI state,
   * applying invite codes, or tracking referral information.
   *
   * The state is automatically cleared after retrieval to prevent reuse.
   *
   * @returns The stored appState, or null if none exists
   *
   * @example
   * ```typescript
   * const appState = await this.auth.getLastOauthState();
   * if (appState) {
   *   // Apply invite code or restore UI state
   *   console.log('OAuth state:', appState);
   * }
   * ```
   */
  async getLastOauthState(): Promise<string | null> {
    return this.client.getLastOauthState();
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
   * @returns Promise of MFA devices response
   *
   * @example
   * ```typescript
   * const result = await this.auth.getMfaDevices();
   * console.log('Devices:', result.devices);
   * ```
   */
  async getMfaDevices(): Promise<GetMFADevicesResponse> {
    return this.client.getMfaDevices();
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
   * const result = await this.auth.setupMfaDevice('totp');
   * console.log('QR Code:', result.setupData.qrCode);
   * ```
   */
  async setupMfaDevice(method: string): Promise<GetSetupDataResponse> {
    return this.client.setupMfaDevice(method);
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
   * const setupData = await this.auth.setupMfaDevice('totp');
   * // Returns: { setupData: { secret: 'JBSWY3DPEHPK3PXP', qrCode: '...', ... } }
   *
   * // Step 2: User scans QR code and enters code from authenticator app
   * const code = '123456'; // From authenticator app
   *
   * // Step 3: Verify setup (requires both secret and code)
   * const result = await this.auth.verifyMfaSetup('totp', {
   *   secret: setupData.setupData.secret,
   *   code: code,
   * }, 'Google Authenticator');
   * // Returns: { deviceId: 123 }
   * ```
   *
   * @example SMS Setup
   * ```typescript
   * const result = await this.auth.verifyMfaSetup('sms', {
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
   * const result = await this.auth.verifyMfaSetup('passkey', {
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
    return this.client.verifyMfaSetup(method, setupData, deviceName);
  }

  /**
   * Remove a single MFA device by device ID.
   *
   * **Recommended:** Use this for granular device management.
   *
   * @param deviceId - MFA device ID
   * @returns Removal response
   *
   * @example
   * ```typescript
   * const devices = await this.auth.getMfaDevices();
   * await this.auth.removeMfaDeviceById(devices[0].id);
   * ```
   */
  async removeMfaDeviceById(deviceId: number): Promise<RemoveMFADeviceResponse> {
    return this.client.removeMfaDeviceById(deviceId);
  }

  /**

  /**
   * Select an MFA device for verification (during challenge flow)
   *
   * Call this when user selects a specific device from the MFA selector UI.
   * SDK stores the deviceId internally and auto-injects it when respondToChallenge() is called.
   *
   * @param deviceId - ID of the device user selected
   *
   * @example
   * ```typescript
   * // User clicks "Microsoft Authenticator" button
   * this.auth.selectMFADevice(48);
   *
   * // Navigate to OTP verification (no deviceId in query params needed!)
   * this.router.navigate(['/auth/challenge/mfa-required']);
   *
   * // Later, when submitting OTP code:
   * await this.auth.respondToChallenge({
   *   type: 'MFA_REQUIRED',
   *   session: 'abc123',
   *   method: 'totp',
   *   code: '123456',
   *   // SDK auto-injects deviceId=48 here!
   * });
   * ```
   */
  selectMFADevice(deviceId: number): void {
    return this.client.selectMFADevice(deviceId);
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
   * // In MFA selector component
   * const devices = this.auth.getMFADevicesFromChallenge(this.challenge());
   * // Returns: [
   * //   { id: 48, name: "Microsoft Authenticator", type: "totp" },
   * //   { id: 3, name: "Google Authenticator", type: "totp" }
   * // ]
   *
   * // Render device buttons
   * for (const device of devices) {
   *   // <button (click)="selectDevice(device)">{{ device.name }}</button>
   * }
   * ```
   */
  getMFADevicesFromChallenge(challenge: AuthResponse): Array<{ id: number; name: string; type: string }> {
    return this.client.getMFADevices(challenge);
  }

  /**
   * Clear any selected MFA device
   *
   * Useful if user navigates back to device selector or cancels MFA flow.
   */
  clearSelectedMFADevice(): void {
    return this.client.clearSelectedDevice();
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
  /**
   * Set a specific MFA device as preferred.
   *
   * @param deviceId - MFA device ID
   * @returns Promise with success message
   */
  async setPreferredMfaDevice(deviceId: number): Promise<{ message: string }> {
    return this.client.setPreferredMfaDevice(deviceId);
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
   *   eventTypes: ['LOGIN_SUCCESS'],
   *   eventStatus: ['FAILURE'],
   * });
   * console.log('Audit history:', history);
   * ```
   */
  async getAuditHistory(
    params?: Record<string, string | number | boolean | Array<string | number | boolean>>,
  ): Promise<AuditHistoryResponse> {
    return this.client.getAuditHistory(params);
  }

  // ============================================================================
  // Escape Hatch
  // ============================================================================

  /**
   * Expose underlying NAuthClient for advanced scenarios.
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
  // Admin Operations
  // ============================================================================

  /**
   * Admin operations (if enabled in config).
   *
   * Provides admin-level user management methods:
   * - User CRUD operations
   * - Password management
   * - Session management
   * - MFA management
   * - Audit history
   *
   * Returns undefined if admin was not configured.
   *
   * @returns AdminOperations instance or undefined
   *
   * @example
   * ```typescript
   * // Check if admin is available
   * if (this.auth.admin) {
   *   const users = await this.auth.admin.getUsers({ page: 1 });
   * }
   *
   * // With optional chaining
   * await this.auth.admin?.deleteUser(sub);
   *
   * // Create user
   * const result = await this.auth.admin?.createUser({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   isEmailVerified: true,
   * });
   * ```
   */
  get admin(): AdminOperations | undefined {
    return this.client.admin;
  }

  // ============================================================================
  // OpenID Connect Interaction Operations
  // ============================================================================

  /**
   * OpenID Connect interaction operations.
   *
   * Only meaningful when this application *is* an OpenID Connect provider — one whose
   * backend runs `@nauth-toolkit/oidc-provider`. Use it to build the consent screen the
   * provider redirects to, and to remember a pending request across a login detour.
   *
   * @returns OIDCOperations instance
   *
   * @example
   * ```typescript
   * const state = await this.auth.oidc.getInteraction(uid);
   *
   * if (state.gate === 'login_required') {
   *   await this.auth.oidc.setPendingInteraction(uid);
   *   void this.router.navigate(['/login']);
   *   return;
   * }
   *
   * const { redirectTo } = await this.auth.oidc.approve(uid);
   * window.location.assign(redirectTo);   // leaves Angular; the provider takes over
   * ```
   */
  get oidc(): OIDCOperations {
    return this.client.oidc;
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

  // ============================================================================
  // reCAPTCHA Helper
  // ============================================================================

  /**
   * Get reCAPTCHA token - auto-generate for v3 or use provided token.
   *
   * Handles platform detection:
   * - Web browser: Generate token if enabled and v3
   * - Capacitor native: Skip (use device attestation instead)
   * - SSR: Skip
   * - Manual mode (v2 or manualChallenge=true): Requires explicit token
   *
   * @param providedToken - Explicitly provided token (v2 manual mode)
   * @param action - Action name for v3 analytics
   * @returns reCAPTCHA token or undefined
   *
   * @private
   */
  private async getRecaptchaToken(providedToken: string | undefined, action: string): Promise<string | undefined> {
    // If token explicitly provided, use it (v2 manual mode)
    if (providedToken) {
      return providedToken;
    }

    // No reCAPTCHA service available
    if (!this.recaptchaService) {
      return undefined;
    }

    // Check if reCAPTCHA is configured
    const recaptchaConfig = (
      this.config as { recaptcha?: { enabled?: boolean; version?: string; manualChallenge?: boolean } }
    ).recaptcha;

    if (!recaptchaConfig?.enabled) {
      return undefined;
    }

    // Skip for platforms that don't support reCAPTCHA (SSR, Capacitor native)
    if (this.recaptchaService.shouldSkip()) {
      return undefined;
    }

    // v2 or manual mode - user must provide token explicitly
    if (recaptchaConfig.version === 'v2' || recaptchaConfig.manualChallenge) {
      return undefined;
    }

    // Auto-generate token for v3/Enterprise
    try {
      return await this.recaptchaService.execute(action);
    } catch (error: unknown) {
      // Log error but don't block authentication
      // Server will enforce if required
      console.warn('[AuthService] Failed to generate reCAPTCHA token:', error);
      return undefined;
    }
  }
}
