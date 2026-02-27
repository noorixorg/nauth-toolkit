import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthResponse } from '@nauth-toolkit/client-angular/standalone';
import { AuthChallenge, getMFAMethod } from '@nauth-toolkit/client';
import { environment } from '../../environments/environment';

/**
 * Service for handling verification code display in simulation mode
 *
 * Shows PrimeNG toast with verification codes for SMS and email challenges.
 * Uses PrimeNG's built-in toast stacking - toasts will naturally stack on top of each other.
 *
 * Uses sessionId from challenge responses to retrieve codes from the test controller.
 */
@Injectable({
  providedIn: 'root',
})
export class SimulatedVerificationCodeService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);

  /**
   * Refresh verification code for a session (e.g., after resend)
   *
   * Dismisses existing toast for this type and shows new one.
   * Only one toast per type (sms/email) will be visible at a time.
   *
   * @param sessionId - Challenge session ID
   * @param challengeName - Challenge name (VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, or MFA_SETUP_REQUIRED)
   * @param type - Type of verification (sms or email)
   */
  async refreshCodeForSession(
    sessionId: string,
    challengeName: string,
    type: 'sms' | 'email',
  ): Promise<void> {
    if (!sessionId) return;

    // Dismiss existing toast for this type before showing new one
    this.messageService.clear(type);

    // For resend operations, wait a bit for the code to be saved to the database
    // Even though resend is synchronous, there's a small delay for DB write
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // For MFA_SETUP_REQUIRED, pass method to help backend determine token type
      const method = challengeName === 'MFA_SETUP_REQUIRED' ? type : undefined;
      const code = await this.fetchCode(sessionId, method);
      if (!code) {
        return;
      }

      // Show new toast - replaces the dismissed one
      this.showVerificationCodeToast(code, type);
    } catch {
      // Failed to fetch code - silently return (service should be resilient)
      return;
    }
  }

  /**
   * Handle challenge event and show verification code toast if applicable
   *
   * @param challenge - Auth response with challenge data
   * @param method - Optional MFA method override (for MFA_SETUP_REQUIRED when method isn't in challenge)
   */
  async handleChallenge(challenge: AuthResponse, method?: string): Promise<void> {
    console.log('[SimulatedVerificationCodeService] handleChallenge called:', challenge.challengeName, challenge.session, method);
    const challengeName = challenge.challengeName;
    if (!challengeName) {
      console.log('[SimulatedVerificationCodeService] No challengeName, returning');
      return;
    }

    // Only handle SMS and email verification challenges
    const isSmsChallenge = challengeName === AuthChallenge.VERIFY_PHONE;
    const isEmailChallenge = challengeName === AuthChallenge.VERIFY_EMAIL;

    // For MFA_REQUIRED, prefer explicit method override when provided.
    // This is critical when user switches from a non-OTP preferred method
    // (for example, passkey) to SMS/Email via the selector. In that case the
    // challenge parameters may still point to the original preferred method,
    // so relying solely on getMFAMethod(challenge) would cause the toast
    // handler to think this is not an SMS/Email challenge.
    const mfaMethod =
      challengeName === AuthChallenge.MFA_REQUIRED
        ? (method as 'sms' | 'email' | 'totp' | 'passkey' | undefined) || getMFAMethod(challenge)
        : undefined;
    const isMfaSmsChallenge = challengeName === AuthChallenge.MFA_REQUIRED && mfaMethod === 'sms';
    const isMfaEmailChallenge =
      challengeName === AuthChallenge.MFA_REQUIRED && mfaMethod === 'email';

    // Handle MFA_SETUP_REQUIRED for SMS/Email
    // Method can come from parameter override, challenge method, or challenge parameters
    const setupMfaMethod =
      challengeName === AuthChallenge.MFA_SETUP_REQUIRED
        ? method || getMFAMethod(challenge) || (challenge.challengeParameters?.['method'] as string)
        : undefined;
    const isSetupSmsChallenge =
      challengeName === AuthChallenge.MFA_SETUP_REQUIRED && setupMfaMethod === 'sms';
    const isSetupEmailChallenge =
      challengeName === AuthChallenge.MFA_SETUP_REQUIRED && setupMfaMethod === 'email';

    if (
      !isSmsChallenge &&
      !isEmailChallenge &&
      !isMfaSmsChallenge &&
      !isMfaEmailChallenge &&
      !isSetupSmsChallenge &&
      !isSetupEmailChallenge
    ) {
      return; // Not a supported challenge type
    }

    // Get session ID from challenge (optional for authenticated flow)
    const sessionId = challenge.session;

    // Determine type for display
    // Use method parameter if provided (for MFA_SETUP_REQUIRED), otherwise infer from challenge
    const type: 'sms' | 'email' =
      isSmsChallenge || isMfaSmsChallenge || isSetupSmsChallenge ? 'sms' : 'email';

    // Dismiss existing toast for this type before showing new one
    // Only one toast per type (sms/email) will be visible at a time
    this.messageService.clear(type);

    // Wait for code to be saved to database
    // Backend typically completes in 20-50ms, 500ms provides comfortable buffer
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      let code: string | null = null;

      // For authenticated flow (MFA_SETUP_REQUIRED without sessionId), use authenticated endpoint
      if (!sessionId && challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
        // Use method parameter or setupMfaMethod
        const methodToUse = (method || setupMfaMethod) as 'sms' | 'email';
        if (!methodToUse || (methodToUse !== 'sms' && methodToUse !== 'email')) {
          // Cannot determine method - skip
          return;
        }
        code = await this.fetchCodeForAuthenticatedUser(methodToUse);
      } else if (sessionId) {
        // For challenge flow, use sessionId-based endpoint
        // For MFA_REQUIRED and MFA_SETUP_REQUIRED, pass method to help backend determine token type
        // This is critical when user switches from passkey to SMS/email
        let methodToPass: string | undefined = undefined;
        if (challengeName === AuthChallenge.MFA_REQUIRED) {
          methodToPass = method || mfaMethod;
        } else if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
          methodToPass = method || setupMfaMethod;
        }
        code = await this.fetchCode(sessionId, methodToPass);
      } else {
        // No sessionId and not authenticated MFA setup - cannot retrieve code
        return;
      }
      if (!code) {
        // No code found - silently return (may not be available in all configurations)
        console.log('[SimulatedVerificationCodeService] No code found for challenge:', challengeName, 'session:', sessionId);
        return;
      }

      console.log('[SimulatedVerificationCodeService] Code found, showing toast:', code, 'type:', type);
      // Show toast with verification code - replaces the dismissed one
      this.showVerificationCodeToast(code, type);
    } catch {
      // Failed to fetch code - silently return (service should be resilient)
      // This is a non-critical operation that should not disrupt the user flow
      return;
    }
  }

  /**
   * Fetch verification code for a challenge session
   *
   * @param sessionId - Challenge session ID
   * @param method - Optional MFA method (for MFA_SETUP_REQUIRED)
   * @returns Verification code or null if not found
   * @throws Error if the request fails
   */
  private async fetchCode(sessionId: string, method?: string): Promise<string | null> {
    const params: { sessionId: string; method?: string } = { sessionId };
    if (method) {
      params.method = method;
    }

    console.log('[SimulatedVerificationCodeService] Fetching code:', `${environment.apiBaseUrl}/test/code/latest`, params);
    try {
      const response = await firstValueFrom(
        this.http.get<{ code: string | null }>(`${environment.apiBaseUrl}/test/code/latest`, {
          params,
        }),
      );
      console.log('[SimulatedVerificationCodeService] Code fetch response:', response);
      return response?.code || null;
    } catch (error) {
      console.error('[SimulatedVerificationCodeService] Error fetching code:', error);
      throw error;
    }
  }

  /**
   * Fetch verification code for authenticated user (dashboard MFA setup)
   *
   * Uses the authenticated endpoint which gets userId from req.user.
   * Much safer than relying on userId fallback in the public endpoint.
   *
   * @param method - MFA method ('sms' or 'email') - required
   * @returns Verification code or null if not found
   * @throws Error if the request fails
   */
  private async fetchCodeForAuthenticatedUser(method: 'sms' | 'email'): Promise<string | null> {
    const response = await firstValueFrom(
      this.http.get<{ code: string | null }>(
        `${environment.apiBaseUrl}/test/code/latest/authenticated`,
        {
          params: { method },
        },
      ),
    );

    return response?.code || null;
  }

  /**
   * Fetch password reset code for an identifier
   *
   * @param identifier - User identifier (email, username, or phone)
   * @returns Password reset code or null if not found
   * @throws Error if the request fails
   */
  async fetchPasswordResetCode(identifier: string): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ code: string | null }>(`${environment.apiBaseUrl}/test/code/latest`, {
          params: { identifier, type: 'password_reset' },
        }),
      );

      return response?.code || null;
    } catch {
      // Failed to fetch code - silently return (service should be resilient)
      return null;
    }
  }

  /**
   * Show password reset code toast
   *
   * Fetches the code and displays it in a toast notification.
   * Also logs to console for development.
   *
   * @param identifier - User identifier used for password reset
   * @param deliveryMedium - Delivery medium (email or sms)
   */
  async showPasswordResetCode(identifier: string, deliveryMedium?: string): Promise<void> {
    // Wait for code to be saved to database
    await new Promise((resolve) => setTimeout(resolve, 500));

    const code = await this.fetchPasswordResetCode(identifier);
    if (!code) {
      return;
    }

    // Determine type based on delivery medium or default to email
    const type: 'sms' | 'email' = deliveryMedium === 'sms' ? 'sms' : 'email';

    // Show toast with verification code
    this.showVerificationCodeToast(code, type);
  }

  /**
   * Show PrimeNG toast with verification code
   *
   * Dismisses all previous verification code toasts before showing the new one.
   * Uses PrimeNG's built-in sticky behavior - toast stays until dismissed.
   *
   * @param code - Verification code to display
   * @param type - Type of verification (sms or email)
   */
  private showVerificationCodeToast(code: string, type: 'sms' | 'email'): void {
    // Use the toast key ("sms" or "email") to target the correct toast instance
    const toastKey = type;

    // Clear all previous verification code toasts (both sms and email) before showing new one
    // This ensures only one toast is visible at a time
    this.messageService.clear('sms');
    this.messageService.clear('email');

    this.messageService.add({
      key: toastKey,
      severity: 'success',
      summary: 'Simulation Mode',
      detail: `Verification code for ${type === 'sms' ? 'SMS' : 'Email'}`,
      sticky: true,
      closable: false,
      data: {
        code,
        type,
      },
    });
  }
}
