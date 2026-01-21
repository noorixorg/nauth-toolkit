import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, SocialProvider } from '@nauth-toolkit/client-angular/standalone';
import { InputTextModule } from 'primeng/inputtext';
import { AutoFocusModule } from 'primeng/autofocus';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { CommonModule } from '@angular/common';
import { handleAuthError } from '../utils/error-handler.util';

/**
 * Login component
 *
 * Handles user authentication with email/password.
 * Uses PrimeNG components for UI and AuthService for authentication.
 *
 * @example
 * ```typescript
 * // Route configuration
 * { path: 'login', component: LoginComponent }
 * ```
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    AutoFocusModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    DividerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  /**
   * Login form group
   */
  loginForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * Success message signal (for password reset success)
   */
  success = signal<string | null>(null);

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
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    this.auth.authEvents$.subscribe((_event) => {
      // Handle auth events if needed
    });

    // Check for password reset success query param
    this.route.queryParams.subscribe((params) => {
      if (params['passwordReset'] === 'success') {
        this.success.set('Password reset successful. Please sign in with your new password.');
        // Clear query params
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
        // Clear success message after 5 seconds
        setTimeout(() => {
          this.success.set(null);
        }, 5000);
      }
    });
  }

  /**
   * Handle form submission
   *
   * Authenticates user - SDK handles navigation automatically to dashboard or challenges.
   */
  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.loginForm.value;

    try {
      // SDK automatically navigates to challenge or success route
      await this.auth.login(email, password);
    } catch (err: unknown) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle social login
   *
   * Initiates OAuth flow for the specified provider.
   *
   * @param provider - Social provider (google, apple, facebook)
   */
  async onSocialLogin(provider: SocialProvider): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.loginWithSocial(provider, {
        returnTo: '/auth/callback',
        appState: 'invite-code-123',
        // Google: force consent screen every time (default skips for returning users)
        // ...(provider === 'google' && { oauthParams: { prompt: 'consent' } }),
      });
    } catch (err: unknown) {
      this.loading.set(false);
      this.handleError(err);
    }
  }

  /**
   * Navigate to signup page
   */
  navigateToSignup(): void {
    this.router.navigate(['/signup']);
  }

  /**
   * Navigate to forgot password page
   */
  navigateToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
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
