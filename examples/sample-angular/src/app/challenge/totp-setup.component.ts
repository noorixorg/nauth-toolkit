import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  signal,
  computed,
  inject,
  input,
  output,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, AuthResponse, NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client/angular';
import {
  AuthChallenge,
  MFASetupResponse,
  NAuthClientConfig,
  GetSetupDataResponse,
} from '@nauth-toolkit/client';
import { InputOtpModule } from 'primeng/inputotp';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { handleAuthError } from '../utils/error-handler.util';

/**
 * TOTP Setup Component
 *
 * Handles TOTP (Time-based One-Time Password) MFA setup flow:
 * 1. Displays QR code and manual entry key
 * 2. Accepts verification code from authenticator app
 * 3. Completes setup and navigates to next challenge or success
 *
 * @example
 * ```typescript
 * // Component is used within MFA setup flow
 * <app-totp-setup [session]="challengeSession" (setupComplete)="handleComplete($event)" />
 * ```
 */
@Component({
  selector: 'app-totp-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputOtpModule, ButtonModule, MessageModule],
  templateUrl: './totp-setup.component.html',
})
export class TotpSetupComponent implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Challenge session token (optional for authenticated flow)
   */
  session = input<string>();

  /**
   * Whether this is authenticated flow (from dashboard) vs challenge flow (signup)
   */
  isAuthenticatedFlow = input<boolean>(false);

  /**
   * Whether this component is embedded (in mfa-setup) or standalone (on its own route)
   */
  isEmbedded = input<boolean>(false);

  /**
   * Emitted when setup is completed successfully
   */
  setupComplete = output<void>();

  /**
   * Emitted when setup is cancelled
   */
  setupCancelled = output<void>();

  /**
   * Setup data from backend (QR code, secret, manual entry key)
   */
  setupData = signal<GetSetupDataResponse | null>(null);

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * Whether the manual key was copied (for visual feedback)
   */
  copied = signal(false);

  /**
   * TOTP verification form
   */
  totpForm: FormGroup;

  /**
   * Destroy subject for cleanup
   */
  private readonly destroy$ = new Subject<void>();

  /**
   * ViewChild reference to OTP input for setting autocomplete attribute
   */
  @ViewChild('otpInput', { read: ElementRef }) otpInputRef?: ElementRef;

  /**
   * TOTP QR code from setup data
   */
  totpQrCode = computed(() => {
    const data = this.setupData();
    if (!data) return null;
    return data.setupData['qrCode'] as string | null;
  });

  /**
   * TOTP manual entry key from setup data
   */
  totpManualKey = computed(() => {
    const data = this.setupData();
    if (!data) return null;
    return data.setupData['manualEntryKey'] as string | null;
  });

  /**
   * TOTP secret from setup data (required for verification)
   */
  totpSecret = computed(() => {
    const data = this.setupData();
    if (!data) return null;
    return data.setupData['secret'] as string | null;
  });

  /**
   * Injected client configuration
   */
  private readonly config = inject<NAuthClientConfig>(NAUTH_CLIENT_CONFIG);

  /**
   * Change detector reference for manual change detection
   */
  private readonly cdr = inject(ChangeDetectorRef);

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
    this.totpForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });
  }

  /**
   * Initialize component
   *
   * Loads TOTP setup data from backend.
   */
  ngOnInit(): void {
    this.loadSetupData();
  }

  /**
   * Set autocomplete attribute on OTP input after view initialization
   */
  ngAfterViewInit(): void {
    if (this.otpInputRef?.nativeElement) {
      const firstInput = this.otpInputRef.nativeElement.querySelector('input');
      if (firstInput) {
        firstInput.setAttribute('autocomplete', 'one-time-code');
      }
    }
  }

  /**
   * Load TOTP setup data from backend
   */
  private async loadSetupData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      let response: GetSetupDataResponse;

      // Use different API based on flow type
      if (this.isAuthenticatedFlow()) {
        // Authenticated flow - use direct MFA setup endpoint
        const client = this.auth.getClient();
        const setupData = (await client.setupMfaDevice('totp')) as Record<string, unknown>;
        response = { setupData };
      } else {
        // Challenge flow - use challenge-based endpoint
        const session = this.session();
        if (!session) {
          this.error.set('Invalid session');
          this.loading.set(false);
          return;
        }
        const resp = await this.auth.getSetupData(session, 'totp');
        if (!resp) {
          throw new Error('Failed to get TOTP setup data');
        }
        response = resp;
      }

      const qrCode = response.setupData['qrCode'] as string | undefined;
      if (!qrCode) {
        throw new Error('Failed to generate TOTP QR code');
      }

      this.setupData.set(response);
      this.loading.set(false);
    } catch (err) {
      this.loading.set(false);
      this.handleError(err);
    }
  }

  /**
   * Complete TOTP setup with verification code
   */
  async completeSetup(): Promise<void> {
    if (this.totpForm.invalid) {
      this.totpForm.markAllAsTouched();
      return;
    }

    const code = this.totpForm.get('code')?.value;
    if (!code) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // TOTP verification requires both secret and code
      const secret = this.totpSecret();
      if (!secret) {
        this.error.set('TOTP secret not found. Please refresh and try again.');
        this.loading.set(false);
        return;
      }

      if (this.isAuthenticatedFlow()) {
        // Authenticated flow - use direct MFA verify endpoint
        const client = this.auth.getClient();
        await client.verifyMfaSetup('totp', {
          secret,
          code: code.trim(),
        });

        // Emit success event
        this.setupComplete.emit();
      } else {
        // Challenge flow - use challenge response endpoint
        const session = this.session();
        if (!session) {
          this.error.set('Invalid session');
          this.loading.set(false);
          return;
        }

        const response: MFASetupResponse = {
          type: AuthChallenge.MFA_SETUP_REQUIRED,
          session,
          method: 'totp',
          setupData: {
            secret,
            code: code.trim(),
          },
        };

        const authResponse = await this.auth.respondToChallenge(response);
        if (!authResponse) {
          throw new Error('Failed to complete TOTP setup');
        }

        // Handle next challenge or success
        this.handleNextChallenge(authResponse);
      }
    } catch (err) {
      this.loading.set(false);
      this.handleError(err);
    }
  }

  /**
   * Copy text to clipboard
   *
   * @param text - Text to copy
   */
  /**
   * Copy text to clipboard
   *
   * Silently handles errors - clipboard operations may fail in some browsers/environments.
   * Shows visual feedback by changing icon from copy to checkmark.
   *
   * @param text - Text to copy
   */
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      // Defer the state change to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.copied.set(true);
        this.cdr.markForCheck();
        setTimeout(() => {
          this.copied.set(false);
          this.cdr.markForCheck();
        }, 2000);
      }, 0);
    } catch (err) {
      // Silently handle clipboard errors - non-critical operation
      // Clipboard may not be available in all environments
    }
  }

  /**
   * Go back to method selection or dashboard
   */
  goBack(): void {
    if (this.isAuthenticatedFlow()) {
      // Navigate back to dashboard for authenticated flow
      this.router.navigate(['/dashboard']);
    } else {
      // For challenge flow, emit cancellation event
      this.setupCancelled.emit();
    }
  }

  /**
   * Handle next challenge or navigate to success
   *
   * @param response - Auth response after challenge completion
   */
  private handleNextChallenge(response: AuthResponse): void {
    if (response.challengeName) {
      // Another challenge is required (e.g., email/phone verification)
      const challengeRoute = `/auth/challenge/${response.challengeName.toLowerCase().replace(/_/g, '-')}`;
      this.router.navigate([challengeRoute]);
    } else {
      // Setup complete, navigate to dashboard
      this.router.navigate([this.config.redirects?.success || '/']);
    }
  }

  /**
   * Handle errors
   *
   * @param err - Error object
   */
  private handleError(err: unknown): void {
    handleAuthError(err, this.error);
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
