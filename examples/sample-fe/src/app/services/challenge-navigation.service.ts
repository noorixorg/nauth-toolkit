import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthChallengeResponse } from '../models/auth.models';

/**
 * Challenge Navigation Service
 *
 * Centralized service for handling authentication challenge navigation.
 * Used by all auth flows (login, signup, password change, social login, MFA)
 * to ensure consistent challenge handling and routing.
 *
 * @example
 * ```typescript
 * constructor(private challengeNav: ChallengeNavigationService) {}
 *
 * // After receiving challenge response
 * if (response.challengeName) {
 *   this.challengeNav.navigateToChallenge(response);
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ChallengeNavigationService {
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  /**
   * Navigate to the appropriate page based on challenge type
   *
   * Stores the challenge in auth service and routes to the correct component.
   * This method handles all challenge types consistently across all auth flows.
   *
   * @param challenge - Challenge response from backend
   * @returns void
   *
   * @example
   * ```typescript
   * // After login/signup/password change
   * if (response.challengeName) {
   *   this.challengeNav.navigateToChallenge(response);
   *   return;
   * }
   * ```
   */
  navigateToChallenge(challenge: AuthChallengeResponse | { challengeName: string }): void {
    // Store challenge for later retrieval by challenge components
    if (this.isFullChallengeResponse(challenge)) {
      this.authService.storeChallenge(challenge);
    }

    const challengeName = challenge.challengeName;

    // Route to appropriate challenge page
    switch (challengeName) {
      case 'VERIFY_EMAIL':
        this.router.navigate(['/verify-email']);
        break;

      case 'VERIFY_PHONE':
      case 'VERIFY_EMAIL_AND_PHONE':
        // VERIFY_EMAIL_AND_PHONE starts with email verification
        // After email is verified, next challenge will be VERIFY_PHONE
        this.router.navigate(['/verify-phone']);
        break;

      case 'MFA_REQUIRED':
        // MFA verification - handled by verify-phone component
        this.router.navigate(['/verify-phone']);
        break;

      case 'MFA_SETUP_REQUIRED':
        // MFA setup - user needs to configure MFA
        this.router.navigate(['/mfa-setup']);
        break;

      case 'FORCE_CHANGE_PASSWORD':
        // Force password change
        this.router.navigate(['/force-change-password']);
        break;

      default:
        // Unknown challenge - log and redirect to login
        console.warn(`[ChallengeNavigationService] Unknown challenge type: ${challengeName}`);
        this.router.navigate(['/login']);
        break;
    }
  }

  /**
   * Handle challenge response after completing a challenge
   *
   * Called after successfully completing a challenge (e.g., password change, email verification).
   * If another challenge is required, routes to it. Otherwise, routes to dashboard if tokens are present.
   *
   * @param response - Response from challenge completion endpoint
   * @returns boolean - true if navigation occurred, false otherwise
   *
   * @example
   * ```typescript
   * this.authService.completeChallenge(request).subscribe({
   *   next: (response) => {
   *     if (this.challengeNav.handleChallengeResponse(response)) {
   *       // Navigation handled by service
   *       return;
   *     }
   *     // Handle success case (tokens present)
   *   }
   * });
   * ```
   */
  handleChallengeResponse(response: {
    challengeName?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
  }): boolean {
    // Check if another challenge is required
    if (response.challengeName) {
      this.navigateToChallenge(response as AuthChallengeResponse);
      return true;
    }

    // Check if authentication is complete (tokens present)
    if (response.accessToken && response.refreshToken) {
      // All challenges completed - navigate to dashboard
      this.router.navigate(['/dashboard']);
      return true;
    }

    // Check if user object is present (cookie mode - tokens in httpOnly cookies)
    if (response.user) {
      // Authentication successful (tokens in cookies)
      this.router.navigate(['/dashboard']);
      return true;
    }

    // No navigation occurred - caller should handle
    return false;
  }

  /**
   * Type guard to check if challenge is full AuthChallengeResponse
   */
  private isFullChallengeResponse(
    challenge: AuthChallengeResponse | { challengeName: string },
  ): challenge is AuthChallengeResponse {
    return 'session' in challenge && 'challengeName' in challenge;
  }
}
