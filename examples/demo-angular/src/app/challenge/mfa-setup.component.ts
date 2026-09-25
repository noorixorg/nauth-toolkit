import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { InputMaskModule } from 'primeng/inputmask';
import { Subject, takeUntil } from 'rxjs';

import { AuthService, AuthResponse } from '@nauth-toolkit/client-angular/standalone';
import {
  AuthChallenge,
  MFAMethod,
  MFASetupResponse,
  NAuthClientError,
  NAuthErrorCode,
  requiresPhoneCollection,
} from '@nauth-toolkit/client';
import { TotpSetupComponent } from './totp-setup.component';
import { PasskeySetupComponent } from './passkey-setup.component';
import { getMfaMethodName } from '../utils/mfa-method.util';
import { handleAuthError } from '../utils/error-handler.util';
import { phoneFormatValidator } from '../utils/phone-validator.util';

/**
 * MFA Setup Component - Method Selector ONLY
 *
 * This component ONLY handles method selection.
 * It delegates to other components for actual setup:
 * - TotpSetupComponent for TOTP
 * - PasskeySetupComponent for Passkey
 * - OtpVerifyComponent for SMS/Email (via navigation)
 */
@Component({
  selector: 'app-mfa-setup',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    MessageModule,
    InputMaskModule,
    TotpSetupComponent,
    PasskeySetupComponent,
  ],
  templateUrl: './mfa-setup.component.html',
  styleUrl: './mfa-setup.component.css',
})
export class MfaSetupComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  protected readonly challenge = signal<AuthResponse | null>(null);
  protected readonly selectedMethod = signal<MFAMethod | null>(null);
  protected readonly setupData = signal<{
    autoCompleted?: boolean;
    deviceId?: number;
    maskedPhone?: string;
    maskedEmail?: string;
  } | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly mfaStatus = signal<{
    methods?: string[];
    configuredMethods?: string[];
    availableMethods: string[];
  } | null>(null);

  /**
   * Whether the SMS phone-collection form is currently shown.
   *
   * True when the account has no phone number and SMS was selected as the
   * MFA method - either detected up front via `requiresPhoneCollection()`
   * (challenge flow) or after the backend responds with `PHONE_REQUIRED`
   * (authenticated flow).
   */
  protected readonly collectingPhone = signal(false);

  /**
   * Phone collection form (SMS setup) - single `phone` control in E.164 format.
   */
  protected readonly phoneForm: FormGroup = this.fb.group({
    phone: ['', [Validators.required, phoneFormatValidator, Validators.maxLength(20)]],
  });

  protected readonly isAuthenticatedFlow = computed(() => {
    return !this.challenge() && this.auth.isAuthenticated();
  });

  protected readonly availableMethods = computed(() => {
    if (this.isAuthenticatedFlow()) {
      const status = this.mfaStatus();
      if (!status) return [];
      const configuredMethods = Array.isArray(status.methods)
        ? status.methods
        : Array.isArray(status.configuredMethods)
          ? status.configuredMethods
          : [];

      return (status.availableMethods || []).filter((m: string) => {
        if (m === 'backup') return false;
        // Allow multiple devices for these methods.
        if (m === 'totp' || m === 'passkey') return true;
        return !configuredMethods.includes(m);
      });
    } else {
      const challenge = this.challenge();
      const params = challenge?.challengeParameters;
      const methods = (params?.['allowedMethods'] as MFAMethod[]) || [];
      return methods;
    }
  });

  protected readonly smsAvailable = computed(() => this.availableMethods().includes('sms'));
  protected readonly emailAvailable = computed(() => this.availableMethods().includes('email'));
  protected readonly totpAvailable = computed(() => this.availableMethods().includes('totp'));
  protected readonly passkeyAvailable = computed(() => this.availableMethods().includes('passkey'));

  protected readonly instructions = computed(() => {
    if (this.isAuthenticatedFlow()) {
      return 'Choose an additional authentication method to enhance your account security.';
    }
    return 'Please select a multi-factor authentication method to continue.';
  });

  /**
   * Computed back button text based on current state
   */
  protected readonly backButtonText = computed(() => {
    if (this.selectedMethod()) {
      return 'Back to method selection';
    }
    return this.isAuthenticatedFlow() ? 'Back to Dashboard' : 'Back to Login';
  });

  async ngOnInit(): Promise<void> {
    if (this.auth.isAuthenticated() && !this.auth.getCurrentChallenge()) {
      await this.loadMfaStatus();
    } else {
      this.auth.challenge$.pipe(takeUntil(this.destroy$)).subscribe((challenge) => {
        this.loadChallenge(challenge);
      });

      const currentChallenge = this.auth.getCurrentChallenge();
      if (currentChallenge) {
        this.loadChallenge(currentChallenge);
      } else {
        this.router.navigate(['/login']);
      }
    }

    // Support deep-linking directly into the SMS phone-collection form, e.g. from
    // otp-verify's "Use a different number" link (?collectPhone=1). Applied after
    // the challenge/status load above, since loadChallenge() resets selectedMethod.
    if (this.route.snapshot.queryParams['collectPhone'] === '1') {
      this.selectedMethod.set('sms');
      this.collectingPhone.set(true);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadMfaStatus(): Promise<void> {
    this.loading.set(true);
    try {
      const client = this.auth.getClient();
      const status = await client.getMfaStatus();
      this.mfaStatus.set(status);
    } catch {
      this.error.set('Failed to load MFA methods. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private loadChallenge(challenge: AuthResponse | null): void {
    if (!challenge) {
      this.router.navigate(['/login']);
      return;
    }

    if (challenge.challengeName !== AuthChallenge.MFA_SETUP_REQUIRED) {
      if (challenge.challengeName) {
        const challengeRoute = `/auth/challenge/${challenge.challengeName.toLowerCase().replace(/_/g, '-')}`;
        this.router.navigate([challengeRoute]);
      } else {
        this.router.navigate(['/login']);
      }
      return;
    }

    this.challenge.set(challenge);
    this.error.set(null);
    this.selectedMethod.set(null);
    this.setupData.set(null);
  }

  async selectMethod(method: MFAMethod): Promise<void> {
    if (method === 'totp' || method === 'passkey') {
      this.selectedMethod.set(method);
      return;
    }

    if (method !== 'sms' && method !== 'email') {
      this.error.set(`${method.toUpperCase()} setup is not yet implemented.`);
      return;
    }

    // Challenge flow: the challenge already tells us whether the account has no
    // phone number, so we can show the phone form up front without a round trip.
    if (method === 'sms' && !this.isAuthenticatedFlow()) {
      const challenge = this.challenge();
      if (challenge && requiresPhoneCollection(challenge)) {
        this.selectedMethod.set('sms');
        this.collectingPhone.set(true);
        this.error.set(null);
        return;
      }
    }

    this.error.set(null);

    try {
      await this.startCodeSetup(method);
    } catch (err) {
      // Authenticated flow: no challenge parameters to inspect ahead of time, so
      // the backend tells us via PHONE_REQUIRED that the phone form is needed.
      if (
        method === 'sms' &&
        err instanceof NAuthClientError &&
        err.code === NAuthErrorCode.SIGNUP_PHONE_REQUIRED
      ) {
        this.selectedMethod.set('sms');
        this.collectingPhone.set(true);
        this.error.set(null);
        return;
      }
      this.handleError(err);
    }
  }

  /**
   * Submit the collected phone number for SMS setup.
   *
   * Saves the number on the account (unverified), sends the verification code,
   * and either navigates to the OTP screen or shows the "already verified"
   * success screen (auto-completed).
   */
  async submitPhone(): Promise<void> {
    if (this.phoneForm.invalid) {
      this.phoneForm.get('phone')?.markAsTouched();
      return;
    }

    const rawPhone = this.phoneForm.get('phone')?.value as string;
    const phoneNumber = rawPhone.replace(/[\s_]/g, '');

    this.error.set(null);

    try {
      await this.startCodeSetup('sms', { phoneNumber });
    } catch (err) {
      // Phone form stays open so the user can correct the number and retry
      // (e.g. INVALID_PHONE_FORMAT, PHONE_EXISTS, RATE_LIMIT_RESEND).
      this.handleError(err);
    }
  }

  /**
   * Request MFA setup data (send/resend the verification code) for SMS or email.
   *
   * Shared by the direct method-selection flow and the phone-collection form:
   * - Authenticated flow: `client.setupMfaDevice(method, setupData)`
   * - Challenge flow: `auth.getSetupData(session, method, setupData)`
   *
   * On success, either shows the auto-completed screen (already-verified
   * destination) or navigates to the OTP verification screen. Throws (after
   * clearing `loading`) so callers can inspect the error - e.g. to detect
   * `PHONE_REQUIRED` and switch to the phone form - falling back to the
   * generic max-attempts handling here.
   *
   * @param method - MFA method to set up ('sms' or 'email')
   * @param setupData - Optional method-specific input (SMS: `{ phoneNumber }`)
   */
  private async startCodeSetup(
    method: 'sms' | 'email',
    setupData?: Record<string, unknown>,
  ): Promise<void> {
    this.loading.set(true);

    try {
      let result: { setupData: Record<string, unknown> };

      if (this.isAuthenticatedFlow()) {
        // Authenticated flow: use setupMfaDevice (no challenge session needed)
        // Backend returns { setupData: { autoCompleted: true, deviceId: ... } } or { setupData: { maskedPhone: ... } }
        const setupResult = await this.auth.getClient().setupMfaDevice(method, setupData);
        result = setupResult as { setupData: Record<string, unknown> };
      } else {
        // Challenge flow: use getSetupData (requires challenge session)
        const challenge = this.challenge();
        if (!challenge?.session) {
          throw new Error('Invalid challenge session');
        }

        const setupResult = await this.auth.getSetupData(challenge.session, method, setupData);
        if (!setupResult) {
          throw new Error('Failed to get setup data');
        }
        result = setupResult;
      }

      // Check if setup was auto-completed (phone/email already verified)
      const autoCompleted = result.setupData['autoCompleted'] === true;

      if (autoCompleted) {
        // Auto-completed - show success screen
        this.setupData.set({
          autoCompleted: true,
          deviceId: result.setupData['deviceId'] as number,
        });
        this.selectedMethod.set(method);
        this.collectingPhone.set(false);
        this.loading.set(false);
      } else {
        // Code was sent - navigate to OTP verification component
        const maskedDest =
          (result.setupData['maskedPhone'] as string) ||
          (result.setupData['maskedEmail'] as string);
        this.loading.set(false);
        this.collectingPhone.set(false);

        // Navigate to dedicated MFA setup OTP verification route
        // The challenge session is already in AuthService, so OTP component will detect it
        this.router.navigate(['/auth/challenge/mfa-setup-required/verify'], {
          queryParams: {
            method,
            maskedDestination: maskedDest,
            mode: this.isAuthenticatedFlow() ? 'setup' : undefined,
          },
        });
      }
    } catch (err) {
      this.loading.set(false);
      // Check if error is max attempts exceeded
      if (err instanceof NAuthClientError && err.code === NAuthErrorCode.CHALLENGE_MAX_ATTEMPTS) {
        // Clear challenge to allow new one to be created when user tries again
        this.auth.clearChallenge();
        this.error.set(
          'Maximum challenge attempts exceeded. Please go back and try again to start a new challenge.',
        );
        return;
      }
      throw err;
    }
  }

  navigateBack(): void {
    if (this.isAuthenticatedFlow()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Reset to method selection state
   *
   * Clears all setup-related state to allow user to select a different method.
   * Does not clear the challenge session - it remains valid for method selection.
   * Challenge is only cleared when explicitly needed (e.g., max attempts exceeded).
   */
  backToSelection(): void {
    this.selectedMethod.set(null);
    this.setupData.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.collectingPhone.set(false);
    this.phoneForm.reset();

    // For unauthenticated flows, validate challenge exists but don't clear it
    // The challenge session should remain valid for method selection
    if (!this.isAuthenticatedFlow()) {
      const challenge = this.auth.getCurrentChallenge();
      if (!challenge || challenge.challengeName !== AuthChallenge.MFA_SETUP_REQUIRED) {
        // Challenge expired or invalid - redirect to login
        this.router.navigate(['/login']);
      }
      // Don't clear challenge - it's needed for method selection
      // Challenge will be cleared only in specific cases (e.g., max attempts exceeded)
    }
  }

  /**
   * Continue to dashboard after auto-completed setup
   */
  async continueToDashboard(): Promise<void> {
    const setupData = this.setupData();
    const method = this.selectedMethod();

    if (!setupData?.deviceId || !method) {
      this.error.set('Invalid setup state');
      return;
    }

    // For authenticated flow, device is already created - just navigate to dashboard
    if (this.isAuthenticatedFlow()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // For challenge flow, need to respond to challenge to complete setup
    const challenge = this.challenge();
    if (!challenge?.session) {
      this.error.set('Invalid challenge session');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const setupResponse: MFASetupResponse = {
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: challenge.session,
        method: method as 'sms' | 'email',
        setupData: {
          deviceId: setupData.deviceId,
        },
      };

      const authResponse = await this.auth.respondToChallenge(setupResponse);
      if (!authResponse) {
        throw new Error('Failed to complete MFA setup');
      }

      // Handle next challenge or navigate to dashboard
      if (authResponse.challengeName) {
        const challengeRoute = `/auth/challenge/${authResponse.challengeName.toLowerCase().replace(/_/g, '-')}`;
        this.router.navigate([challengeRoute]);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (err) {
      this.loading.set(false);
      this.handleError(err);
    }
  }

  /**
   * Get method display name
   */
  getMethodName(method: MFAMethod): string {
    return getMfaMethodName(method);
  }

  /**
   * Get masked destination (phone or email)
   */
  getMaskedDestination(): string | null {
    const data = this.setupData();
    if (!data) return null;
    return data.maskedPhone || data.maskedEmail || null;
  }

  onTotpSetupComplete(): void {
    if (this.isAuthenticatedFlow()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onTotpSetupCancelled(): void {
    this.backToSelection();
  }

  /**
   * Handle passkey setup completion
   *
   * Only called for authenticated flow (from dashboard).
   * Challenge flow navigation is handled directly by passkey component.
   */
  onPasskeySetupComplete(): void {
    if (this.isAuthenticatedFlow()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onPasskeySetupCancelled(): void {
    this.backToSelection();
  }

  private handleError(err: unknown): void {
    handleAuthError(err, this.error);
  }
}
