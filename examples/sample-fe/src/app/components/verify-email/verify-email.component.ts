import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ChallengeNavigationService } from '../../services/challenge-navigation.service';
import { AuthChallengeResponse } from '../../models/auth.models';

/**
 * Email Verification Component
 *
 * Handles email verification with code input in challenge flow
 * This is shown after signup when VERIFY_EMAIL challenge is returned
 */
@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  standalone: true,
})
export class VerifyEmailComponent implements OnInit {
  verificationForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  resendCooldown = 0;
  userEmail = '';
  challengeSession: AuthChallengeResponse | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private challengeNav: ChallengeNavigationService,
    public router: Router,
  ) {
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
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

    this.challengeSession = challenge;
    // Extract email from challenge parameters
    this.userEmail = challenge.challengeParameters?.['email'] || 'your email';
  }

  /**
   * Handle verification form submission
   */
  onVerify(): void {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    if (this.verificationForm.valid && this.challengeSession) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const code = this.verificationForm.value.code;

      // Verify email using unified API
      this.authService.verifyEmail(this.challengeSession.session, code).subscribe({
              next: (response) => {
                this.successMessage = 'Email verified successfully!';
                this.isLoading = false;

                // Use centralized challenge navigation service
                if (this.challengeNav.handleChallengeResponse(response)) {
                  // Navigation handled by service (either to next challenge or dashboard)
                  return;
                }

                // Fallback: unexpected response
                console.warn('[VerifyEmail] Unexpected response after challenge completion:', response);
          },
          error: (error) => {
            this.errorMessage = error.error?.message || 'Invalid verification code';
            this.isLoading = false;
          },
        });
    }
  }

  /**
   * Resend verification code
   */
  resendCode(): void {
    // Prevent duplicate submissions
    if (this.isLoading || this.resendCooldown > 0 || !this.challengeSession) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Resend verification code using unified API
    this.authService.resendCode(this.challengeSession.session).subscribe({
      next: (result) => {
        this.successMessage = `Verification code resent to ${result.destination}`;
        this.isLoading = false;
        this.startResendCooldown();
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to resend verification code';
        this.isLoading = false;
      },
    });
  }

  /**
   * Start resend cooldown timer
   */
  private startResendCooldown(): void {
    this.resendCooldown = 60; // 60 seconds
    const timer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }

  /**
   * Get form control for easy access in template
   */
  get verificationControls() {
    return this.verificationForm.controls;
  }
}
