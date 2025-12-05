import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  User,
  AuthTokens,
  LoginRequest,
  SignupRequest,
  UnifiedAuthResponse,
  AuthChallengeResponse,
  ChallengeResponseData,
  MFASetupResponse,
} from '../models/auth.models';
import { MFADeviceMethod } from '../types/mfa.types';

/**
 * Unified Authentication Service (Clean Architecture)
 *
 * Simplified service that uses the unified challenge response API.
 * All challenge types are handled through a single endpoint.
 *
 * Key Features:
 * - Single respondToChallenge() method for all challenge types
 * - Helper methods for setup data, challenge data, and resend
 * - Convenience wrappers for common operations
 * - Clean, maintainable codebase
 *
 * @example
 * ```typescript
 * // Login
 * this.authService.login(email, password).subscribe(response => {
 *   if (response.challengeName) {
 *     // Handle challenge
 *   } else {
 *     // User logged in
 *   }
 * });
 *
 * // Respond to challenge
 * this.authService.respondToChallenge({
 *   session: challengeSession,
 *   type: 'VERIFY_EMAIL',
 *   code: '123456'
 * }).subscribe();
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_BASE_URL = `${environment.apiUrl}/auth`;
  private readonly USER_KEY = 'current_user';
  private readonly CHALLENGE_KEY = 'auth_challenge';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokensSubject = new BehaviorSubject<AuthTokens | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public tokens$ = this.tokensSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeAuth();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize authentication state from localStorage
   */
  private initializeAuth(): void {
    const user = this.getStoredUser();
    if (user) {
      this.currentUserSubject.next(user);
    }

    const challenge = this.getStoredChallenge();
    if (challenge) {
      console.log('[Auth] Restored challenge session:', challenge.challengeName);
    }
  }

  // ============================================================================
  // PRIMARY FLOW
  // ============================================================================

  /**
   * User signup
   *
   * @param email - User email
   * @param password - User password
   * @param firstName - Optional first name
   * @param lastName - Optional last name
   * @param phone - Optional phone number (E.164 format)
   * @returns Auth response (tokens or challenge)
   *
   * @example
   * ```typescript
   * this.authService.signup('user@example.com', 'SecurePass123!', 'John', 'Doe', '+1234567890').subscribe(response => {
   *   if (response.challengeName === 'VERIFY_EMAIL') {
   *     // Navigate to email verification
   *   }
   * });
   * ```
   */
  signup(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string,
  ): Observable<UnifiedAuthResponse> {
    const request: SignupRequest = {
      email,
      password,
      firstName,
      lastName,
      phone,
    };
    return this.http
      .post<UnifiedAuthResponse>(`${this.API_BASE_URL}/signup`, request)
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  /**
   * User login
   *
   * @param identifier - Email or username
   * @param password - User password
   * @returns Auth response (tokens or challenge)
   *
   * @example
   * ```typescript
   * this.authService.login('user@example.com', 'SecurePass123!').subscribe(response => {
   *   if (response.challengeName === 'MFA_REQUIRED') {
   *     // Navigate to MFA verification
   *   }
   * });
   * ```
   */
  login(identifier: string, password: string): Observable<UnifiedAuthResponse> {
    const request: LoginRequest = { identifier, password };
    return this.http
      .post<UnifiedAuthResponse>(`${this.API_BASE_URL}/login`, request)
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  /**
   * Respond to authentication challenge (UNIFIED API)
   *
   * Single method for completing ANY challenge type:
   * - VERIFY_EMAIL: { session, type: 'VERIFY_EMAIL', code: '123456' }
   * - VERIFY_PHONE (collect): { session, type: 'VERIFY_PHONE', phone: '+1234567890' }
   * - VERIFY_PHONE (verify): { session, type: 'VERIFY_PHONE', code: '123456' }
   * - MFA_REQUIRED: { session, type: 'MFA_REQUIRED', method: 'totp', code: '123456' }
   * - MFA_SETUP_REQUIRED: { session, type: 'MFA_SETUP_REQUIRED', method: 'totp', setupData: {...} }
   * - FORCE_CHANGE_PASSWORD: { session, type: 'FORCE_CHANGE_PASSWORD', newPassword: '...' }
   *
   * @param response - Challenge response with type-specific data
   * @returns Auth response (tokens or next challenge)
   *
   * @example
   * ```typescript
   * // Email verification
   * this.authService.respondToChallenge({
   *   session: challengeSession,
   *   type: 'VERIFY_EMAIL',
   *   code: emailCode
   * }).subscribe();
   *
   * // MFA verification (TOTP)
   * this.authService.respondToChallenge({
   *   session: challengeSession,
   *   type: 'MFA_REQUIRED',
   *   method: 'totp',
   *   code: totpCode
   * }).subscribe();
   *
   * // MFA setup (Passkey)
   * this.authService.respondToChallenge({
   *   session: challengeSession,
   *   type: 'MFA_SETUP_REQUIRED',
   *   method: 'passkey',
   *   setupData: { credential: passkeyCredential }
   * }).subscribe();
   * ```
   */
  respondToChallenge(response: ChallengeResponseData): Observable<UnifiedAuthResponse> {
    return this.http
      .post<UnifiedAuthResponse>(`${this.API_BASE_URL}/respond-challenge`, response)
      .pipe(tap((result) => this.handleAuthResponse(result)));
  }

  /**
   * Refresh access token
   *
   * @param refreshToken - Refresh token
   * @returns New token pair
   */
  refreshToken(refreshToken: string): Observable<AuthTokens> {
    return this.http
      .post<{
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresAt: number;
        refreshTokenExpiresAt: number;
      }>(`${this.API_BASE_URL}/refresh`, { refreshToken })
      .pipe(
        map(
          (response: {
            accessToken: string;
            refreshToken: string;
            accessTokenExpiresAt: number;
            refreshTokenExpiresAt: number;
          }) => {
            // Transform backend TokenResponse to frontend AuthTokens format
            const now = Date.now();
            const expiresAt = response.accessTokenExpiresAt * 1000; // Convert seconds to milliseconds
            const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000)); // Calculate seconds until expiry

            return {
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
              expiresIn,
              expiresAt,
            };
          },
        ),
        tap((tokens) => this.storeTokens(tokens)),
      );
  }

  /**
   * User logout
   *
   * @param forgetMe - If true, clears device trust
   */
  logout(forgetMe: boolean = false): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/logout`, { forgetMe }).pipe(
      tap(() => {
        this.clearAuth();
      }),
    );
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get MFA setup data during MFA_SETUP_REQUIRED challenge
   *
   * Returns provider-specific setup data:
   * - TOTP: { secret, qrCode, manualEntryKey }
   * - SMS: { phone } (masked)
   * - Passkey: WebAuthn registration options
   *
   * @param session - Challenge session token
   * @param method - MFA method to set up
   * @returns Setup data
   *
   * @example
   * ```typescript
   * // Get TOTP setup data
   * this.authService.getSetupData(session, 'totp').subscribe(data => {
   *   this.qrCode = data.qrCode;
   *   this.secret = data.secret;
   * });
   * ```
   */
  getSetupData(session: string, method: MFADeviceMethod): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}/challenge/setup-data`, { session, method });
  }

  /**
   * Get MFA challenge data during MFA_REQUIRED challenge
   *
   * Currently only used for passkey to get WebAuthn authentication options.
   *
   * @param session - Challenge session token
   * @param method - MFA method (currently only 'passkey')
   * @returns Challenge data (WebAuthn options)
   *
   * @example
   * ```typescript
   * // Get passkey authentication options
   * this.authService.getChallengeData(session, 'passkey').subscribe(options => {
   *   const credential = await navigator.credentials.get({ publicKey: options });
   * });
   * ```
   */
  getChallengeData(session: string, method: 'passkey'): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}/challenge/challenge-data`, { session, method });
  }

  /**
   * Get MFA setup data for authenticated user (protected endpoint)
   *
   * Used when authenticated users want to add MFA devices from dashboard.
   * Different from challenge-based setup which is used during login/signup.
   *
   * @param method - MFA method to set up
   * @returns Setup data (provider-specific)
   *
   * @example
   * ```typescript
   * // Get TOTP setup data
   * this.authService.getMFASetupDataForUser('totp').subscribe(data => {
   *   this.qrCode = data.qrCode;
   *   this.secret = data.secret;
   * });
   * ```
   */
  getMFASetupDataForUser(method: MFADeviceMethod): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}/mfa/setup-data`, { method });
  }

  /**
   * Verify and complete MFA setup for authenticated user (protected endpoint)
   *
   * Used when authenticated users are completing MFA setup from dashboard.
   *
   * @param method - MFA method being set up
   * @param setupData - Verification data (method-specific)
   * @param deviceName - Optional device name
   * @returns Success response with device ID and optional backup codes
   *
   * @example
   * ```typescript
   * // Verify TOTP setup
   * this.authService.verifyMFASetupForUser('totp', {
   *   secret: 'base32secret',
   *   code: '123456'
   * }, 'My Phone').subscribe(response => {
   *   if (response.backupCodes) {
   *     // Show backup codes
   *   }
   * });
   * ```
   */
  verifyMFASetupForUser(
    method: MFADeviceMethod,
    setupData: Record<string, unknown>,
    deviceName?: string,
  ): Observable<{ deviceId: number; backupCodes?: string[] }> {
    return this.http.post<{ deviceId: number; backupCodes?: string[] }>(
      `${this.API_BASE_URL}/mfa/verify-setup`,
      {
        method,
        setupData,
        deviceName,
      },
    );
  }

  /**
   * Resend verification code for current challenge
   *
   * Works for:
   * - VERIFY_EMAIL: Resends email verification code
   * - VERIFY_PHONE: Resends SMS verification code
   * - MFA_REQUIRED (SMS only): Resends SMS MFA code
   *
   * @param session - Challenge session token
   * @returns Destination info (masked email/phone)
   *
   * @example
   * ```typescript
   * this.authService.resendCode(session).subscribe(result => {
   *   console.log(`Code resent to: ${result.destination}`);
   * });
   * ```
   */
  resendCode(session: string): Observable<{ destination: string }> {
    return this.http.post<{ destination: string }>(`${this.API_BASE_URL}/challenge/resend`, {
      session,
    });
  }

  // ============================================================================
  // CONVENIENCE WRAPPERS (Optional - for cleaner component code)
  // ============================================================================

  /**
   * Verify email with code
   * Convenience wrapper for respondToChallenge
   */
  verifyEmail(session: string, code: string): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({ session, type: 'VERIFY_EMAIL', code });
  }

  /**
   * Collect phone number
   * Convenience wrapper for respondToChallenge
   */
  collectPhone(session: string, phone: string): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({ session, type: 'VERIFY_PHONE', phone });
  }

  /**
   * Verify phone with code
   * Convenience wrapper for respondToChallenge
   */
  verifyPhone(session: string, code: string): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({ session, type: 'VERIFY_PHONE', code });
  }

  /**
   * Verify MFA with code (SMS/Email/TOTP/Backup)
   * Convenience wrapper for respondToChallenge
   */
  verifyMFA(
    session: string,
    method: 'sms' | 'email' | 'totp' | 'backup',
    code: string,
  ): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({ session, type: 'MFA_REQUIRED', method, code });
  }

  /**
   * Verify MFA with passkey
   * Convenience wrapper for respondToChallenge
   */
  verifyMFAPasskey(
    session: string,
    credential: Record<string, unknown>,
  ): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({
      session,
      type: 'MFA_REQUIRED',
      method: 'passkey',
      credential,
    });
  }

  /**
   * Change password (forced)
   * Convenience wrapper for respondToChallenge
   */
  changePassword(session: string, newPassword: string): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({ session, type: 'FORCE_CHANGE_PASSWORD', newPassword });
  }

  /**
   * Setup MFA device
   * Convenience wrapper for respondToChallenge
   */
  setupMFA(
    session: string,
    method: MFADeviceMethod,
    setupData: Record<string, unknown>,
  ): Observable<UnifiedAuthResponse> {
    return this.respondToChallenge({
      session,
      type: 'MFA_SETUP_REQUIRED',
      method,
      setupData,
    } as MFASetupResponse);
  }

  // ============================================================================
  // AUTHENTICATION STATE MANAGEMENT
  // ============================================================================

  /**
   * Handle auth response (tokens or challenge)
   *
   * Updates local state based on response type:
   * - If challenge: Store challenge session
   * - If success: Store user and tokens, clear challenge
   */
  private handleAuthResponse(response: UnifiedAuthResponse): void {
    if (this.isChallenge(response)) {
      // Store challenge for later use
      this.storeChallenge(response as AuthChallengeResponse);
      console.log('[Auth] Challenge received:', response.challengeName);
    } else if (response.user) {
      // Authentication complete
      this.storeUser(response.user);
      if (response.accessToken) {
        this.storeTokens({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken || '',
          expiresIn: response.accessTokenExpiresAt
            ? Math.floor((response.accessTokenExpiresAt * 1000 - Date.now()) / 1000)
            : 0,
          expiresAt: response.accessTokenExpiresAt ? response.accessTokenExpiresAt * 1000 : 0,
        });
      }
      this.clearChallenge();
      console.log('[Auth] Authentication successful');
    }
  }

  /**
   * Check if response is a challenge
   */
  private isChallenge(response: UnifiedAuthResponse): boolean {
    return 'challengeName' in response && !!response.challengeName;
  }

  /**
   * Store challenge session
   */
  storeChallenge(challenge: AuthChallengeResponse): void {
    localStorage.setItem(this.CHALLENGE_KEY, JSON.stringify(challenge));
  }

  /**
   * Get stored challenge session
   */
  getStoredChallenge(): AuthChallengeResponse | null {
    const challenge = localStorage.getItem(this.CHALLENGE_KEY);
    return challenge ? JSON.parse(challenge) : null;
  }

  /**
   * Clear stored challenge
   */
  clearChallenge(): void {
    localStorage.removeItem(this.CHALLENGE_KEY);
  }

  /**
   * Store tokens
   */
  private storeTokens(tokens: AuthTokens): void {
    this.tokensSubject.next(tokens);
  }

  /**
   * Store user
   */
  private storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  /**
   * Get stored user
   */
  private getStoredUser(): User | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Clear all auth data
   */
  clearAuth(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.CHALLENGE_KEY);
    this.currentUserSubject.next(null);
    this.tokensSubject.next(null);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current tokens
   */
  getTokens(): AuthTokens | null {
    return this.tokensSubject.value;
  }

  /**
   * Get device token from localStorage
   */
  getDeviceToken(): string | null {
    return localStorage.getItem('device_token');
  }

  /**
   * Load user profile from server
   */
  loadUserProfile(): Observable<User> {
    return this.http.get<User>(`${this.API_BASE_URL}/profile`).pipe(
      tap((user) => {
        this.storeUser(user);
      }),
    );
  }

  /**
   * Update user profile
   */
  updateProfile(updates: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.API_BASE_URL}/profile`, updates).pipe(
      tap((user) => {
        this.storeUser(user);
      }),
    );
  }

  /**
   * Change user password
   */
  changeUserPassword(oldPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/change-password`, {
      oldPassword,
      newPassword,
    });
  }

  /**
   * Request password change (admin)
   */
  requestPasswordChange(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/request-password-change`, {});
  }

  /**
   * Global logout (all sessions)
   */
  globalLogout(): Observable<{ message: string; sessionsRevoked: number }> {
    return this.http
      .post<{ message: string; sessionsRevoked: number }>(`${this.API_BASE_URL}/logout/all`, {})
      .pipe(
        tap(() => {
          this.clearAuth();
        }),
      );
  }

  /**
   * Trust current device (opt-in)
   */
  trustDevice(): Observable<{ deviceToken: string }> {
    return this.http.post<{ deviceToken: string }>(`${this.API_BASE_URL}/trust-device`, {});
  }

  // ============================================================================
  // MFA MANAGEMENT
  // ============================================================================

  /**
   * Get MFA status
   */
  getMFAStatus(): Observable<{
    enabled: boolean;
    required: boolean;
    methods: string[];
    availableMethods: string[];
    hasBackupCodes: boolean;
    preferredMethod?: string;
    mfaExempt: boolean;
    mfaExemptReason: string | null;
    mfaExemptGrantedAt: Date | null;
  }> {
    return this.http.get<{
      enabled: boolean;
      required: boolean;
      methods: string[];
      availableMethods: string[];
      hasBackupCodes: boolean;
      preferredMethod?: string;
      mfaExempt: boolean;
      mfaExemptReason: string | null;
      mfaExemptGrantedAt: Date | null;
    }>(`${this.API_BASE_URL}/mfa/status`);
  }

  /**
   * Get MFA devices
   */
  getMFADevices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE_URL}/mfa/devices`);
  }

  /**
   * Set preferred MFA method
   */
  setPreferredMFAMethod(method: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/mfa/preferred-method`, {
      method,
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(): Observable<{ codes: string[] }> {
    return this.http.post<{ codes: string[] }>(
      `${this.API_BASE_URL}/mfa/backup-codes/generate`,
      {},
    );
  }

  /**
   * Remove MFA method
   */
  removeMFAMethod(method: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_BASE_URL}/mfa/method/${method}`);
  }

  /**
   * Set MFA exemption (admin)
   */
  setMFAExemption(exempt: boolean, reason?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/mfa/exemption`, {
      exempt,
      reason,
    });
  }

  // ============================================================================
  // SOCIAL AUTH
  // ============================================================================

  /**
   * Get social auth URL
   */
  getSocialAuthUrl(request: { provider: string }): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.API_BASE_URL}/social/auth-url`, request);
  }

  /**
   * Handle social callback
   */
  handleSocialCallback(params: {
    provider: string;
    code: string;
    state: string;
  }): Observable<UnifiedAuthResponse> {
    return this.http.post<UnifiedAuthResponse>(`${this.API_BASE_URL}/social/callback`, params).pipe(
      tap((response) => {
        this.handleAuthResponse(response);
      }),
    );
  }

  /**
   * Sign in with social provider (redirect)
   */
  async signInWithSocial(provider: string): Promise<void> {
    this.getSocialAuthUrl({ provider }).subscribe((response) => {
      window.location.href = response.url;
    });
  }

  /**
   * Link social account
   */
  linkSocialAccount(params: {
    provider: string;
    code: string;
    state: string;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/social/link`, params);
  }

  /**
   * Unlink social account
   */
  unlinkSocialAccount(params: { provider: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_BASE_URL}/social/unlink`, params);
  }

  /**
   * Get linked accounts
   */
  getLinkedAccounts(): Observable<{ providers: string[] }> {
    return this.http.get<{ providers: string[] }>(`${this.API_BASE_URL}/social/linked`);
  }

  // ============================================================================
  // AUDIT
  // ============================================================================

  /**
   * Get audit history
   */
  getAuditHistory(params?: any): Observable<any> {
    return this.http.get(`${this.API_BASE_URL}/audit/history`, { params });
  }
}
