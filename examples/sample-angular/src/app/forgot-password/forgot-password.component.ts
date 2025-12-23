import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@nauth-toolkit/client/angular';
import { NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';
import { InputTextModule } from 'primeng/inputtext';
import { AutoFocusModule } from 'primeng/autofocus';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CommonModule } from '@angular/common';
import { handleAuthError } from '../utils/error-handler.util';
import { SimulatedVerificationCodeService } from '../services/simulated-verification-code.service';

/**
 * Forgot Password component
 *
 * Handles password reset request flow.
 * User enters their identifier (email/username/phone) and receives a reset code.
 * Uses PrimeNG components for UI and AuthService for authentication.
 *
 * @example
 * ```typescript
 * // Route configuration
 * { path: 'forgot-password', component: ForgotPasswordComponent }
 * ```
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    AutoFocusModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent implements OnInit {
  /**
   * Forgot password form group
   */
  forgotPasswordForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * Success message signal
   */
  success = signal<string | null>(null);

  /**
   * Delivery destination (masked email/phone)
   */
  destination = signal<string | null>(null);

  /**
   * Delivery medium (email or sms)
   */
  deliveryMedium = signal<string | null>(null);

  /**
   * @param fb - Form builder for reactive forms
   * @param auth - Auth service for authentication
   * @param router - Router for navigation
   * @param verificationCodeService - Service for showing verification codes in simulation mode
   */
  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly verificationCodeService: SimulatedVerificationCodeService,
  ) {
    this.forgotPasswordForm = this.fb.group({
      identifier: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Handle form submission
   *
   * Requests password reset code for the provided identifier.
   * On success, navigates to confirm forgot password page.
   */
  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.forgotPasswordForm.controls).forEach((key) => {
        this.forgotPasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.destination.set(null);
    this.deliveryMedium.set(null);

    const { identifier } = this.forgotPasswordForm.value;

    this.auth.forgotPassword(identifier).subscribe({
      next: async (response) => {
        this.loading.set(false);

        // Store identifier in session storage for confirm step
        sessionStorage.setItem('forgotPasswordIdentifier', identifier);

        // If we have delivery info, show success message
        if (response.destination) {
          this.destination.set(response.destination);
          this.deliveryMedium.set(response.deliveryMedium || 'email');
          this.success.set(
            `If an account exists, a password reset code has been sent to ${response.destination}`,
          );
        } else {
          // Non-enumerating response - still show generic success
          this.success.set(
            'If an account exists, a password reset code has been sent to your registered email or phone.',
          );
        }

        // Show verification code toast in simulation mode
        await this.verificationCodeService.showPasswordResetCode(
          identifier,
          response.deliveryMedium,
        );

        // Navigate to confirm page after a short delay
        setTimeout(() => {
          this.router.navigate(['/forgot-password/confirm']);
        }, 2000);
      },
      error: (err: unknown) => {
        this.loading.set(false);

        // Handle rate limit errors specifically
        if (
          err instanceof NAuthClientError &&
          err.code === NAuthErrorCode.RATE_LIMIT_PASSWORD_RESET
        ) {
          this.error.set('Too many reset requests. Please try again later.');
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
