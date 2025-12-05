import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
// HttpClient no longer needed - using AuthService methods
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ChallengeNavigationService } from '../../../services/challenge-navigation.service';
import { AuthChallengeResponse, UnifiedAuthResponse } from '../../../models/auth.models';
import { MFAMethodSelectorComponent } from '../mfa-method-selector/mfa-method-selector.component';
import { SMSVerificationComponent } from '../sms-verification/sms-verification.component';
import { TOTPSetupComponent } from '../totp-setup/totp-setup.component';
import { PasskeySetupComponent } from '../passkey-setup/passkey-setup.component';
import { BackupCodesDisplayComponent } from '../backup-codes-display/backup-codes-display.component';
import { MFADeviceMethod, MFAVerificationMethod } from '../../../types/mfa.types';

/**
 * MFA Setup Content Component
 *
 * Unified component for MFA setup that can be used:
 * - As a full page (login/signup flow) - mode: 'page'
 * - In a dialog (dashboard) - mode: 'dialog'
 *
 * Handles method selection, SMS setup, TOTP setup, and backup codes display.
 *
 * @example
 * ```html
 * <!-- Page mode (login/signup) -->
 * <app-mfa-setup-content
 *   mode="page"
 *   [challengeSession]="challengeSession"
 *   (completed)="onCompleted($event)"
 * />
 *
 * <!-- Dialog mode (dashboard) -->
 * <app-mfa-setup-content
 *   mode="dialog"
 *   [allowedMethods]="availableMethods"
 *   [userPhone]="user?.phone"
 *   (completed)="onCompleted()"
 *   (cancelled)="onCancelled()"
 * />
 * ```
 */
@Component({
  selector: 'app-mfa-setup-content',
  templateUrl: './mfa-setup-content.component.html',
  styleUrls: ['./mfa-setup-content.component.scss'],
  imports: [
    CommonModule,
    MFAMethodSelectorComponent,
    SMSVerificationComponent,
    TOTPSetupComponent,
    PasskeySetupComponent,
    BackupCodesDisplayComponent,
  ],
  standalone: true,
})
export class MFASetupContentComponent implements OnInit, OnDestroy {
  /**
   * Display mode: 'page' for full page (login/signup), 'dialog' for modal dialog (dashboard)
   */
  @Input() mode: 'page' | 'dialog' = 'page';

  /**
   * Challenge session (for page mode during login/signup)
   */
  @Input() challengeSession: AuthChallengeResponse | null = null;

  /**
   * Allowed MFA methods (for dialog mode from dashboard)
   */
  @Input() allowedMethods: Array<MFAVerificationMethod> = ['sms', 'email', 'totp', 'passkey'];

  /**
   * User's phone number (for dialog mode)
   */
  @Input() userPhone?: string;

  /**
   * Preselected method (for dialog mode - directly opens setup for this method)
   */
  @Input() preselectedMethod?: MFADeviceMethod;

  /**
   * Emitted when setup is completed successfully
   */
  @Output() completed = new EventEmitter<{
    method: MFADeviceMethod;
    backupCodes?: string[];
  }>();

  /**
   * Emitted when setup is cancelled (dialog mode only)
   */
  @Output() cancelled = new EventEmitter<void>();

  // Internal state
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedMethod: MFADeviceMethod | null = null;
  step: 'select' | 'verify' = 'select';
  maskedPhone = 'your phone'; // Initialize with default value
  maskedEmail = 'your email'; // Initialize with default value
  resendCooldown = 0;
  totpSetupData: {
    secret: string;
    qrCode: string;
    manualEntryKey: string;
    issuer: string;
    accountName: string;
  } | null = null;
  passkeySetupOptions: Record<string, unknown> | null = null;
  expectedChallenge: string = '';
  backupCodes: string[] = [];
  showBackupCodes = false;
  private lastAuthResponse: UnifiedAuthResponse | null = null; // Store response when backup codes are shown

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    // HttpClient removed - using AuthService instead
    private authService: AuthService,
    private challengeNav: ChallengeNavigationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.mode === 'page') {
      // Page mode: initialize from challenge session
      const challenge = this.challengeSession || this.authService.getStoredChallenge();
      if (challenge) {
        const allowed = challenge.challengeParameters?.['allowedMethods'] as
          | Array<'totp' | 'sms' | 'email' | 'passkey'>
          | undefined;
        this.allowedMethods = (allowed || ['sms', 'email', 'totp', 'passkey']) as Array<MFAVerificationMethod>;

        // If only one method allowed (excluding backup), auto-select it
        const setupMethods = this.getSetupAllowedMethods();
        if (setupMethods.length === 1) {
          this.onMethodSelected(setupMethods[0]);
        }
      }
    } else if (this.mode === 'dialog' && this.preselectedMethod) {
      // Dialog mode: if a method is preselected, auto-select it
      if (this.allowedMethods.includes(this.preselectedMethod)) {
        this.onMethodSelected(this.preselectedMethod);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  /**
   * Handle method selection
   */
  onMethodSelected(method: MFADeviceMethod): void {
    this.selectedMethod = method;
    this.errorMessage = '';
    this.successMessage = '';

    if (method === 'sms') {
      // For dialog mode, set masked phone immediately if available
      if (this.mode === 'dialog' && this.userPhone) {
        const digits = this.userPhone.replace(/\D/g, '');
        this.maskedPhone = digits.length >= 4 ? `***-***-${digits.slice(-4)}` : this.userPhone;
      }
      // Don't set step to 'verify' yet - wait for API response to see if auto-completed
      // This prevents showing verification UI briefly when phone is already verified
      this.startSMSSetup();
    } else if (method === 'email') {
      // For dialog mode, set masked email immediately if available
      if (this.mode === 'dialog') {
        // Email will be masked by backend response
        this.maskedEmail = 'your email';
      }
      // Don't set step to 'verify' yet - wait for API response to see if auto-completed
      this.startEmailSetup();
    } else if (method === 'totp') {
      this.step = 'verify';
      this.startTOTPSetup();
    } else if (method === 'passkey') {
      this.step = 'verify';
      this.startPasskeySetup();
    }
  }

  /**
   * Start SMS setup
   */
  private startSMSSetup(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to get setup data
      this.authService.getSetupData(this.challengeSession.session, 'sms').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          // Check if setup was auto-completed (phone already verified)
          if (response.autoCompleted && response.deviceId && this.challengeSession) {
            // Phone already verified - MFA device was auto-created
            // Complete the challenge by calling setupMFA with empty code (device already verified)
            // The backend will recognize the device is already set up and complete the challenge
            this.authService
              .setupMFA(this.challengeSession.session, 'sms', { code: '' })
              .subscribe({
                next: (authResponse: any) => {
                  this.handleMFASetupComplete(authResponse, 'sms');
                },
                error: (error: any) => {
                  this.isLoading = false;
                  this.errorMessage = error.error?.message || 'Failed to complete MFA setup';
                },
              });
          } else {
            // Phone not verified - code was sent, proceed to verification step
            this.maskedPhone = response.maskedPhone || 'your phone';
            this.step = 'verify'; // Only set step to verify when code was actually sent
            this.startResendCooldown();
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start SMS setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      if (!this.userPhone) {
        this.errorMessage =
          'Phone number is required. Please add and verify your phone number first.';
        this.isLoading = false;
        this.step = 'select';
        this.selectedMethod = null;
        return;
      }

      // Mask phone for display BEFORE making the API call
      const digits = this.userPhone.replace(/\D/g, '');
      this.maskedPhone = digits.length >= 4 ? `***-***-${digits.slice(-4)}` : this.userPhone;

      // Use protected endpoint for authenticated users (no challenge session needed)
      this.authService.getMFASetupDataForUser('sms').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.autoCompleted && response.deviceId) {
            this.successMessage = 'SMS MFA setup completed successfully!';
            this.completed.emit({ method: 'sms' });
          } else {
            this.maskedPhone = response.maskedPhone || this.maskedPhone;
            this.successMessage = 'Verification code sent to your phone';
            this.step = 'verify';
            this.startResendCooldown();
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start SMS setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    }
  }

  /**
   * Start Email setup
   */
  private startEmailSetup(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to get setup data
      this.authService.getSetupData(this.challengeSession.session, 'email').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          // Check if setup was auto-completed (email already verified)
          if (response.autoCompleted && response.deviceId && this.challengeSession) {
            // Email already verified - MFA device was auto-created
            this.handleMFASetupComplete(response, 'email');
          } else {
            this.maskedEmail = response.maskedEmail || this.maskedEmail;
            this.successMessage = 'Verification code sent to your email';
            this.step = 'verify';
            this.startResendCooldown();
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start Email setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      this.authService.getMFASetupDataForUser('email').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.autoCompleted && response.deviceId) {
            this.successMessage = 'Email MFA setup completed successfully!';
            this.completed.emit({ method: 'email' });
          } else {
            this.maskedEmail = response.maskedEmail || this.maskedEmail;
            this.successMessage = 'Verification code sent to your email';
            this.step = 'verify';
            this.startResendCooldown();
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start Email setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    }
  }

  /**
   * Start TOTP setup
   */
  private startTOTPSetup(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to get setup data
      this.authService.getSetupData(this.challengeSession.session, 'totp').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.totpSetupData = response;
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start TOTP setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      this.authService.getMFASetupDataForUser('totp').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.totpSetupData = response;
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start TOTP setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    }
  }

  /**
   * Handle Email verification
   */
  onEmailVerify(code: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to complete MFA setup
      this.authService.setupMFA(this.challengeSession.session, 'email', { code }).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.backupCodes && response.backupCodes.length > 0) {
            this.backupCodes = response.backupCodes;
            this.lastAuthResponse = response; // Store response for navigation after backup codes
            this.showBackupCodes = true;
          } else {
            // MFA setup completed - handle response (may have tokens or another challenge)
            this.handleMFASetupComplete(response, 'email');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Invalid verification code';
        },
      });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      this.authService.verifyMFASetupForUser('email', { code }).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.backupCodes && response.backupCodes.length > 0) {
            this.backupCodes = response.backupCodes;
            this.showBackupCodes = true;
          } else {
            this.successMessage = 'Email MFA setup completed successfully!';
            this.completed.emit({ method: 'email' });
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Invalid verification code';
        },
      });
    }
  }

  /**
   * Handle SMS verification
   */
  onSMSVerify(code: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to complete MFA setup
      this.authService.setupMFA(this.challengeSession.session, 'sms', { code }).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.backupCodes && response.backupCodes.length > 0) {
            this.backupCodes = response.backupCodes;
            this.lastAuthResponse = response; // Store response for navigation after backup codes
            this.showBackupCodes = true;
          } else {
            // MFA setup completed - handle response (may have tokens or another challenge)
            this.handleMFASetupComplete(response, 'sms');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Invalid verification code';
        },
      });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      this.authService.verifyMFASetupForUser('sms', { code }).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.backupCodes && response.backupCodes.length > 0) {
            this.backupCodes = response.backupCodes;
            this.showBackupCodes = true;
          } else {
            this.successMessage = 'SMS MFA setup completed successfully!';
            this.completed.emit({ method: 'sms' });
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Invalid verification code';
        },
      });
    }
  }

  /**
   * Start Passkey setup
   */
  private startPasskeySetup(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to get setup data
      this.authService.getSetupData(this.challengeSession.session, 'passkey').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.passkeySetupOptions = response.options;
          this.expectedChallenge = (response.options['challenge'] as string) || '';
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start passkey setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      this.authService.getMFASetupDataForUser('passkey').subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.passkeySetupOptions = response.options;
          this.expectedChallenge = (response.options['challenge'] as string) || '';
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to start passkey setup';
          this.step = 'select';
          this.selectedMethod = null;
        },
      });
    }
  }

  /**
   * Handle Passkey verification
   */
  onPasskeyVerify(data: {
    credential: any; // RegistrationResponseJSON from @simplewebauthn/browser
    deviceName: string;
    expectedChallenge: string;
    transports?: string[];
  }): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession) {
        this.errorMessage = 'Challenge session not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to complete MFA setup
      // Backend expects credential wrapped in VerifyPasskeySetupDTO structure
      this.authService
        .setupMFA(this.challengeSession.session, 'passkey', {
          credential: {
            credential: data.credential,
            deviceName: data.deviceName,
          },
          expectedChallenge: data.expectedChallenge,
          transports: data.transports,
        })
        .subscribe({
          next: (response: any) => {
            this.isLoading = false;
            if (response.backupCodes && response.backupCodes.length > 0) {
              this.backupCodes = response.backupCodes;
              this.lastAuthResponse = response; // Store response for navigation after backup codes
              this.showBackupCodes = true;
            } else {
              this.handleMFASetupComplete(response, 'passkey');
            }
          },
          error: (error: any) => {
            this.isLoading = false;
            this.errorMessage = error.error?.message || 'Failed to verify passkey';
          },
        });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      // Backend expects credential wrapped in VerifyPasskeySetupDTO structure
      this.authService
        .verifyMFASetupForUser(
          'passkey',
          {
            credential: {
              credential: data.credential,
              deviceName: data.deviceName,
            },
            expectedChallenge: data.expectedChallenge,
            transports: data.transports,
          },
          data.deviceName,
        )
        .subscribe({
          next: (response: any) => {
            this.isLoading = false;
            if (response.backupCodes && response.backupCodes.length > 0) {
              this.backupCodes = response.backupCodes;
              this.showBackupCodes = true;
            } else {
              this.successMessage = 'Passkey MFA setup completed successfully!';
              this.completed.emit({ method: 'passkey' });
            }
          },
          error: (error: any) => {
            this.isLoading = false;
            this.errorMessage = error.error?.message || 'Failed to verify passkey';
          },
        });
    }
  }

  /**
   * Handle TOTP verification
   */
  onTOTPVerify(data: { code: string; deviceName: string }): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'page') {
      // Page mode: use challenge endpoint
      if (!this.challengeSession || !this.totpSetupData) {
        this.errorMessage = 'Setup data not found';
        this.isLoading = false;
        return;
      }

      // Use unified API to complete MFA setup
      this.authService
        .setupMFA(this.challengeSession.session, 'totp', {
          secret: this.totpSetupData.secret,
          code: data.code,
          deviceName: data.deviceName,
        })
        .subscribe({
          next: (response: any) => {
            this.isLoading = false;
            if (response.backupCodes && response.backupCodes.length > 0) {
              this.backupCodes = response.backupCodes;
              this.lastAuthResponse = response; // Store response for navigation after backup codes
              this.showBackupCodes = true;
            } else {
              this.handleMFASetupComplete(response, 'totp');
            }
          },
          error: (error: any) => {
            this.isLoading = false;
            this.errorMessage = error.error?.message || 'Invalid verification code';
          },
        });
    } else {
      // Dialog mode: use protected endpoint for authenticated users
      if (!this.totpSetupData) {
        this.errorMessage = 'Setup data not found';
        this.isLoading = false;
        return;
      }

      this.authService
        .verifyMFASetupForUser(
          'totp',
          {
            secret: this.totpSetupData.secret,
            code: data.code,
          },
          data.deviceName,
        )
        .subscribe({
          next: (response: any) => {
            this.isLoading = false;
            if (response.backupCodes && response.backupCodes.length > 0) {
              this.backupCodes = response.backupCodes;
              this.showBackupCodes = true;
            } else {
              this.successMessage = 'TOTP MFA setup completed successfully!';
              this.completed.emit({ method: 'totp' });
            }
          },
          error: (error: any) => {
            this.isLoading = false;
            this.errorMessage = error.error?.message || 'Invalid verification code';
          },
        });
    }
  }

  /**
   * Handle backup codes acknowledgment
   */
  onBackupCodesAcknowledged(): void {
    this.showBackupCodes = false;
    if (this.mode === 'page' && this.lastAuthResponse) {
      // Page mode: handle navigation with stored response
      const method = this.selectedMethod || 'sms';
      this.handleMFASetupComplete(this.lastAuthResponse, method);
      this.lastAuthResponse = null; // Clear stored response
    } else {
      // Dialog mode: emit completion event
      if (this.selectedMethod) {
        this.completed.emit({ method: this.selectedMethod, backupCodes: this.backupCodes });
      }
    }
  }

  /**
   * Handle resend SMS code
   */
  onSMSResend(): void {
    if (this.resendCooldown > 0) {
      return;
    }
    this.startSMSSetup();
  }

  /**
   * Handle resend Email code
   */
  onEmailResend(): void {
    if (this.resendCooldown > 0) {
      return;
    }
    this.startEmailSetup();
  }

  /**
   * Go back to method selection
   */
  onGoBack(): void {
    this.step = 'select';
    this.selectedMethod = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.totpSetupData = null;
    this.passkeySetupOptions = null;
    this.expectedChallenge = '';
    this.maskedPhone = '';
    this.resendCooldown = 0;
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  /**
   * Handle MFA setup completion response
   * Called after setupMFA succeeds - handles navigation based on response
   */
  private handleMFASetupComplete(response: any, method: MFADeviceMethod): void {
    this.successMessage = 'MFA setup completed successfully!';
    this.completed.emit({ method, backupCodes: this.backupCodes });

    // Handle navigation (page mode only)
    if (this.mode === 'page') {
      // Special case: Skip VERIFY_PHONE after SMS MFA setup since phone was already verified
      if (response.challengeName === 'VERIFY_PHONE' && method === 'sms') {
        // Phone was already verified during SMS MFA setup, skip and go to dashboard
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 0);
        return;
      }

      // Use centralized challenge navigation service for all other cases
      if (this.challengeNav.handleChallengeResponse(response)) {
        // Navigation handled by service (either to next challenge or dashboard)
        return;
      }

      // Fallback: no navigation occurred - go to dashboard anyway
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 0);
    }
  }

  /**
   * Get allowed methods for setup (filters out backup since it's not set up)
   */
  getSetupAllowedMethods(): Array<MFADeviceMethod> {
    return this.allowedMethods.filter((m): m is MFADeviceMethod => m !== 'backup');
  }

  /**
   * Handle method selection from selector (filters out backup)
   */
  handleMethodSelected(method: MFAVerificationMethod): void {
    if (method === 'backup') {
      // Backup codes are not set up, they're generated after setup
      return;
    }
    this.onMethodSelected(method);
  }

  /**
   * Start resend cooldown timer
   */
  private startResendCooldown(): void {
    this.resendCooldown = 60;
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      }
    }, 1000);
  }
}
