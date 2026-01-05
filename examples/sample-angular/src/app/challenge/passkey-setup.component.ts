import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, AuthResponse, NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client/angular';
import {
  AuthChallenge,
  MFASetupResponse,
  MFAPasskeyResponse,
  NAuthClientError,
  NAuthClientConfig,
  GetSetupDataResponse,
  GetChallengeDataResponse,
} from '@nauth-toolkit/client';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { handleAuthError } from '../utils/error-handler.util';

/**
 * Passkey Component
 *
 * Handles Passkey (WebAuthn) MFA for both setup and verification:
 * - MFA_SETUP_REQUIRED: Creates a new passkey (registration)
 * - MFA_REQUIRED: Verifies existing passkey during login (authentication)
 *
 * Uses dynamic import for @simplewebauthn/browser to reduce initial bundle size.
 * The library is only loaded when the user initiates passkey setup/verification.
 *
 * @example
 * ```typescript
 * // Component is used within MFA flow
 * <app-passkey-setup [session]="challengeSession" />
 * ```
 */
@Component({
  selector: 'app-passkey-setup',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule],
  templateUrl: './passkey-setup.component.html',
})
export class PasskeySetupComponent implements OnInit, OnDestroy {
  /**
   * Challenge session token (optional - will be extracted from challenge if not provided)
   * Used when component is embedded in mfa-setup component
   */
  session = input<string | undefined>(undefined);

  /**
   * Whether this is authenticated flow (from dashboard) vs challenge flow (signup)
   */
  isAuthenticatedFlow = input<boolean>(false);

  /**
   * Whether this component is embedded (in mfa-setup) or standalone (on its own route)
   */
  isEmbedded = computed(() => {
    // Component is embedded when:
    // 1. It's authenticated flow (from dashboard mfa-setup) - always embedded
    // 2. It's challenge flow (signup) and we're in setup mode (MFA_SETUP_REQUIRED) - embedded in mfa-setup
    // Component is standalone when:
    // - It's on its own route (mfa-required/passkey) for verification during login
    const challenge = this.challenge();
    if (this.isAuthenticatedFlow()) {
      return true; // Always embedded from dashboard
    }
    // For challenge flow, embedded if it's MFA_SETUP_REQUIRED (signup), standalone if MFA_REQUIRED (login)
    return challenge?.challengeName === AuthChallenge.MFA_SETUP_REQUIRED;
  });

  /**
   * Emitted when setup is completed successfully
   */
  setupComplete = output<void>();

  /**
   * Emitted when setup is cancelled
   */
  setupCancelled = output<void>();

  /**
   * Current challenge from AuthService
   */
  challenge = signal<AuthResponse | null>(null);

  /**
   * Current session token (from input or extracted from challenge)
   */
  currentSession = computed(() => {
    const inputSession = this.session();
    if (inputSession) return inputSession;
    const challenge = this.challenge();
    return challenge?.session || null;
  });

  /**
   * Setup data from backend (WebAuthn registration options for MFA_SETUP_REQUIRED)
   */
  setupData = signal<GetSetupDataResponse | null>(null);

  /**
   * Challenge data from backend (WebAuthn authentication options for MFA_REQUIRED)
   */
  challengeData = signal<GetChallengeDataResponse | null>(null);

  /**
   * Flag to prevent duplicate loadData calls
   */
  private isLoadingData = false;

  /**
   * Track the last challenge session we loaded data for
   * Prevents loading the same challenge multiple times
   */
  private lastLoadedSession: string | null = null;

  /**
   * Flag indicating whether a valid challenge has been loaded for this component instance.
   *
   * This helps distinguish between:
   * - Initial navigation where the challenge might not yet be hydrated, and
   * - Normal challenge clearing after a successful authentication flow.
   *
   * In the latter case we must not redirect back to login, otherwise users
   * briefly see the dashboard before being sent back to the login screen.
   */
  private hasLoadedChallenge = false;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * Destroy subject for cleanup
   */
  private readonly destroy$ = new Subject<void>();

  /**
   * Whether this is a setup flow (MFA_SETUP_REQUIRED) or verification flow (MFA_REQUIRED)
   */
  isSetupFlow = computed(() => {
    // For authenticated flow, it's always setup
    if (this.isAuthenticatedFlow()) {
      return true;
    }
    const challenge = this.challenge();
    return challenge?.challengeName === AuthChallenge.MFA_SETUP_REQUIRED;
  });

  /**
   * WebAuthn registration options from setup data (for MFA_SETUP_REQUIRED)
   */
  registrationOptions = computed(() => {
    const data = this.setupData();
    if (!data) return null;
    return (data.setupData['options'] as Record<string, unknown>) || null;
  });

  /**
   * Expected challenge from registration options (for MFA_SETUP_REQUIRED)
   */
  expectedChallenge = computed(() => {
    const options = this.registrationOptions();
    if (!options) return null;
    return (options['challenge'] as string) || null;
  });

  /**
   * WebAuthn authentication options from challenge data (for MFA_REQUIRED)
   */
  authenticationOptions = computed(() => {
    const data = this.challengeData();
    if (!data) return null;
    return (data.challengeData['options'] as Record<string, unknown>) || null;
  });

  /**
   * Button label based on flow type
   */
  buttonLabel = computed(() => {
    return this.isSetupFlow() ? 'Register Passkey' : 'Verify Passkey';
  });

  /**
   * Description text based on flow type
   */
  description = computed(() => {
    if (this.isSetupFlow()) {
      return 'Passkeys use biometric authentication (Face ID, Touch ID, Windows Hello) or a security key for secure, passwordless login. Your device will prompt you to create a passkey when you click the button below.';
    } else {
      return 'Use your passkey to complete authentication. Your device will prompt you to verify using biometric authentication or your security key.';
    }
  });

  private readonly config = inject<NAuthClientConfig>(NAUTH_CLIENT_CONFIG);

  /**
   * @param auth - Auth service for authentication
   * @param router - Router for navigation
   */
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  /**
   * Initialize component
   *
   * Subscribes to challenge updates and loads appropriate data based on challenge type.
   * Validates that challenge is either MFA_SETUP_REQUIRED or MFA_REQUIRED with passkey method.
   */
  ngOnInit(): void {
    // Handle authenticated flow (from dashboard) differently
    if (this.isAuthenticatedFlow()) {
      // For authenticated flow, load setup data directly without challenge
      this.loadData();
      return;
    }

    // Challenge flow - subscribe to challenge updates
    this.auth.challenge$.pipe(takeUntil(this.destroy$)).subscribe((challenge) => {
      this.validateAndSetChallenge(challenge);
    });

    // Load initial challenge - wait a bit for navigation to complete
    setTimeout(() => {
      // If a valid challenge has already been processed via the subscription,
      // skip this fallback entirely to avoid redirecting after successful flows.
      if (this.hasLoadedChallenge) {
        return;
      }

      const currentChallenge = this.auth.getCurrentChallenge();
      if (currentChallenge) {
        this.validateAndSetChallenge(currentChallenge);
      } else {
        // No challenge found, redirect to login
        this.router.navigate(['/login']);
      }
    }, 100);
  }

  /**
   * Validate and set challenge
   *
   * Ensures challenge is either MFA_SETUP_REQUIRED or MFA_REQUIRED with passkey method.
   *
   * @param challenge - Challenge response from AuthService
   */
  private validateAndSetChallenge(challenge: AuthResponse | null): void {
    if (!challenge) {
      // If we already loaded a valid challenge for this component instance, the SDK has
      // likely just cleared it after a successful flow. In that case, do not redirect
      // away – the orchestrator or guards will drive navigation (typically to the
      // dashboard), and redirecting here would cause a brief "dashboard → login" flicker.
      if (this.hasLoadedChallenge) {
        this.challenge.set(null);
        return;
      }

      // Initial load fallback: wait briefly for challenge to hydrate from storage.
      // If it is still missing, redirect back to login.
      setTimeout(() => {
        // If a valid challenge arrived in the meantime, skip fallback logic entirely.
        if (this.hasLoadedChallenge) {
          return;
        }

        const retryChallenge = this.auth.getCurrentChallenge();
        if (retryChallenge) {
          this.validateAndSetChallenge(retryChallenge);
        } else {
          void this.router.navigate(['/login']);
        }
      }, 200);
      return;
    }

    // Check if we've already loaded data for this challenge session
    const sessionId = challenge.session;
    if (sessionId && this.lastLoadedSession === sessionId) {
      // Already loaded data for this session - just update the challenge signal
      this.challenge.set(challenge);
      return;
    }

    const challengeName = challenge.challengeName;
    if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      // Setup flow - valid
      this.challenge.set(challenge);
      this.hasLoadedChallenge = true;
      // Only load if not already loading and not already loaded for this session
      if (!this.isLoadingData && this.lastLoadedSession !== sessionId) {
        this.loadData();
      }
    } else if (challengeName === AuthChallenge.MFA_REQUIRED) {
      // Verification flow - check if method is passkey
      const params = challenge.challengeParameters;
      const method = (params?.['preferredMethod'] || params?.['method']) as string | undefined;
      if (method === 'passkey') {
        // Passkey verification - valid
        this.challenge.set(challenge);
        this.hasLoadedChallenge = true;
        // Only load if not already loading and not already loaded for this session
        if (!this.isLoadingData && this.lastLoadedSession !== sessionId) {
          this.loadData();
        }
      } else {
        // Method might not be set yet - check available methods
        const availableMethods = (params?.['availableMethods'] as string[]) || [];
        if (availableMethods.includes('passkey')) {
          // Passkey is available, user selected it - set method and proceed
          this.challenge.set(challenge);
          this.hasLoadedChallenge = true;
          // Only load if not already loading and not already loaded for this session
          if (!this.isLoadingData && this.lastLoadedSession !== sessionId) {
            this.loadData();
          }
        } else {
          // Not passkey - redirect to OTP component
          const challengeRoute = `/auth/challenge/${challengeName.toLowerCase().replace(/_/g, '-')}`;
          this.router.navigate([challengeRoute]);
        }
      }
    } else {
      // Invalid challenge type - redirect to appropriate handler
      if (challengeName) {
        const challengeRoute = `/auth/challenge/${challengeName.toLowerCase().replace(/_/g, '-')}`;
        this.router.navigate([challengeRoute]);
      } else {
        this.error.set('Invalid challenge type. Please try again.');
      }
    }
  }

  /**
   * Load passkey data from backend based on challenge type
   * Auto-launches passkey if it's the preferred method for MFA_REQUIRED
   */
  private async loadData(): Promise<void> {
    // Prevent duplicate calls
    if (this.isLoadingData) {
      return;
    }

    this.isLoadingData = true;
    this.loading.set(true);
    this.error.set(null);

    try {
      if (this.isAuthenticatedFlow()) {
        // Authenticated flow - use direct MFA setup endpoint
        const client = this.auth.getClient();
        const setupData = (await client.setupMfaDevice('passkey')) as Record<string, unknown>;
        this.setupData.set({ setupData });
        this.challengeData.set(null);
        // Create a synthetic challenge for internal component logic
        this.challenge.set({
          challengeName: AuthChallenge.MFA_SETUP_REQUIRED,
          session: '',
        } as AuthResponse);
      } else {
        // Challenge flow - use challenge-based endpoints
        const session = this.currentSession();
        const challenge = this.challenge();
        if (!session || !challenge) {
          this.error.set('Invalid challenge session');
          this.loading.set(false);
          return;
        }

        if (challenge.challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
          // Load registration options for setup
          const response = await this.auth.getSetupData(session, 'passkey');
          if (!response) {
            throw new Error('Failed to get passkey setup data');
          }
          this.setupData.set(response);
          this.challengeData.set(null);
        } else if (challenge.challengeName === AuthChallenge.MFA_REQUIRED) {
          // Load authentication options for verification
          const response = await this.auth.getChallengeData(session, 'passkey');
          if (!response) {
            throw new Error('Failed to get passkey challenge data');
          }
          this.challengeData.set(response);
          this.setupData.set(null);

          // Auto-launch passkey if it's the preferred method or user explicitly selected it
          const params = challenge.challengeParameters;
          const preferredMethod = (params?.['preferredMethod'] || params?.['method']) as
            | string
            | undefined;
          const availableMethods = (params?.['availableMethods'] as string[]) || [];

          // Auto-launch if it's preferred OR if user navigated here from mfa-selector (passkey is available)
          if (preferredMethod === 'passkey' || availableMethods.includes('passkey')) {
            // Auto-launch passkey verification
            setTimeout(() => this.handlePasskey(), 100);
          }
        } else {
          throw new Error(`Invalid challenge type: ${challenge.challengeName}`);
        }
      }
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle passkey setup or verification using WebAuthn
   *
   * Automatically detects whether this is setup (registration) or verification (authentication)
   * based on the current challenge type.
   */
  async handlePasskey(): Promise<void> {
    // For authenticated flow, we don't need a challenge session
    if (!this.isAuthenticatedFlow()) {
      const session = this.currentSession();
      const challenge = this.challenge();
      if (!session || !challenge) {
        this.error.set('Invalid challenge session');
        return;
      }
    }

    const isSetup = this.isSetupFlow();
    const options = isSetup ? this.registrationOptions() : this.authenticationOptions();

    if (!options) {
      this.error.set(
        isSetup
          ? 'Passkey setup data not available. Please try again.'
          : 'Passkey challenge data not available. Please try again.',
      );
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      let credential: unknown;

      if (isSetup) {
        // MFA_SETUP_REQUIRED: Create new passkey (registration)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        credential = await startRegistration({ optionsJSON: options as any });
      } else {
        // MFA_REQUIRED: Verify existing passkey (authentication)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        credential = await startAuthentication({ optionsJSON: options as any });
      }

      // Respond to challenge
      if (isSetup) {
        // Backend requires both credential and expectedChallenge for setup
        // The challenge comes from the registration options we received
        const expectedChallenge = this.expectedChallenge();
        if (!expectedChallenge) {
          throw new Error('Expected challenge not found in registration options');
        }

        if (this.isAuthenticatedFlow()) {
          // Authenticated flow - use direct MFA verify endpoint
          const client = this.auth.getClient();
          await client.verifyMfaSetup('passkey', {
            credential: {
              credential: credential as {
                id: string;
                rawId: string;
                response: {
                  clientDataJSON: string;
                  attestationObject: string;
                };
                type: 'public-key';
              },
            },
            expectedChallenge,
          });

          // Emit success event and navigate to dashboard
          this.error.set(null);
          this.loading.set(false);
          this.setupComplete.emit();
          this.router.navigate(['/dashboard']);
        } else {
          // Challenge flow - use challenge response endpoint
          const session = this.currentSession();
          if (!session) {
            throw new Error('Invalid challenge session for passkey setup');
          }

          // Backend expects setupData to be: { credential: VerifyPasskeySetupDTO, expectedChallenge: string }
          // Where VerifyPasskeySetupDTO is: { credential: {...}, deviceName?: string }
          // The credential from startRegistration is already in the correct format
          const setupResponse: MFASetupResponse = {
            type: AuthChallenge.MFA_SETUP_REQUIRED,
            session,
            method: 'passkey',
            setupData: {
              credential: {
                credential: credential as {
                  id: string;
                  rawId: string;
                  response: {
                    clientDataJSON: string;
                    attestationObject: string;
                  };
                  type: 'public-key';
                },
              },
              expectedChallenge,
            },
          };

          const authResponse = await this.auth.respondToChallenge(setupResponse);
          if (!authResponse) {
            throw new Error('Failed to complete passkey setup');
          }

          // Handle next challenge or success (same pattern as TOTP)
          this.handleNextChallenge(authResponse);
        }
      } else {
        // MFA_REQUIRED: Verify existing passkey (authentication)
        // This is always challenge flow (not authenticated flow)
        const session = this.currentSession();
        if (!session) {
          throw new Error('Invalid challenge session for passkey verification');
        }

        const verifyResponse: MFAPasskeyResponse = {
          type: AuthChallenge.MFA_REQUIRED,
          session,
          method: 'passkey',
          credential: credential as Record<string, unknown>,
        };

        const authResponse = await this.auth.respondToChallenge(verifyResponse);
        if (!authResponse) {
          throw new Error('Failed to complete passkey verification');
        }

        // Handle next challenge or success (same pattern as TOTP)
        this.handleNextChallenge(authResponse);
      }
    } catch (err: unknown) {
      this.loading.set(false);

      if (err instanceof Error) {
        // Handle WebAuthn-specific errors
        if (err.name === 'NotAllowedError') {
          // User cancelled - show selector for alternative methods
          const challenge = this.challenge();
          if (challenge?.challengeName === AuthChallenge.MFA_REQUIRED) {
            // Redirect to method selector
            this.router.navigate(['/auth/challenge/mfa-selector']);
            return;
          }
          this.error.set(
            isSetup
              ? 'Passkey registration was cancelled or timed out. Please try again.'
              : 'Passkey verification was cancelled. Please choose another method.',
          );
        } else if (err.name === 'NotSupportedError') {
          // Browser doesn't support passkeys - show selector
          const challenge = this.challenge();
          if (challenge?.challengeName === AuthChallenge.MFA_REQUIRED) {
            this.router.navigate(['/auth/challenge/mfa-selector']);
            return;
          }
          this.error.set(
            'Passkeys are not supported in this browser. Please use another MFA method.',
          );
        } else if (err.name === 'InvalidStateError') {
          this.error.set(
            isSetup
              ? 'This passkey is already registered. Please try a different device.'
              : 'Passkey verification failed. Please try again.',
          );
        } else if (err.name === 'SecurityError') {
          this.error.set('Passkeys require HTTPS. Please check your connection.');
        } else if (err.name === 'AbortError' || err.message?.includes('abort signal')) {
          // User cancelled or authentication was aborted - don't show as error
          // This is a normal user action, not a failure
          // Error will be cleared on next successful attempt
          return;
        } else if (err instanceof NAuthClientError) {
          // Handle backend errors - show error message instead of redirecting
          const errorMessage =
            err.message || `Failed to ${isSetup ? 'register' : 'verify'} passkey`;
          this.error.set(errorMessage);

          // For MFA_REQUIRED verification failures, allow user to try another method
          const challenge = this.challenge();
          if (challenge?.challengeName === AuthChallenge.MFA_REQUIRED && !isSetup) {
            // Don't redirect immediately - let user see the error and choose another method
            // They can navigate back to selector if needed
          }
        } else {
          this.error.set(`Failed to ${isSetup ? 'register' : 'verify'} passkey: ${err.message}`);
        }
      } else {
        this.error.set(
          `An unexpected error occurred during passkey ${isSetup ? 'setup' : 'verification'}.`,
        );
      }
    }
  }

  /**
   * Handle next challenge or navigate to success
   *
   * Matches TOTP pattern - navigates directly based on response.
   *
   * @param response - Auth response after challenge completion
   */
  private handleNextChallenge(response: AuthResponse): void {
    if (response.challengeName) {
      // Another challenge is required
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
   * Navigate to login page
   */
  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Go back to method selection or dashboard
   *
   * Consistent with TOTP component pattern:
   * - Authenticated flow: Navigate to dashboard
   * - Challenge flow: Emit cancellation event to parent
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
   * Navigate to dashboard page
   */
  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Navigate to MFA selector page (for standalone mode during login verification)
   */
  navigateToSelector(): void {
    this.router.navigate(['/auth/challenge/mfa-selector']);
  }

  /**
   * Navigate back to method selection (for embedded mode during signup)
   *
   * Prefer `goBack()` for a single consistent back-navigation entry point.
   */
  navigateToMethodSelection(): void {
    // Emit cancellation event to parent mfa-setup component
    this.setupCancelled.emit();
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
