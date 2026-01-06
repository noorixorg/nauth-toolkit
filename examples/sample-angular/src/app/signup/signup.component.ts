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
import { AuthService, AuthResponse, SocialProvider } from '@nauth-toolkit/client-angular/standalone';
import { NAuthClientError } from '@nauth-toolkit/client';
import { InputTextModule } from 'primeng/inputtext';
import { AutoFocusModule } from 'primeng/autofocus';
import { InputMaskModule } from 'primeng/inputmask';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { CommonModule } from '@angular/common';
import { ChallengeOrchestratorService } from '../services/challenge-orchestrator.service';
import { SimulatedVerificationCodeService } from '../services/simulated-verification-code.service';
import { handleAuthError } from '../utils/error-handler.util';
import { faker } from '@faker-js/faker';

/**
 * Phone number validator for E.164 format
 *
 * Validates phone numbers in E.164 format (e.g., +14155552671)
 *
 * @param control - Form control to validate
 * @returns Validation errors or null if valid
 */
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const phone = control.value;

  if (!phone) {
    return null; // Let required validator handle empty values
  }

  // Remove whitespace and mask placeholder characters (underscores, spaces)
  const cleaned = phone.replace(/[\s_]/g, '');

  // E.164 format: + followed by 1-15 digits
  const e164Pattern = /^\+[1-9]\d{1,14}$/;

  if (!e164Pattern.test(cleaned)) {
    return {
      phoneFormat: { message: 'Phone must be in E.164 format with + prefix (e.g., +14155552671)' },
    };
  }

  return null;
}

/**
 * Password match validator
 *
 * Validates that confirm password matches the password field.
 *
 * @param control - Form control to validate
 * @returns Validation errors or null if valid
 */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
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
 * Signup component
 *
 * Handles user registration with email/password and social providers.
 * Uses PrimeNG components for UI and AuthService for authentication.
 * PrimeNG password component provides built-in strength feedback.
 *
 * @example
 * ```typescript
 * // Route configuration
 * { path: 'signup', component: SignupComponent }
 * ```
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    AutoFocusModule,
    InputMaskModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    DividerModule,
    TooltipModule,
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent implements OnInit {
  /**
   * Signup form group
   */
  signupForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * @param fb - Form builder for reactive forms
   * @param auth - Auth service for authentication
   * @param router - Router for navigation
   * @param orchestrator - Challenge orchestrator service
   */
  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly orchestrator: ChallengeOrchestratorService,
    private readonly verificationCodeService: SimulatedVerificationCodeService,
  ) {
    this.signupForm = this.fb.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.required, phoneValidator, Validators.maxLength(20)]],
      password: [
        'Welcome1$',
        [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      ],
      confirmPassword: ['Welcome1$', [Validators.required, passwordMatchValidator]],
    });
  }

  ngOnInit(): void {
    this.auth.authEvents$.subscribe((_event) => {
      // Handle auth events if needed
    });

    // Re-validate confirm password when password changes
    this.signupForm.get('password')?.valueChanges.subscribe(() => {
      this.signupForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  /**
   * Handle form submission
   *
   * Registers user and navigates to dashboard on success.
   * Handles challenge responses (email/phone verification, etc.).
   */
  async onSubmit(): Promise<void> {
    if (this.signupForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.signupForm.controls).forEach((key) => {
        this.signupForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { firstName, lastName, email, phone, password } = this.signupForm.value;

    // Format phone number (remove whitespace and mask placeholder characters)
    const formattedPhone = phone ? phone.replace(/[\s_]/g, '') : undefined;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response: AuthResponse = await this.auth.signup({
        email: normalizedEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: formattedPhone,
        metadata: {
          invite_code: '92837984372',
        },
      });
      // Universal handler for signup, challenges, and redirects
      await this.orchestrator.handleAuthResponse(response);
    } catch (err: unknown) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle social signup
   *
   * Initiates OAuth flow for the specified provider.
   *
   * @param provider - Social provider (google, apple, facebook)
   */
  async onSocialSignup(provider: SocialProvider): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.loginWithSocial(provider, { returnTo: '/auth/callback' });
    } catch (err: unknown) {
      this.loading.set(false);
      this.handleError(err);
    }
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Populate form with random data using faker
   *
   * Generates random first name, last name, email, and phone number
   * and populates the signup form fields.
   * Email uses a random domain instead of known email providers.
   */
  populateRandomData(): void {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    // Generate email with random domain (not known email providers)
    const randomDomain = faker.internet.domainName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomDomain}`;
    // Generate phone in E.164 format: +[country code][number]
    const phone = `+1${faker.string.numeric(10)}`;

    this.signupForm.patchValue({
      firstName,
      lastName,
      email,
      phone,
    });

    // Mark fields as touched to show validation if needed
    this.signupForm.get('firstName')?.markAsTouched();
    this.signupForm.get('lastName')?.markAsTouched();
    this.signupForm.get('email')?.markAsTouched();
    this.signupForm.get('phone')?.markAsTouched();
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
