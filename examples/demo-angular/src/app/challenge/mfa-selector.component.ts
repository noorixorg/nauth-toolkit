import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { Subject, takeUntil } from 'rxjs';

import { AuthService, AuthResponse } from '@nauth-toolkit/client-angular/standalone';
import { AuthChallenge, MFAMethod } from '@nauth-toolkit/client';
import {
  getMfaMethodName,
  getMfaMethodIcon,
  getMfaMethodDescription,
} from '../utils/mfa-method.util';
import { handleAuthError } from '../utils/error-handler.util';

/**
 * MFA Selector Component
 *
 * Displays configured MFA methods during login (MFA_REQUIRED challenge).
 * User can select from their existing methods to verify.
 *
 * This is ONLY for login - selecting from already configured methods.
 * For setting up NEW methods, use MfaSetupComponent.
 *
 * @example
 * ```typescript
 * // Route: /auth/challenge/mfa-selector
 * // Shown when user has multiple MFA methods configured
 * ```
 */
@Component({
  selector: 'app-mfa-selector',
  imports: [CommonModule, ButtonModule, MessageModule],
  templateUrl: './mfa-selector.component.html',
  styleUrl: './mfa-selector.component.css',
})
export class MfaSelectorComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  /**
   * Current challenge session
   */
  protected readonly challenge = signal<AuthResponse | null>(null);

  /**
   * Loading state
   */
  protected readonly loading = signal(false);

  /**
   * Error message
   */
  protected readonly error = signal<string | null>(null);

  /**
   * Available MFA methods from challenge parameters
   */
  protected readonly availableMethods = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return [];
    const params = challenge.challengeParameters;
    const methods = (params?.['availableMethods'] as MFAMethod[]) || [];
    return methods;
  });

  /**
   * Device information from challenge parameters
   * Contains individual devices for methods that support multiple devices (TOTP, Passkey)
   */
  protected readonly devices = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return [];
    // SDK helper method - zero manual parsing needed!
    return this.auth.getMFADevicesFromChallenge(challenge);
  });

  /**
   * Preferred device ID from challenge parameters
   */
  protected readonly preferredDeviceId = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return undefined;
    return challenge.challengeParameters?.['preferredDeviceId'] as number | undefined;
  });

  /**
   * Preferred method from challenge parameters
   */
  protected readonly preferredMethod = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return null;
    const params = challenge.challengeParameters;
    return (params?.['preferredMethod'] as MFAMethod) || (params?.['method'] as MFAMethod) || null;
  });

  /**
   * Whether SMS method is available
   */
  protected readonly smsAvailable = computed(() => this.availableMethods().includes('sms'));

  /**
   * Whether Email method is available
   */
  protected readonly emailAvailable = computed(() => this.availableMethods().includes('email'));

  /**
   * Whether TOTP method is available
   */
  protected readonly totpAvailable = computed(() => this.availableMethods().includes('totp'));

  /**
   * Whether Passkey method is available
   */
  protected readonly passkeyAvailable = computed(() => this.availableMethods().includes('passkey'));

  /**
   * TOTP devices (if multiple exist)
   */
  protected readonly totpDevices = computed(() => {
    return this.devices().filter((d) => d.type === 'totp');
  });

  /**
   * Passkey devices (if multiple exist)
   */
  protected readonly passkeyDevices = computed(() => {
    return this.devices().filter((d) => d.type === 'passkey');
  });

  /**
   * Whether TOTP has multiple devices
   */
  protected readonly hasMultipleTotpDevices = computed(() => this.totpDevices().length > 1);

  /**
   * Whether Passkey has multiple devices
   */
  protected readonly hasMultiplePasskeyDevices = computed(() => this.passkeyDevices().length > 1);

  ngOnInit(): void {
    this.auth.challenge$.pipe(takeUntil(this.destroy$)).subscribe((challenge) => {
      this.challenge.set(challenge);

      if (!challenge) {
        // Challenge can briefly be null during navigation or after successful
        // verification, especially on slower connections. In those cases the
        // orchestrator will navigate away (to dashboard or next challenge)
        // and showing a transient error here causes a visible flicker.
        // Instead of surfacing an error, clear any existing one and let
        // the router / orchestrator drive the next state.
        this.error.set(null);
        return;
      }

      if (challenge.challengeName !== AuthChallenge.MFA_REQUIRED) {
        this.error.set('Invalid challenge type. Expected MFA_REQUIRED.');
        return;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Select MFA method for verification
   *
   * Routes to the appropriate component based on method.
   * SDK automatically handles deviceId tracking internally.
   *
   * @param method - Selected MFA method
   * @param deviceId - Optional device ID when multiple devices exist for the method
   */
  async selectMethod(method: MFAMethod, deviceId?: number): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || !challenge.session) {
      this.error.set('Invalid challenge session');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // Tell SDK which device was selected - SDK stores it internally
      if (deviceId) {
        this.auth.selectMFADevice(deviceId);
      }

      // Navigate to verification component - NO deviceId query params needed!
      // SDK will auto-inject deviceId when respondToChallenge() is called
      if (method === 'passkey') {
        await this.router.navigate(['/auth/challenge/mfa-required/passkey']);
      } else {
        await this.router.navigate(['/auth/challenge/mfa-required'], {
          queryParams: { method }, // Only pass method, SDK handles deviceId
        });
      }
    } catch (err) {
      handleAuthError(err, this.error);
      this.loading.set(false);
    }
  }

  /**
   * Get method display name
   */
  getMethodName(method: MFAMethod): string {
    return getMfaMethodName(method);
  }

  /**
   * Get method icon
   */
  getMethodIcon(method: MFAMethod): string {
    return getMfaMethodIcon(method);
  }

  /**
   * Get method description
   */
  getMethodDescription(method: MFAMethod): string {
    return getMfaMethodDescription(method);
  }

  /**
   * Navigate back to login
   */
  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
