import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client/angular';
import { AuthChallenge, AuthResponse, MFAMethod, NAuthClientConfig } from '@nauth-toolkit/client';

/**
 * Challenge Orchestrator Service
 *
 * Reference implementation for handling authentication challenges in route-based apps.
 * Demonstrates elegant challenge orchestration using nauth's unified challenge system.
 *
 * This service shows how to:
 * - Handle all challenge types from login, signup, and social flows
 * - Route to appropriate components based on challenge type
 * - Support MFA method selection and switching
 * - Handle progressive challenges (email → phone → MFA setup → MFA verify)
 * - Manage success/error redirects
 *
 * Apps using dialogs or inline components can adapt this pattern by replacing
 * router.navigate() calls with dialog.open() or component switching logic.
 *
 * @example
 * ```typescript
 * // After login
 * this.auth.login(email, password).subscribe(response => {
 *   this.orchestrator.handleAuthResponse(response);
 * });
 *
 * // After challenge completion
 * this.auth.respondToChallenge(challengeResponse).subscribe(response => {
 *   this.orchestrator.handleAuthResponse(response);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ChallengeOrchestratorService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly config = inject<NAuthClientConfig>(NAUTH_CLIENT_CONFIG);

  /**
   * Get the appropriate route for the current challenge.
   *
   * @param selectedMethod - User-selected MFA method (overrides backend preference)
   * @returns Route path or null if no challenge
   */
  getChallengeRoute(selectedMethod?: MFAMethod): string | null {
    const challenge = this.auth.getCurrentChallenge();
    if (!challenge?.challengeName) {
      return null;
    }

    const challengeName = challenge.challengeName;
    const challengeBase = this.config.redirects?.challengeBase || '/auth/challenge';

    // Special handling for MFA_REQUIRED
    if (challengeName === AuthChallenge.MFA_REQUIRED) {
      return this.getMFARoute(challenge, selectedMethod, challengeBase);
    }

    // Special handling for MFA_SETUP_REQUIRED
    if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      return `${challengeBase}/mfa-setup-required`;
    }

    // Generic challenge route (VERIFY_EMAIL, VERIFY_PHONE, FORCE_CHANGE_PASSWORD, etc.)
    const challengeRoute = challengeName.toLowerCase().replace(/_/g, '-');
    return `${challengeBase}/${challengeRoute}`;
  }

  /**
   * Universal handler for authentication responses.
   *
   * Works for all flows:
   * - Login (email/password or social)
   * - Signup
   * - Progressive challenges (email → phone → MFA setup → MFA verify)
   * - OAuth callback
   *
   * Determines next action based on response:
   * - No challenge → Navigate to success URL
   * - Challenge present → Navigate to appropriate challenge handler
   *
   * @param response - Auth response from any auth operation
   * @returns Promise that resolves when navigation completes
   *
   * @example
   * ```typescript
   * // Login
   * this.auth.login(email, password).subscribe(response => {
   *   this.orchestrator.handleAuthResponse(response);
   * });
   *
   * // Signup
   * this.auth.signup(data).subscribe(response => {
   *   this.orchestrator.handleAuthResponse(response);
   * });
   *
   * // After challenge
   * this.auth.respondToChallenge(challengeResponse).subscribe(response => {
   *   this.orchestrator.handleAuthResponse(response);
   * });
   * ```
   */
  async handleAuthResponse(response: AuthResponse): Promise<void> {
    if (!response.challengeName) {
      // Authentication complete - no challenges
      const successUrl = this.config.redirects?.success || '/';
      await this.router.navigate([successUrl]);
      return;
    }

    // Challenge present - navigate to challenge handler
    await this.navigateToChallenge();
  }

  /**
   * Navigate to the appropriate challenge route.
   *
   * @param selectedMethod - User-selected MFA method
   * @param queryParams - Additional query parameters
   * @returns Promise that resolves when navigation completes
   */
  async navigateToChallenge(
    selectedMethod?: MFAMethod,
    queryParams?: Record<string, string>,
  ): Promise<boolean> {
    const route = this.getChallengeRoute(selectedMethod);
    if (!route) {
      return this.router.navigate(['/login']);
    }

    const extras = queryParams ? { queryParams } : undefined;
    return this.router.navigate([route], extras);
  }

  /**
   * Determine MFA route based on method and parameters.
   *
   * Handles:
   * - Passkey auto-launch (when preferred)
   * - Method selection (when multiple methods available)
   * - Fallback to OTP for SMS/Email/TOTP
   *
   * @private
   */
  private getMFARoute(
    challenge: AuthResponse,
    selectedMethod: MFAMethod | undefined,
    challengeBase: string,
  ): string {
    const params = challenge.challengeParameters;

    // If user selected a specific method (for example, switched from passkey to SMS),
    // honour that choice explicitly.
    if (selectedMethod) {
      if (selectedMethod === 'passkey') {
        return `${challengeBase}/mfa-required/passkey`;
      }
      // For SMS/Email/TOTP - use OTP component with method param
      return `${challengeBase}/mfa-required`;
    }

    // Backend's preferred method (may be absent)
    const preferredMethod = (params?.['preferredMethod'] || params?.['method']) as
      | MFAMethod
      | undefined;

    // If no preferred method, user must choose from selector
    if (!preferredMethod) {
      return `${challengeBase}/mfa-selector`;
    }

    // Passkey is preferred - auto-launch dedicated route
    if (preferredMethod === 'passkey') {
      return `${challengeBase}/mfa-required/passkey`;
    }

    // Preferred method is an OTP-based one (SMS/Email/TOTP).
    // Per MFA flow spec, we should go directly to verification for the preferred
    // method and let the user explicitly switch if they want another method.
    // The actual method used (email vs SMS) is derived inside the OTP component
    // from the challenge parameters and/or query params.
    return `${challengeBase}/mfa-required`;
  }

  /**
   * Check if the current route is correct for the active challenge.
   * Used by guards to prevent component flash.
   *
   * @param currentPath - Current route path
   * @param selectedMethod - User-selected method (from query params)
   * @returns True if route is correct, false if redirect needed
   */
  isCorrectRouteForChallenge(currentPath: string, selectedMethod?: MFAMethod): boolean {
    const expectedRoute = this.getChallengeRoute(selectedMethod);
    if (!expectedRoute) {
      return false;
    }

    // Normalize paths for comparison
    const normalizedCurrent = currentPath.replace(/^\//, '').replace(/\/$/, '');
    const normalizedExpected = expectedRoute.replace(/^\//, '').replace(/\/$/, '');

    return normalizedCurrent === normalizedExpected;
  }

  /**
   * Get available MFA methods for current challenge.
   *
   * @returns Array of available MFA methods
   */
  getAvailableMFAMethods(): MFAMethod[] {
    const challenge = this.auth.getCurrentChallenge();
    if (!challenge?.challengeParameters) {
      return [];
    }
    return (challenge.challengeParameters['availableMethods'] || []) as MFAMethod[];
  }

  /**
   * Check if MFA method switching is allowed for current challenge.
   *
   * @returns True if user can switch to a different MFA method
   */
  canSwitchMFAMethod(): boolean {
    const challenge = this.auth.getCurrentChallenge();
    if (challenge?.challengeName !== AuthChallenge.MFA_REQUIRED) {
      return false;
    }
    const methods = this.getAvailableMFAMethods();
    return methods.length > 1;
  }

  /**
   * Handle MFA method selection from selector component.
   *
   * Navigates to appropriate route based on selected method.
   *
   * @param method - Selected MFA method
   * @returns Promise that resolves when navigation completes
   *
   * @example
   * ```typescript
   * // In MFA selector component
   * onMethodSelected(method: MFAMethod) {
   *   this.orchestrator.selectMFAMethod(method);
   * }
   * ```
   */
  async selectMFAMethod(method: MFAMethod): Promise<boolean> {
    return this.navigateToChallenge(method, { method });
  }
}
