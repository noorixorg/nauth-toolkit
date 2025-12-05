import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ChallengeNavigationService } from '../../services/challenge-navigation.service';
import { PlatformService } from '../../services/platform.service';
import { LoginRequest, SignupRequest } from '../../models/auth.models';
import { Toast } from '@capacitor/toast';

/**
 * Login Component
 *
 * Handles both login and signup functionality
 * Includes social login options
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  standalone: true,
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  signupForm: FormGroup;
  isLoginMode = true;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private challengeNav: ChallengeNavigationService,
    private platformService: PlatformService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.signupForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.pattern(/^\+[1-9]\d{1,14}$/)]], // E.164 format - optional
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
        firstName: [''],
        lastName: [''],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  ngOnInit(): void {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }

    // Check for error message in query params (e.g., from OAuth callback failure)
    this.route.queryParams.subscribe((params) => {
      if (params['error']) {
        this.errorMessage = params['error'];
        // Clear the error from URL
        this.router.navigate([], {
          queryParams: { error: null },
          queryParamsHandling: 'merge',
        });
      }
    });

    // Pre-fill with random test data for faster testing
    this.prefillTestData();
  }

  /**
   * Pre-fill signup form with random test data for testing
   */
  private prefillTestData(): void {
    const randomId = Math.floor(Math.random() * 100000);
    const testEmails = [
      `test${randomId}@example.com`,
      `demo${randomId}@testmail.com`,
      `user${randomId}@sample.com`,
    ];
    const testPhones = [
      `+1415555${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`,
      `+442071234${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}`,
      `+61412345${Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, '0')}`,
    ];
    const firstNames = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
    ];

    this.signupForm.patchValue({
      email: testEmails[Math.floor(Math.random() * testEmails.length)],
      phone: testPhones[Math.floor(Math.random() * testPhones.length)],
      password: 'Welcome1$',
      confirmPassword: 'Welcome1$',
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
    });
  }

  /**
   * Password match validator for signup form
   */
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }

    return null;
  }

  /**
   * Toggle between login and signup modes
   */
  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
  }

  async showToast() {
    await Toast.show({
      text: 'First i will tell you how good i am',
      duration: 'short',
    });
    await Toast.show({
      text: 'I am much nicer and less intrusive toast!',
      duration: 'short',
    });
    return;
  }
  /**
   * Handle login form submission
   */
  onLogin() {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const formValue = this.loginForm.value;
      this.authService.login(formValue.identifier, formValue.password).subscribe({
        next: (response) => {
          this.isLoading = false;

          // Check if device trust popup should be shown (user_opt_in mode, direct login - no MFA)
          if (
            response.user &&
            !response.challengeName &&
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
                  if (this.challengeNav.handleChallengeResponse(response)) {
                    return;
                  }
                  // Navigate to dashboard
                  if (response.user || (response.accessToken && response.refreshToken)) {
                    this.router.navigate(['/dashboard']);
                  }
                },
                error: (error) => {
                  console.error('Failed to trust device:', error);
                  // Continue anyway even if trust fails
                  if (this.challengeNav.handleChallengeResponse(response)) {
                    return;
                  }
                  if (response.user || (response.accessToken && response.refreshToken)) {
                    this.router.navigate(['/dashboard']);
                  }
                },
              });
              return;
            }
          }

          // Use centralized challenge navigation service
          if (this.challengeNav.handleChallengeResponse(response)) {
            // Navigation handled by service (either to challenge page or dashboard)
            return;
          }
          // Unexpected response - show error
          this.errorMessage = 'Unexpected response from server';
        },
        error: (error: any) => {
          // Always stop loading on error first
          this.isLoading = false;

          // Extract actual error message from server response (prioritize server message)
          this.errorMessage = this.extractErrorMessage(error);
        },
      });
    }
  }

  /**
   * Handle signup form submission
   *
   * Submits the signup form, handles challenge navigation via switch-case for clarity.
   *
   * @throws {Error} When signup fails or response is invalid
   *
   * @example
   * ```typescript
   * component.onSignup();
   * ```
   */
  onSignup(): void {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    if (this.signupForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const formValue = this.signupForm.value;
      this.authService
        .signup(
          formValue.email,
          formValue.password,
          formValue.firstName || undefined,
          formValue.lastName || undefined,
          formValue.phone || undefined,
        )
        .subscribe({
        next: (response) => {
          this.isLoading = false;
          // Use centralized challenge navigation service
          if (this.challengeNav.handleChallengeResponse(response)) {
            // Navigation handled by service (either to challenge page or dashboard)
            return;
          }
          // Unexpected response - show error
          this.errorMessage = 'Unexpected response from server';
        },
        error: (error: unknown) => {
          // Always stop loading on error first
          this.isLoading = false;

          // Extract actual error message from server response (prioritize server message)
          this.errorMessage = this.extractErrorMessage(error);
        },
      });
    }
  }

  /**
   * Handle social login
   *
   * Initiates social login, handles challenge navigation via switch-case for clarity.
   *
   * @param provider - Social provider name
   * @returns Promise<void>
   * @throws {Error} When social login fails or is challenged
   *
   * @example
   * ```typescript
   * await component.onSocialLogin('google');
   * ```
   */
  async onSocialLogin(provider: 'google' | 'apple' | 'facebook'): Promise<void> {
    // Prevent duplicate submissions
    if (this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithSocial(provider);
      // Always stop loading before navigation
      this.isLoading = false;
      // Redirect to dashboard
      this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      // Always stop loading on error first
      this.isLoading = false;

      // Check if this is a challenge response (native flow) - same as browser OAuth callback handling
      // Check both isChallenge flag and direct challenge property for backward compatibility
      const challengeObj = (error as any)?.challenge;
      if (
        ((error as any)?.isChallenge || challengeObj) &&
        challengeObj &&
        challengeObj.challengeName
      ) {
        // Challenge is already stored by auth service, use centralized navigation
        this.challengeNav.navigateToChallenge(challengeObj);
        return;
      }

      // Regular error - extract actual error message from server response
      this.errorMessage = this.extractErrorMessage(error);
    }
  }

  /**
   * Extract error message from error object, prioritizing actual server message
   *
   * @param error - Error object from HTTP request
   * @returns Error message string, or fallback only if no message found
   * @private
   */
  private extractErrorMessage(error: any): string {
    // Priority 1: Server's error message in error.error.message (most common)
    if (error?.error?.message && typeof error.error.message === 'string') {
      return error.error.message;
    }

    // Priority 2: Direct message property
    if (error?.message && typeof error.message === 'string') {
      return error.message;
    }

    // Priority 3: error.error is a string
    if (typeof error?.error === 'string') {
      return error.error;
    }

    // Priority 4: error.error is an object with other message-like properties
    if (error?.error) {
      if (error.error.error && typeof error.error.error === 'string') {
        return error.error.error;
      }
      if (error.error.detail && typeof error.error.detail === 'string') {
        return error.error.detail;
      }
      if (error.error.reason && typeof error.error.reason === 'string') {
        return error.error.reason;
      }
    }

    // Last resort: Only use generic fallback if we truly can't find any message
    // Only for network/server errors where we genuinely have no message
    if (error?.status >= 500 || error?.status === 0) {
      return 'Server error. Please try again later.';
    }

    // If we can't extract any message, return a generic fallback
    return 'An error occurred. Please try again.';
  }

  /**
   * Get form control for easy access in template
   */
  get loginControls() {
    return this.loginForm.controls;
  }

  /**
   * Get form control for easy access in template
   */
  get signupControls() {
    return this.signupForm.controls;
  }
}
