import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '@nauth-toolkit/client-angular/standalone';
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
 * Admin Reset Password component
 *
 * Handles admin-initiated password reset confirmation flow.
 * User can enter code from email/SMS or use token from link.
 * Uses PrimeNG components for UI and AuthService for authentication.
 *
 * @example
 * ```typescript
 * // Route configuration
 * { path: 'admin-reset-password', component: AdminResetPasswordComponent }
 * ```
 */
@Component({
  selector: 'app-admin-reset-password',
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
  templateUrl: './admin-reset-password.component.html',
})
export class AdminResetPasswordComponent implements OnInit {
  /**
   * Reset password form group
   */
  resetForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * User identifier (from query params or session)
   */
  identifier = signal<string | null>(null);

  /**
   * Token from URL (if coming from link)
   */
  token = signal<string | null>(null);

  /**
   * @param fb - Form builder for reactive forms
   * @param auth - Auth service for authentication
   * @param router - Router for navigation
   * @param route - Activated route for query params
   */
  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.resetForm = this.fb.group({
      identifier: ['', [Validators.required]],
      codeOrToken: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
    });
  }

  /**
   * Initialize component
   *
   * Retrieves identifier and token from query params or session storage.
   */
  ngOnInit(): void {
    // Get token from query params (if coming from link)
    this.route.queryParams.subscribe((params) => {
      if (params['token']) {
        this.token.set(params['token']);
        this.resetForm.patchValue({ codeOrToken: params['token'] });
      }
      if (params['identifier']) {
        this.identifier.set(params['identifier']);
        this.resetForm.patchValue({ identifier: params['identifier'] });
      }
    });

    // If no identifier in URL, try to get from session storage
    if (!this.identifier()) {
      const storedIdentifier = sessionStorage.getItem('adminResetPasswordIdentifier');
      if (storedIdentifier) {
        this.identifier.set(storedIdentifier);
        this.resetForm.patchValue({ identifier: storedIdentifier });
      }
    }

    // Re-validate confirm password when new password changes
    this.resetForm.get('newPassword')?.valueChanges.subscribe(() => {
      this.resetForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  /**
   * Handle form submission
   *
   * Confirms password reset with code/token and new password.
   * Redirects to login on success.
   */
  async onSubmit(): Promise<void> {
    if (this.resetForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.resetForm.controls).forEach((key) => {
        this.resetForm.get(key)?.markAsTouched();
      });
      return;
    }

    const { identifier, codeOrToken, newPassword } = this.resetForm.value;

    if (!identifier) {
      this.error.set('User identifier is required.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.resetPasswordWithCode(identifier, codeOrToken, newPassword);

      // Clear session storage
      sessionStorage.removeItem('adminResetPasswordIdentifier');

      // Redirect to login with success message
      await this.router.navigate(['/login'], {
        queryParams: { passwordReset: 'success' },
      });
    } catch (err: unknown) {
      // Handle specific error codes
      if (err instanceof NAuthClientError) {
        if (err.code === NAuthErrorCode.PASSWORD_RESET_CODE_INVALID) {
          this.error.set('Invalid reset code or token. Please check and try again.');
        } else if (err.code === NAuthErrorCode.PASSWORD_RESET_CODE_EXPIRED) {
          this.error.set('Reset code or token has expired. Please contact your administrator for a new one.');
        } else if (err.code === NAuthErrorCode.PASSWORD_RESET_MAX_ATTEMPTS) {
          this.error.set('Too many failed attempts. Please contact your administrator for a new reset code.');
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
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    sessionStorage.removeItem('adminResetPasswordIdentifier');
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

