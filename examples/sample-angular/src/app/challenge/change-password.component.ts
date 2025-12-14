import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService, AuthResponse } from '@nauth-toolkit/client/angular';
import {
  AuthChallenge,
  ForceChangePasswordResponse,
  NAuthClientError,
} from '@nauth-toolkit/client';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AutoFocusModule } from 'primeng/autofocus';
import { CommonModule } from '@angular/common';
import { handleAuthError } from '../utils/error-handler.util';

/**
 * Password match validator
 *
 * Validates that confirm password matches the password field.
 *
 * @param control - Form control to validate
 * @returns Validation errors or null if valid
 */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('newPassword')?.value;
  const confirmPassword = control.value;

  if (!confirmPassword || !password) {
    return null; // Let required validator handle empty values
  }

  if (password !== confirmPassword) {
    return { passwordMismatch: true };
  }

  return null;
}

/**
 * Change Password component
 *
 * Handles FORCE_CHANGE_PASSWORD challenge flow.
 * User must change their password before accessing the application.
 * Retrieves challenge session from AuthService automatically.
 *
 * @example
 * ```typescript
 * // Route configuration
 * { path: 'auth/challenge/force-change-password', component: ChangePasswordComponent }
 * ```
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    AutoFocusModule,
  ],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent implements OnInit {
  /**
   * Change password form group
   */
  changePasswordForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * Current challenge session
   */
  challenge: AuthResponse | null = null;

  /**
   * @param fb - Form builder for reactive forms
   * @param auth - Auth service for authentication
   * @param router - Router for navigation
   */
  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.changePasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
    });
  }

  /**
   * Initialize component
   *
   * Retrieves challenge session from AuthService.
   * Redirects to login if no challenge session exists.
   */
  ngOnInit(): void {
    // Get challenge session from SDK (automatically stored by SDK)
    this.challenge = this.auth.getCurrentChallenge();

    // If no challenge or wrong challenge type, redirect to login
    if (!this.challenge || this.challenge.challengeName !== AuthChallenge.FORCE_CHANGE_PASSWORD) {
      this.router.navigate(['/login']);
      return;
    }

    // Re-validate confirm password when new password changes
    this.changePasswordForm.get('newPassword')?.valueChanges.subscribe(() => {
      this.changePasswordForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  /**
   * Handle form submission
   *
   * Submits new password to complete the challenge.
   * Redirects to dashboard on success or login on error.
   */
  onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.changePasswordForm.controls).forEach((key) => {
        this.changePasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (!this.challenge?.session) {
      this.error.set('Challenge session expired. Please login again.');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { newPassword } = this.changePasswordForm.value;

    // Create challenge response
    const challengeResponse: ForceChangePasswordResponse = {
      type: AuthChallenge.FORCE_CHANGE_PASSWORD,
      session: this.challenge.session,
      newPassword,
    };

    this.auth.respondToChallenge(challengeResponse).subscribe({
      next: (response: AuthResponse) => {
        this.loading.set(false);
        // If response has another challenge, handle it
        if (response.challengeName) {
          const challengeRoute = `/auth/challenge/${response.challengeName.toLowerCase().replace(/_/g, '-')}`;
          this.router.navigate([challengeRoute]);
        } else {
          // Password changed successfully, redirect to dashboard
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.handleError(err);
      },
    });
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Handle and format errors for display
   *
   * Uses the error message directly from the framework.
   *
   * @param err - Error object (can be NAuthClientError or generic Error)
   */
  private handleError(err: unknown): void {
    handleAuthError(err, this.error);
  }
}
