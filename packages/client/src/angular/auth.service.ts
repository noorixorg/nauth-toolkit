import { Inject, Injectable, Optional, inject } from '@angular/core';
import { BehaviorSubject, from, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AngularHttpAdapter } from './http-adapter';
import { NAuthClient } from '../core/client';
import { NAuthClientConfig } from '../types/config.types';
import { ChallengeResponse, AuthResponse, TokenResponse } from '../types/auth.types';
import { AuthUser, ConfirmForgotPasswordResponse, ForgotPasswordResponse } from '../types/user.types';
import { GetChallengeDataResponse, GetSetupDataResponse } from '../types/mfa.types';
import { AuthEvent } from '../core/events';
import { SocialProvider } from '../types/social.types';

/**
 * Angular wrapper around NAuthClient that exposes Observables for auth state.
 *
 * Design philosophy: Keep lean, use getClient() for full API access.
 * This service provides:
 * - Reactive state (currentUser$, isAuthenticated$, challenge$)
 * - Core auth methods as Observables (login, signup, logout, refresh)
 * - Challenge flow methods (respondToChallenge, resendCode)
 * - Escape hatch via getClient() for all other operations
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
 * // Advanced operations via client
 * this.auth.getClient().getMfaStatus().then(status => ...);
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
   * Redirects to OAuth provider with automatic state management.
   */
  loginWithSocial(provider: SocialProvider, options?: { redirectUri?: string }): Promise<void> {
    return this.client.loginWithSocial(provider, options);
  }

  /**
   * Get social auth URL to redirect user for OAuth (low-level API).
   */
  getSocialAuthUrl(provider: string, redirectUri?: string): Observable<{ url: string }> {
    return from(
      this.client.getSocialAuthUrl({ provider, redirectUri } as Parameters<NAuthClient['getSocialAuthUrl']>[0]),
    );
  }

  /**
   * Handle social auth callback (low-level API).
   */
  handleSocialCallback(provider: string, code: string, state: string): Observable<AuthResponse> {
    return from(
      this.client
        .handleSocialCallback({ provider, code, state } as Parameters<NAuthClient['handleSocialCallback']>[0])
        .then((res) => this.updateChallengeState(res)),
    );
  }

  // ============================================================================
  // Escape Hatch
  // ============================================================================

  /**
   * Expose underlying NAuthClient for advanced scenarios.
   *
   * Use this for operations not directly exposed by this service:
   * - Profile management (getProfile, updateProfile)
   * - MFA management (getMfaStatus, setupMfaDevice, etc.)
   * - Social account linking (linkSocialAccount, unlinkSocialAccount)
   * - Audit history (getAuditHistory)
   * - Device trust (trustDevice)
   *
   * @example
   * ```typescript
   * // Get MFA status
   * const status = await this.auth.getClient().getMfaStatus();
   *
   * // Update profile
   * const user = await this.auth.getClient().updateProfile({ firstName: 'John' });
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
