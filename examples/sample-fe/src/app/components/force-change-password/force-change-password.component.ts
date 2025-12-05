import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ChallengeNavigationService } from '../../services/challenge-navigation.service';
import { AuthChallengeResponse } from '../../models/auth.models';

/**
 * Force Change Password Component
 *
 * Handles forced password change in challenge flow
 * This is shown when FORCE_CHANGE_PASSWORD challenge is returned
 */
@Component({
  selector: 'app-force-change-password',
  templateUrl: './force-change-password.component.html',
  styleUrls: ['./force-change-password.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  standalone: true,
})
export class ForceChangePasswordComponent implements OnInit {
  changePasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  challengeSession: AuthChallengeResponse | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private challengeNav: ChallengeNavigationService,
    public router: Router,
  ) {
    this.changePasswordForm = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
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
  }

  /**
   * Password match validator
   */
  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }

    return null;
  }

  /**
   * Handle password change form submission
   */
  onChangePassword(): void {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    if (this.changePasswordForm.valid && this.challengeSession) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const newPassword = this.changePasswordForm.value.newPassword;

      // Complete the challenge with the new password using unified API
      this.authService.changePassword(this.challengeSession.session, newPassword).subscribe({
          next: (response) => {
            console.log('[ForceChangePassword] Challenge completion response:', response);

            // Use centralized challenge navigation service
            if (this.challengeNav.handleChallengeResponse(response)) {
              // Navigation handled by service (either to next challenge or dashboard)
              this.successMessage = 'Password changed successfully! Redirecting...';
              this.isLoading = false;
              return;
            }

            // Fallback: unexpected response format
            console.error('[ForceChangePassword] Unexpected response format:', response);
            this.errorMessage = 'Unexpected response from server';
            this.isLoading = false;
          },
        error: (error: any) => {
            console.error('[ForceChangePassword] Error completing challenge:', error);
            this.errorMessage = error.error?.message || 'Failed to change password';
            this.isLoading = false;
          },
        });
    }
  }


  /**
   * Get form control for easy access in template
   */
  get changePasswordControls() {
    return this.changePasswordForm.controls;
  }
}
