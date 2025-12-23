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
import { AuthService } from '@nauth-toolkit/client/angular';
import { NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';
import { InputTextModule } from 'primeng/inputtext';
import { AutoFocusModule } from 'primeng/autofocus';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
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
 * Confirm Forgot Password component
 *
 * Handles password reset confirmation flow.
 * User enters the reset code and new password to complete the reset.
 * Uses PrimeNG components for UI and AuthService for authentication.
 *
 * @example
 * ```typescript
 * // Route configuration
 * { path: 'forgot-password/confirm', component: ConfirmForgotPasswordComponent }
 * ```
 */
@Component({
  selector: 'app-confirm-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    AutoFocusModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './confirm-forgot-password.component.html',
  styleUrl: './confirm-forgot-password.component.css',
})
export class ConfirmForgotPasswordComponent implements OnInit {
  /**
   * Confirm forgot password form group
   */
  confirmForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * User identifier from previous step
   */
  identifier = signal<string | null>(null);

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
    this.confirmForm = this.fb.group({
      code: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
    });
  }

  /**
   * Initialize component
   *
   * Retrieves identifier from session storage.
   * Redirects to forgot password page if identifier is missing.
   */
  ngOnInit(): void {
    // Get identifier from session storage
    const storedIdentifier = sessionStorage.getItem('forgotPasswordIdentifier');
    if (!storedIdentifier) {
      // Redirect to forgot password page if no identifier
      this.router.navigate(['/forgot-password']);
      return;
    }

    this.identifier.set(storedIdentifier);

    // Re-validate confirm password when new password changes
    this.confirmForm.get('newPassword')?.valueChanges.subscribe(() => {
      this.confirmForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  /**
   * Handle form submission
   *
   * Confirms password reset with code and new password.
   * Redirects to login on success.
   */
  onSubmit(): void {
    if (this.confirmForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.confirmForm.controls).forEach((key) => {
        this.confirmForm.get(key)?.markAsTouched();
      });
      return;
    }

    const identifier = this.identifier();
    if (!identifier) {
      this.error.set('Session expired. Please start over.');
      setTimeout(() => {
        this.router.navigate(['/forgot-password']);
      }, 2000);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { code, newPassword } = this.confirmForm.value;

    this.auth.confirmForgotPassword(identifier, code, newPassword).subscribe({
      next: () => {
        this.loading.set(false);

        // Clear session storage
        sessionStorage.removeItem('forgotPasswordIdentifier');

        // Redirect to login with success message
        this.router.navigate(['/login'], {
          queryParams: { passwordReset: 'success' },
        });
      },
      error: (err: unknown) => {
        this.loading.set(false);

        // Handle specific error codes
        if (err instanceof NAuthClientError) {
          if (err.code === NAuthErrorCode.PASSWORD_RESET_CODE_INVALID) {
            this.error.set('Invalid reset code. Please check and try again.');
          } else if (err.code === NAuthErrorCode.PASSWORD_RESET_CODE_EXPIRED) {
            this.error.set('Reset code has expired. Please request a new one.');
          } else if (err.code === NAuthErrorCode.PASSWORD_RESET_MAX_ATTEMPTS) {
            this.error.set('Too many failed attempts. Please request a new reset code.');
          } else if (err.code === NAuthErrorCode.WEAK_PASSWORD) {
            this.error.set('Password does not meet security requirements.');
          } else if (err.code === NAuthErrorCode.PASSWORD_REUSED) {
            this.error.set('You cannot reuse a recent password. Please choose a different one.');
          } else {
            this.handleError(err);
          }
        } else {
          this.handleError(err);
        }
      },
    });
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    sessionStorage.removeItem('forgotPasswordIdentifier');
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
