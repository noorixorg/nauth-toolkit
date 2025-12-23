import { Inject, Injectable, Optional, inject } from '@angular/core';
import { BehaviorSubject, from, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AngularHttpAdapter } from './http-adapter';
import { NAuthClient } from '../core/client';
import { NAuthClientConfig } from '../types/config.types';
import { ChallengeResponse, AuthResponse, TokenResponse } from '../types/auth.types';
import {
  AuthUser,
  ConfirmForgotPasswordResponse,
  ForgotPasswordResponse,
  UpdateProfileRequest,
} from '../types/user.types';
import { GetChallengeDataResponse, GetSetupDataResponse, MFAStatus, MFADevice } from '../types/mfa.types';
import { AuthEvent } from '../core/events';
import { SocialProvider, SocialLoginOptions, LinkedAccountsResponse, SocialVerifyRequest } from '../types/social.types';
import { AuditHistoryResponse } from '../types/audit.types';

/**
 * Angular wrapper around NAuthClient that exposes Observables for auth state.
 *
 * This service provides:
 * - Reactive state (currentUser$, isAuthenticated$, challenge$)
 * - All core auth methods as Observables (login, signup, logout, refresh)
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
 * // Auth operations
 * this.auth.login(email, password).subscribe(response => ...);
 *
 * // Profile management
 * this.auth.changePassword(oldPassword, newPassword).subscribe(() => ...);
 * this.auth.updateProfile({ firstName: 'John' }).subscribe(user => ...);
 *
 * // MFA operations
 * this.auth.getMfaStatus().subscribe(status => ...);
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly client: NAuthClient;
  private readonly config: NAuthClientConfig;
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly challengeSubject = new BehaviorSubject<AuthResponse | null>(null);
  private readonly authEventsSubject = new Subject<AuthEvent>();
  private initialized = false;

  /**
   * @param config - Injected client configuration
   *
   * Note: AngularHttpAdapter is automatically injected via Angular DI.
   * This ensures all requests go through Angular's HttpClient and interceptors.
   */
  constructor(@Optional() @Inject(NAUTH_CLIENT_CONFIG) config?: NAuthClientConfig) {
    if (!config) {
      throw new Error('NAUTH_CLIENT_CONFIG is required to initialize AuthService');
    }

    this.config = config;

    // Auto-inject AngularHttpAdapter (or use provided one)
    const httpAdapter = config.httpAdapter ?? inject(AngularHttpAdapter);

    this.client = new NAuthClient({
      ...config,
      httpAdapter, // Automatically use Angular's HttpClient
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

  // ============================================================================
  // Core Auth Methods (Observable wrappers)
  // ============================================================================

  /**
   * Login with identifier and password.
   */
  login(identifier: string, password: string): Observable<AuthResponse> {
    return from(this.client.login(identifier, password).then((res) => this.updateChallengeState(res)));
  }

  /**
   * Signup with credentials.
   */
  signup(payload: Parameters<NAuthClient['signup']>[0]): Observable<AuthResponse> {
    return from(this.client.signup(payload).then((res) => this.updateChallengeState(res)));
  }

  /**
   * Logout current session.
   */
  logout(forgetDevice?: boolean): Observable<void> {
    return from(
      this.client.logout(forgetDevice).then(() => {
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
      }),
    );
  }

  /**
   * Logout all sessions.
   *
   * Revokes all active sessions for the current user across all devices.
   * Optionally revokes all trusted devices if forgetDevices is true.
   *
   * @param forgetDevices - If true, also revokes all trusted devices (default: false)
   * @returns Observable with number of sessions revoked
   */
  logoutAll(forgetDevices?: boolean): Observable<{ revokedCount: number }> {
    return from(
      this.client.logoutAll(forgetDevices).then((res) => {
        this.challengeSubject.next(null);
        // Explicitly update auth state after logout
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        return res;
      }),
    );
  }

  /**
   * Refresh tokens.
   */
  refresh(): Observable<TokenResponse> {
    return from(this.client.refreshTokens());
  }

  /**
   * Refresh tokens (promise-based).
   *
   * Returns a promise instead of an Observable, matching the core NAuthClient API.
   * Useful for async/await patterns in guards and interceptors.
   *
   * @returns Promise of TokenResponse
   *
   * @example
   * ```typescript
   * const tokens = await auth.refreshTokensPromise();
   * ```
   */
  refreshTokensPromise(): Promise<TokenResponse> {
    return this.client.refreshTokens();
  }

  // ============================================================================
  // Account Recovery (Forgot Password)
  // ============================================================================

  /**
   * Request a password reset code (forgot password).
   */
  forgotPassword(identifier: string): Observable<ForgotPasswordResponse> {
    return from(this.client.forgotPassword(identifier));
  }

  /**
   * Confirm a password reset code and set a new password.
   */
  confirmForgotPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Observable<ConfirmForgotPasswordResponse> {
    return from(this.client.confirmForgotPassword(identifier, code, newPassword));
  }

  /**
   * Change user password (requires current password).
   *
   * @param oldPassword - Current password
   * @param newPassword - New password (must meet requirements)
   * @returns Observable that completes when password is changed
   *
   * @example
   * ```typescript
   * this.auth.changePassword('oldPassword123', 'newSecurePassword456!').subscribe({
   *   next: () => console.log('Password changed successfully'),
   *   error: (err) => console.error('Failed to change password:', err)
   * });
   * ```
   */
  changePassword(oldPassword: string, newPassword: string): Observable<void> {
    return from(this.client.changePassword(oldPassword, newPassword));
  }

  /**
   * Request password change (must change on next login).
   *
   * @returns Observable that completes when request is sent
   */
  requestPasswordChange(): Observable<void> {
    return from(this.client.requestPasswordChange());
  }

  // ============================================================================
  // Profile Management
  // ============================================================================

  /**
   * Get current user profile.
   *
   * @returns Observable of current user profile
   *
   * @example
   * ```typescript
   * this.auth.getProfile().subscribe(user => {
   *   console.log('User profile:', user);
   * });
   * ```
   */
  getProfile(): Observable<AuthUser> {
    return from(
      this.client.getProfile().then((user) => {
        // Update local state when profile is fetched
        this.currentUserSubject.next(user);
        return user;
      }),
    );
  }

  /**
   * Get current user profile (promise-based).
   *
   * Returns a promise instead of an Observable, matching the core NAuthClient API.
   * Useful for async/await patterns in guards and interceptors.
   *
   * @returns Promise of current user profile
   *
   * @example
   * ```typescript
   * const user = await auth.getProfilePromise();
   * ```
   */
  getProfilePromise(): Promise<AuthUser> {
    return this.client.getProfile().then((user) => {
      // Update local state when profile is fetched
      this.currentUserSubject.next(user);
      return user;
    });
  }

  /**
   * Update user profile.
   *
   * @param updates - Profile fields to update
   * @returns Observable of updated user profile
   *
   * @example
   * ```typescript
   * this.auth.updateProfile({ firstName: 'John', lastName: 'Doe' }).subscribe(user => {
   *   console.log('Profile updated:', user);
   * });
   * ```
   */
  updateProfile(updates: UpdateProfileRequest): Observable<AuthUser> {
    return from(
      this.client.updateProfile(updates).then((user) => {
        // Update local state when profile is updated
        this.currentUserSubject.next(user);
        return user;
      }),
    );
  }

  // ============================================================================
  // Challenge Flow Methods (Essential for any auth flow)
  // ============================================================================

  /**
   * Respond to a challenge (VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, etc.).
   */
  respondToChallenge(response: ChallengeResponse): Observable<AuthResponse> {
    return from(this.client.respondToChallenge(response).then((res) => this.updateChallengeState(res)));
  }

  /**
   * Resend challenge code.
   */
  resendCode(session: string): Observable<{ destination: string }> {
    return from(this.client.resendCode(session));
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
   * @returns Observable of setup data response
   */
  getSetupData(session: string, method: string): Observable<GetSetupDataResponse> {
    return from(this.client.getSetupData(session, method as Parameters<NAuthClient['getSetupData']>[1]));
  }

  /**
   * Get MFA challenge data (for MFA_REQUIRED challenge - e.g., passkey options).
   *
   * @param session - Challenge session token
   * @param method - Challenge method
   * @returns Observable of challenge data response
   */
  getChallengeData(session: string, method: string): Observable<GetChallengeDataResponse> {
    return from(this.client.getChallengeData(session, method as Parameters<NAuthClient['getChallengeData']>[1]));
  }

  /**
   * Clear stored challenge (when navigating away from challenge flow).
   */
  clearChallenge(): Observable<void> {
    return from(
      this.client.clearStoredChallenge().then(() => {
        this.challengeSubject.next(null);
      }),
    );
  }

  // ============================================================================
  // Social Authentication
  // ============================================================================

  /**
   * Initiate social OAuth login flow.
   * Redirects the browser to backend `/auth/social/:provider/redirect`.
   */
  loginWithSocial(provider: SocialProvider, options?: SocialLoginOptions): Promise<void> {
    return this.client.loginWithSocial(provider, options);
  }

  /**
   * Exchange an exchangeToken (from redirect callback URL) into an AuthResponse.
   *
   * Used for `tokenDelivery: 'json'` or hybrid flows where the backend redirects back
   * with `exchangeToken` instead of setting cookies.
   *
   * @param exchangeToken - One-time exchange token from the callback URL
   * @returns Observable of AuthResponse
   */
  exchangeSocialRedirect(exchangeToken: string): Observable<AuthResponse> {
    return from(this.client.exchangeSocialRedirect(exchangeToken).then((res) => this.updateChallengeState(res)));
  }

  /**
   * Exchange an exchangeToken (from redirect callback URL) into an AuthResponse (promise-based).
   *
   * Returns a promise instead of an Observable, matching the core NAuthClient API.
   * Useful for async/await patterns in guards and interceptors.
   *
   * @param exchangeToken - One-time exchange token from the callback URL
   * @returns Promise of AuthResponse
   *
   * @example
   * ```typescript
   * const response = await auth.exchangeSocialRedirectPromise(exchangeToken);
   * ```
   */
  exchangeSocialRedirectPromise(exchangeToken: string): Promise<AuthResponse> {
    return this.client.exchangeSocialRedirect(exchangeToken).then((res) => this.updateChallengeState(res));
  }

  /**
   * Verify native social token (mobile).
   *
   * @param request - Social verification request with provider and token
   * @returns Observable of AuthResponse
   */
  verifyNativeSocial(request: SocialVerifyRequest): Observable<AuthResponse> {
    return from(this.client.verifyNativeSocial(request).then((res) => this.updateChallengeState(res)));
  }

  /**
   * Get linked social accounts.
   *
   * @returns Observable of linked accounts response
   */
  getLinkedAccounts(): Observable<LinkedAccountsResponse> {
    return from(this.client.getLinkedAccounts());
  }

  /**
   * Link social account.
   *
   * @param provider - Social provider to link
   * @param code - OAuth authorization code
   * @param state - OAuth state parameter
   * @returns Observable with success message
   */
  linkSocialAccount(provider: string, code: string, state: string): Observable<{ message: string }> {
    return from(this.client.linkSocialAccount(provider, code, state));
  }

  /**
   * Unlink social account.
   *
   * @param provider - Social provider to unlink
   * @returns Observable with success message
   */
  unlinkSocialAccount(provider: string): Observable<{ message: string }> {
    return from(this.client.unlinkSocialAccount(provider));
  }

  // ============================================================================
  // MFA Management
  // ============================================================================

  /**
   * Get MFA status for the current user.
   *
   * @returns Observable of MFA status
   */
  getMfaStatus(): Observable<MFAStatus> {
    return from(this.client.getMfaStatus());
  }

  /**
   * Get MFA devices for the current user.
   *
   * @returns Observable of MFA devices array
   */
  getMfaDevices(): Observable<MFADevice[]> {
    return from(this.client.getMfaDevices() as Promise<MFADevice[]>);
  }

  /**
   * Setup MFA device (authenticated user).
   *
   * @param method - MFA method to set up
   * @returns Observable of setup data
   */
  setupMfaDevice(method: string): Observable<unknown> {
    return from(this.client.setupMfaDevice(method));
  }

  /**
   * Verify MFA setup (authenticated user).
   *
   * @param method - MFA method
   * @param setupData - Setup data from setupMfaDevice
   * @param deviceName - Optional device name
   * @returns Observable with device ID
   */
  verifyMfaSetup(
    method: string,
    setupData: Record<string, unknown>,
    deviceName?: string,
  ): Observable<{ deviceId: number }> {
    return from(this.client.verifyMfaSetup(method, setupData, deviceName));
  }

  /**
   * Remove MFA device.
   *
   * @param method - MFA method to remove
   * @returns Observable with success message
   */
  removeMfaDevice(method: string): Observable<{ message: string }> {
    return from(this.client.removeMfaDevice(method));
  }

  /**
   * Set preferred MFA method.
   *
   * @param method - Device method to set as preferred ('totp', 'sms', 'email', or 'passkey')
   * @returns Observable with success message
   */
  setPreferredMfaMethod(method: 'totp' | 'sms' | 'email' | 'passkey'): Observable<{ message: string }> {
    return from(this.client.setPreferredMfaMethod(method));
  }

  /**
   * Generate backup codes.
   *
   * @returns Observable of backup codes array
   */
  generateBackupCodes(): Observable<string[]> {
    return from(this.client.generateBackupCodes());
  }

  /**
   * Set MFA exemption (admin/test scenarios).
   *
   * @param exempt - Whether to exempt user from MFA
   * @param reason - Optional reason for exemption
   * @returns Observable that completes when exemption is set
   */
  setMfaExemption(exempt: boolean, reason?: string): Observable<void> {
    return from(this.client.setMfaExemption(exempt, reason));
  }

  // ============================================================================
  // Device Trust
  // ============================================================================

  /**
   * Trust current device.
   *
   * @returns Observable with device token
   */
  trustDevice(): Observable<{ deviceToken: string }> {
    return from(this.client.trustDevice());
  }

  /**
   * Check if the current device is trusted.
   *
   * @returns Observable with trusted status
   */
  isTrustedDevice(): Observable<{ trusted: boolean }> {
    return from(this.client.isTrustedDevice());
  }

  // ============================================================================
  // Audit History
  // ============================================================================

  /**
   * Get paginated audit history for the current user.
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Observable of audit history response
   *
   * @example
   * ```typescript
   * this.auth.getAuditHistory({ page: 1, limit: 20, eventType: 'LOGIN_SUCCESS' }).subscribe(history => {
   *   console.log('Audit history:', history);
   * });
   * ```
   */
  getAuditHistory(params?: Record<string, string | number | boolean>): Observable<AuditHistoryResponse> {
    return from(this.client.getAuditHistory(params));
  }

  // ============================================================================
  // Escape Hatch
  // ============================================================================

  /**
   * Expose underlying NAuthClient for advanced scenarios.
   *
   * @deprecated All core functionality is now exposed directly on AuthService as Observables.
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
   * // Preferred - use Observable-based methods
   * this.auth.getMfaStatus().subscribe(status => ...);
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
