import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
// HttpClient no longer needed - using AuthService methods
import { AuthService } from '../../services/auth.service';
import { ChallengeNavigationService } from '../../services/challenge-navigation.service';
import { AuthChallengeResponse, UnifiedAuthResponse } from '../../models/auth.models';
import { MFAMethodSelectorComponent } from '../shared/mfa-method-selector/mfa-method-selector.component';
import { MFAVerificationMethod } from '../../types/mfa.types';

/**
 * Phone Verification Component
 *
 * Handles phone verification with code input in challenge flow.
 * Supports both VERIFY_PHONE (signup verification) and MFA_REQUIRED (login MFA) challenges.
 * This component can be repurposed for MFA SMS verification as they share the same UI flow.
 */
@Component({
  selector: 'app-verify-phone',
  templateUrl: './verify-phone.component.html',
  styleUrls: ['./verify-phone.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MFAMethodSelectorComponent],
  standalone: true,
})
export class VerifyPhoneComponent implements OnInit {
  verificationForm: FormGroup;
  phoneCollectionForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  resendCooldown = 0;
  userPhone = '';
  challengeSession: AuthChallengeResponse | null = null;
  requiresPhoneCollection = false;
  phoneCollected = false;
  isMFAChallenge = false; // True when challenge is MFA_REQUIRED, false for VERIFY_PHONE
  mfaMethod: MFAVerificationMethod | null = null; // MFA method being used
  availableMethods: Array<MFAVerificationMethod> = []; // Available MFA methods
  preferredMethod: 'totp' | 'sms' | 'email' | 'passkey' | undefined = undefined; // Preferred method from backend
  showMethodSelector = false; // Show method selector when multiple methods available
  passkeyVerifying = false; // True when passkey verification is in progress
  passkeyChallengeOptions: Record<string, unknown> | null = null; // Passkey challenge options
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private challengeNav: ChallengeNavigationService,
    // HttpClient removed - using AuthService instead
    public router: Router,
  ) {
    // Note: Pattern will be dynamically updated based on MFA method
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required]],
    });

    this.phoneCollectionForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^\+[1-9]\d{1,14}$/)]],
    });
  }

  ngOnInit(): void {
    // Check for stored challenge
    const challenge = this.authService.getStoredChallenge();
    if (!challenge) {
      // No challenge - redirect to login
      this.router.navigate(['/login']);
      return;
    }

    // If this is MFA_SETUP_REQUIRED, redirect to mfa-setup component immediately
    if (challenge.challengeName === 'MFA_SETUP_REQUIRED') {
      this.router.navigate(['/mfa-setup']);
      return;
    }

    this.challengeSession = challenge;

    // Determine if this is an MFA challenge or phone verification challenge
    this.isMFAChallenge = challenge.challengeName === 'MFA_REQUIRED';

    if (this.isMFAChallenge) {
      // MFA challenge: Extract method and masked phone from challenge parameters
      this.availableMethods =
        (challenge.challengeParameters?.['availableMethods'] as Array<MFAVerificationMethod>) || [];
      this.preferredMethod = challenge.challengeParameters?.['preferredMethod'] as
        | 'totp'
        | 'sms'
        | 'email'
        | 'passkey'
        | undefined;

      // Show method selector if multiple methods available (excluding backup codes for auto-trigger logic)
      // Backup codes don't count as a "method choice" - they're always available as fallback
      // Hide selector if preferred method is set (user has explicitly chosen a method)
      const deviceMethods = this.availableMethods.filter((m) => m !== 'backup');
      this.showMethodSelector = deviceMethods.length > 1 && !this.preferredMethod;

      // Set initial method based on preferred or first available
      if (this.preferredMethod && this.availableMethods.includes(this.preferredMethod)) {
        this.mfaMethod = this.preferredMethod;
      } else if (deviceMethods.length > 0) {
        this.mfaMethod = deviceMethods[0] as MFAVerificationMethod;
      } else {
        this.mfaMethod = 'sms'; // Fallback
      }

      // Get masked phone or email from challenge parameters
      // Prioritize email if email is the preferred method, otherwise use phone
      const maskedEmail = challenge.challengeParameters?.['maskedEmail'] as string | undefined;
      const maskedPhone = challenge.challengeParameters?.['maskedPhone'] as string | undefined;
      if (this.preferredMethod === 'email' && maskedEmail) {
        this.userPhone = maskedEmail;
      } else {
        this.userPhone = maskedPhone || maskedEmail || 'your phone';
      }

      // Auto-trigger verification for passkey if it's the only device method OR if it's the preferred method
      // This ensures passkey verification triggers immediately after setup
      if (this.mfaMethod === 'passkey') {
        // Only show selector if there are other device methods (not just backup codes)
        // But if passkey is preferred or only device method, auto-trigger
        if (!this.showMethodSelector || this.preferredMethod === 'passkey') {
          // Preferred method is passkey or only device method - start verification immediately
          this.startPasskeyVerification();
        }
        // If showMethodSelector is true and passkey is not preferred, user will select manually
      } else if (this.mfaMethod === 'sms' || this.mfaMethod === 'email') {
        // Code is already auto-sent by backend for preferred methods
        // Only trigger resend if code wasn't auto-sent (e.g., user manually selected method)
        // Check if this is the preferred method - if so, backend already sent it, don't resend
        if (this.preferredMethod !== this.mfaMethod) {
          // User selected a different method than preferred - send code for selected method
          this.sendMFACode();
        }
        // If preferred method matches, backend already sent it - just show the UI
      }

      // Update form validation based on selected MFA method
      this.updateFormValidation();
    } else {
      // Regular phone verification challenge
      // Check if phone collection is required
      this.requiresPhoneCollection =
        challenge.challengeParameters?.['requiresPhoneCollection'] === 'true';
      // Extract phone from challenge parameters
      this.userPhone = challenge.challengeParameters?.['phone'] || 'your phone';

      // Check if SMS error occurred (e.g., rate limit)
      const smsError = challenge.challengeParameters?.['smsError'] as string | undefined;
      if (smsError) {
        this.errorMessage = smsError;
      }

      // Start 60-second cooldown timer if phone exists (not in phone collection mode)
      if (!this.requiresPhoneCollection && this.userPhone && this.userPhone !== 'your phone') {
        this.startResendCooldown();
      }
    }
  }

  /**
   * Handle verification form submission
   * Handles both VERIFY_PHONE and MFA_REQUIRED challenges
   */
  /**
   * Handle method selection from method selector
   */
  onMethodSelected(method: MFAVerificationMethod): void {
    this.mfaMethod = method;
    this.showMethodSelector = false;
    this.errorMessage = '';
    this.successMessage = '';

    // Initialize method-specific flows
    if (method === 'passkey') {
      this.startPasskeyVerification();
    } else if (method === 'sms' || method === 'email') {
      // SMS and Email MFA require code sending
      this.sendMFACode();
    } else {
      // TOTP or backup - just update form validation
      this.updateFormValidation();
    }
  }

  /**
   * Start passkey verification flow
   */
  startPasskeyVerification(): void {
    if (!this.challengeSession || this.passkeyVerifying) return;

    this.passkeyVerifying = true;
    this.isLoading = true;
    this.errorMessage = '';

    // Check WebAuthn support
    if (!window.PublicKeyCredential) {
      this.errorMessage =
        'WebAuthn/Passkeys are not supported in this browser. Please use another MFA method.';
      this.isLoading = false;
      this.passkeyVerifying = false;
      return;
    }

    // Get passkey challenge from backend using unified API
    this.authService.getChallengeData(this.challengeSession.session, 'passkey').subscribe({
      next: (response: any) => {
        this.passkeyChallengeOptions = response.options;
        this.authenticateWithPasskey(response.options, response.challenge);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Failed to get passkey challenge';
        this.isLoading = false;
        this.passkeyVerifying = false;
      },
    });
  }

  /**
   * Authenticate using SimpleWebAuthn browser library
   */
  private async authenticateWithPasskey(
    options: Record<string, unknown>,
    expectedChallenge: string,
  ): Promise<void> {
    try {
      // Use SimpleWebAuthn browser library for authentication
      // This handles all the complex credential conversion and transport handling
      const { startAuthentication } = await import('@simplewebauthn/browser');

      const asseResp = await startAuthentication({
        optionsJSON: options as any,
      });

      // Verify with backend
      // SimpleWebAuthn returns the credential in the correct format for @simplewebauthn/server
      this.verifyPasskeyMFA(asseResp, expectedChallenge);
    } catch (error: unknown) {
      const { WebAuthnError } = await import('@simplewebauthn/browser');

      if (error instanceof WebAuthnError) {
        // SimpleWebAuthn provides better error messages
        this.errorMessage = `Authentication failed: ${error.message}`;
      } else {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to authenticate with passkey';
        this.errorMessage = errorMessage;
      }

      this.isLoading = false;
      this.passkeyVerifying = false;
    }
  }

  /**
   * Verify passkey MFA with backend
   */
  private verifyPasskeyMFA(credential: any, expectedChallenge: string): void {
    if (!this.challengeSession) {
      this.errorMessage = 'Challenge session not found';
      this.isLoading = false;
      this.passkeyVerifying = false;
      return;
    }

    // Use unified API to verify passkey MFA
    this.authService.verifyMFAPasskey(this.challengeSession.session, credential).subscribe({
      next: (response) => {
        this.successMessage = 'Passkey verified successfully!';
        this.isLoading = false;
        this.passkeyVerifying = false;

        // Check if device trust popup should be shown (user_opt_in mode)
        if (
          response.user &&
          response.trusted === false &&
          (response.accessToken || response.refreshToken || response.user)
        ) {
          // Show trust device popup
          const shouldTrust = confirm(
            "Would you like to trust this device? You won't need to verify with MFA on this device for the next 30 days.",
          );

          if (shouldTrust) {
            this.authService.trustDevice().subscribe({
              next: () => {
                // Device trusted successfully - continue with navigation
                this.navigateAfterMFA(response);
              },
              error: (error: any) => {
                console.error('Failed to trust device:', error);
                // Continue anyway even if trust fails
                this.navigateAfterMFA(response);
              },
            });
          } else {
            // User declined - continue with navigation
            this.navigateAfterMFA(response);
          }
        } else {
          // Device already trusted or not in user_opt_in mode - proceed normally
          this.navigateAfterMFA(response);
        }
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Passkey verification failed';
        this.isLoading = false;
        this.passkeyVerifying = false;
      },
    });
  }

  /**
   * Navigate after MFA verification completes
   */
  private navigateAfterMFA(response: any): void {
    // Use centralized challenge navigation service
    if (this.challengeNav.handleChallengeResponse(response)) {
      // Navigation handled by service (either to next challenge or dashboard)
      return;
    }

    // Fallback: if no navigation occurred but we have a user or tokens, navigate to dashboard
    if (response.user || (response.accessToken && response.refreshToken)) {
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 0);
    }
  }

  onVerify(): void {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    // Skip if passkey (has its own flow)
    if (this.mfaMethod === 'passkey') {
      return;
    }

    if (this.verificationForm.valid && this.challengeSession) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const code = this.verificationForm.value.code;

      if (this.isMFAChallenge) {
        // MFA verification flow
        // We already checked for passkey earlier, so mfaMethod is either null or a code-based method
        if (!this.mfaMethod) {
          this.errorMessage = 'MFA method not selected';
          this.isLoading = false;
          return;
        }
        // Type assertion: we've already checked it's not passkey (checked earlier) and not null, so it's safe to cast
        this.authService
          .verifyMFA(
            this.challengeSession.session,
            this.mfaMethod as 'sms' | 'email' | 'totp' | 'backup',
            code,
          )
          .subscribe({
            next: (response) => {
              this.successMessage = 'MFA verified successfully!';
              this.isLoading = false;

              // Check if device trust popup should be shown (user_opt_in mode)
              if (
                response.user &&
                response.trusted === false &&
                (response.accessToken || response.refreshToken || response.user)
              ) {
                // Show trust device popup
                const shouldTrust = confirm(
                  "Would you like to trust this device? You won't need to verify with MFA on this device for the next 30 days.",
                );

                if (shouldTrust) {
                  this.authService.trustDevice().subscribe({
                    next: () => {
                      // Device trusted successfully - continue with navigation
                      this.navigateAfterMFA(response);
                    },
                    error: (error) => {
                      console.error('Failed to trust device:', error);
                      // Continue anyway even if trust fails
                      this.navigateAfterMFA(response);
                    },
                  });
                } else {
                  // User declined - continue with navigation
                  this.navigateAfterMFA(response);
                }
              } else {
                // Device already trusted or not in user_opt_in mode - proceed normally
                this.navigateAfterMFA(response);
              }
            },
            error: (error: any) => {
              this.errorMessage = error.error?.message || 'Invalid MFA code';
              this.isLoading = false;
            },
          });
      } else {
        // Regular phone verification flow (VERIFY_PHONE challenge)
        // Use unified API to verify phone
        this.authService.verifyPhone(this.challengeSession.session, code).subscribe({
          next: (response: UnifiedAuthResponse) => {
            this.successMessage = 'Phone verified successfully!';
            this.isLoading = false;

            // Use centralized challenge navigation service
            if (this.challengeNav.handleChallengeResponse(response)) {
              // Navigation handled by service (either to next challenge or dashboard)
              return;
            }

            // Fallback: unexpected response
            console.warn('[VerifyPhone] Unexpected response after challenge completion:', response);
          },
          error: (error: any) => {
            this.errorMessage = error.error?.message || 'Invalid verification code';
            this.isLoading = false;
          },
        });
      }
    }
  }

  /**
   * Send MFA code (SMS or Email) for MFA challenge
   * Called automatically on component load for SMS/Email MFA, or manually via resend button
   */
  sendMFACode(): void {
    if (!this.challengeSession || this.resendCooldown > 0) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resendCode(this.challengeSession.session).subscribe({
      next: (response: { destination: string }) => {
        this.successMessage = `Verification code sent to ${response.destination}`;
        this.userPhone = response.destination;
        this.isLoading = false;
        this.startResendCooldown();
      },
      error: (error: any) => {
        const methodName = this.mfaMethod === 'email' ? 'Email' : 'SMS';
        this.errorMessage = error.error?.message || `Failed to send ${methodName} code`;
        this.isLoading = false;
      },
    });
  }

  /**
   * Handle phone collection form submission (for social users without phone)
   * Sends phone to backend via challenge completion endpoint
   */
  onCollectPhone(): void {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    if (this.phoneCollectionForm.valid && this.challengeSession) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const phone = this.phoneCollectionForm.value.phone;

      // Submit phone through unified challenge response endpoint
      // Backend will add phone and send SMS, returning updated challenge
      this.authService.collectPhone(this.challengeSession.session, phone).subscribe({
        next: (response: UnifiedAuthResponse) => {
          // Backend returns updated challenge with phone added
          if (response.challengeName && response.session) {
            // Check if SMS error occurred
            const smsError = response.challengeParameters?.['smsError'] as string | undefined;

            // Update local state
            this.userPhone = phone;
            this.phoneCollected = true;
            this.requiresPhoneCollection = false;
            this.isLoading = false;

            // Set messages based on SMS result
            if (smsError) {
              this.errorMessage = smsError;
              this.successMessage = `Phone added, but ${smsError.toLowerCase()}`;
            } else {
              this.successMessage = `Phone added! Verification code sent to ${phone}`;
              this.errorMessage = '';
            }

            // Update stored challenge with new phone (cast to AuthChallengeResponse)
            const updatedChallenge: AuthChallengeResponse = {
              challengeName: response.challengeName,
              session: response.session,
              challengeParameters: response.challengeParameters || {},
              userSub: response.userSub || '',
            };
            this.challengeSession = updatedChallenge;
            // Note: storeChallenge is private, but we update local state which is sufficient
            // The challenge will be re-stored when the next challenge completion occurs

            // Start 60-second cooldown timer after phone is collected (even if SMS failed)
            this.startResendCooldown();
          } else {
            // Unexpected - should return challenge
            this.errorMessage = 'Unexpected response from server';
            this.isLoading = false;
          }
        },
        error: (error: any) => {
          this.errorMessage = error.error?.message || 'Failed to add phone number';
          this.isLoading = false;
        },
      });
    }
  }

  /**
   * Resend verification code
   * Handles both VERIFY_PHONE (resend phone verification) and MFA_REQUIRED (resend SMS code) challenges
   */
  resendCode(): void {
    // Prevent duplicate submissions
    if (this.isLoading || this.resendCooldown > 0 || !this.challengeSession) return;

    if (this.isMFAChallenge && (this.mfaMethod === 'sms' || this.mfaMethod === 'email')) {
      // MFA SMS or Email resend
      this.sendMFACode();
    } else {
      // Regular phone verification resend
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const phone = this.challengeSession.challengeParameters?.['phone'] || this.userPhone;
      if (!phone) {
        this.errorMessage = 'Phone not found in challenge session';
        this.isLoading = false;
        return;
      }

      // Call backend to resend verification code
      this.authService.resendCode(this.challengeSession.session).subscribe({
        next: () => {
          this.successMessage = 'Verification code resent! Please check your phone.';
          this.isLoading = false;
          this.startResendCooldown();
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to resend verification code';
          this.isLoading = false;
        },
      });
    }
  }

  /**
   * Start resend cooldown timer
   */
  private startResendCooldown(): void {
    // Clear any existing timer to prevent multiple timers
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }

    this.resendCooldown = 60; // 60 seconds
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      }
    }, 1000);
  }

  /**
   * Get form control for easy access in template
   */
  get verificationControls() {
    return this.verificationForm.controls;
  }

  /**
   * Get phone collection form controls
   */
  get phoneControls() {
    return this.phoneCollectionForm.controls;
  }

  /**
   * Update form validation based on MFA method
   */
  private updateFormValidation(): void {
    const codeControl = this.verificationForm.get('code');
    if (!codeControl) return;

    // Clear existing validators
    codeControl.clearValidators();

    // Add validators based on MFA method
    if (this.isMFAChallenge && this.mfaMethod === 'backup') {
      // Backup codes are typically 8-12 alphanumeric characters
      codeControl.setValidators([
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(12),
        Validators.pattern(/^[A-Z0-9]+$/),
      ]);
    } else {
      // TOTP and SMS codes are 6 digits
      codeControl.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
    }

    codeControl.updateValueAndValidity();
  }
}
