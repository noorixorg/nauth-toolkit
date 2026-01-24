import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  signal,
  computed,
  input,
  inject,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  AuthService,
  AuthResponse,
  NAUTH_CLIENT_CONFIG,
} from '@nauth-toolkit/client-angular/standalone';
import {
  AuthChallenge,
  VerifyEmailResponse,
  VerifyPhoneCodeResponse,
  VerifyPhoneCollectResponse,
  MFACodeResponse,
  MFASetupResponse,
  NAuthClientError,
  MFAMethod,
  NAuthClientConfig,
  requiresPhoneCollection,
  getMaskedDestination,
  getMFAMethod,
} from '@nauth-toolkit/client';
import { InputOtpModule } from 'primeng/inputotp';
import { InputMaskModule } from 'primeng/inputmask';
import { AutoFocusModule } from 'primeng/autofocus';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CommonModule } from '@angular/common';
import { takeUntil, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChallengeOrchestratorService } from '../services/challenge-orchestrator.service';
import { SimulatedVerificationCodeService } from '../services/simulated-verification-code.service';
import { handleAuthError } from '../utils/error-handler.util';

/**
 * OTP Verification Component
 *
 * Generic component for handling all OTP-based challenges:
 * - VERIFY_EMAIL
 * - VERIFY_PHONE
 * - MFA_REQUIRED (SMS, Email, TOTP)
 *
 * Uses Angular 21 signal inputs for configuration.
 * Automatically handles progressive challenges (challenge after challenge).
 *
 * @example
 * ```typescript
 * // Route configuration
 * {
 *   path: 'auth/challenge/:challengeType',
 *   loadComponent: () => import('./challenge/otp-verify.component').then(m => m.OtpVerifyComponent)
 * }
 * ```
 */
@Component({
  selector: 'app-otp-verify',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputOtpModule,
    InputMaskModule,
    AutoFocusModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './otp-verify.component.html',
  styleUrl: './otp-verify.component.css',
})
export class OtpVerifyComponent implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Expose AuthChallenge enum to template
   */
  readonly AuthChallenge = AuthChallenge;

  /**
   * Challenge type from route parameter (optional, auto-detected from challenge session)
   */
  challengeType = input<string | undefined>(undefined);

  /**
   * Current challenge session from AuthService
   */
  challenge = signal<AuthResponse | null>(null);

  /**
   * OTP form group
   */
  otpForm: FormGroup;

  /**
   * Loading state signal
   */
  loading = signal(false);

  /**
   * Verification code service for simulation mode
   */
  private readonly simulatedVerificationCodeService = inject(SimulatedVerificationCodeService);

  /**
   * Resending code state signal
   */
  resending = signal(false);

  /**
   * Resend timer countdown (seconds remaining)
   */
  resendTimer = signal<number>(0);

  /**
   * Timer interval reference
   */
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Track which challenge sessions have already triggered toast
   * Prevents duplicate toasts when loadChallenge is called multiple times
   */
  private readonly toastTriggeredSessions = new Set<string>();

  /**
   * Trigger toast for authenticated flow (dashboard MFA setup)
   * Uses authenticated endpoint which gets userId from req.user - much safer
   *
   * @param challengeName - Challenge name
   * @param method - MFA method (sms or email)
   */
  private triggerToastForAuthenticatedFlow(challengeName: string, method: 'sms' | 'email'): void {
    // Create unique key for authenticated flow (use method only since no sessionId)
    const toastKey = `authenticated-${method}`;

    // Prevent duplicate toasts
    if (this.toastTriggeredSessions.has(toastKey)) {
      return;
    }

    // Mark as triggered to prevent duplicate calls
    this.toastTriggeredSessions.add(toastKey);

    // Delay to ensure code is saved to database
    const delay = 500;
    setTimeout(() => {
      // Create synthetic challenge with empty sessionId
      // Service will detect empty sessionId + MFA_SETUP_REQUIRED and use authenticated endpoint
      const challenge: AuthResponse = {
        challengeName: challengeName as AuthChallenge,
        session: '', // Empty sessionId signals authenticated flow
        challengeParameters: {},
      };

      this.simulatedVerificationCodeService
        .handleChallenge(challenge, method)
        .then(() => {
          // Toast shown successfully
        })
        .catch(() => {
          // Silently handle errors - if fetch fails, remove from set to allow retry
          this.toastTriggeredSessions.delete(toastKey);
        });
    }, delay);
  }

  /**
   * Centralized method to trigger toast for verification codes
   * Called after any code-sending operation (getChallengeData, getSetupData, resendCode, etc.)
   *
   * Delay is applied BEFORE marking as triggered to ensure code is saved to database
   * after the challenge event occurs.
   *
   * @param sessionId - Challenge session ID
   * @param challengeName - Challenge name
   * @param method - MFA method (sms or email)
   */
  private triggerToast(sessionId: string, challengeName: string, method: 'sms' | 'email'): void {
    if (!sessionId) {
      console.log('[OTP Component] triggerToast: No sessionId provided');
      return;
    }

    // Create unique key for this session+method combination
    const toastKey = `${sessionId}-${method}`;

    // Prevent duplicate toasts for initial load
    // Mark as triggered immediately to prevent multiple calls
    // Resend operations will clear this flag before calling triggerToast again
    if (this.toastTriggeredSessions.has(toastKey)) {
      console.log('[OTP Component] triggerToast: Toast already triggered for', toastKey);
      return;
    }

    // Mark as triggered to prevent duplicate calls
    this.toastTriggeredSessions.add(toastKey);
    console.log(
      '[OTP Component] triggerToast: Triggering toast for',
      toastKey,
      'challenge:',
      challengeName,
    );

    // Delay to ensure code is saved to database after challenge event occurs
    // Backend typically completes in 20-50ms, 500ms provides comfortable buffer
    const delay = 500;
    setTimeout(() => {
      // Create a synthetic challenge for the toast service
      const challenge: AuthResponse = {
        challengeName: challengeName as AuthChallenge,
        session: sessionId,
        challengeParameters: {},
      };

      console.log('[OTP Component] triggerToast: Calling handleChallenge with', challenge, method);
      this.simulatedVerificationCodeService
        .handleChallenge(challenge, method)
        .then(() => {
          console.log('[OTP Component] triggerToast: Toast shown successfully');
        })
        .catch((error) => {
          console.error('[OTP Component] triggerToast: Error showing toast', error);
          // Silently handle errors - if fetch fails, remove from set to allow retry
          this.toastTriggeredSessions.delete(toastKey);
        });
    }, delay);
  }

  /**
   * Destroy subject for cleanup
   */
  private readonly destroy$ = new Subject<void>();

  /**
   * ViewChild reference to OTP input container for auto-focus
   */
  @ViewChild('otpInput', { read: ElementRef }) otpInputRef?: ElementRef;

  /**
   * ViewChild reference to phone input for auto-focus
   */
  @ViewChild('phoneInput', { read: ElementRef }) phoneInputRef?: ElementRef;

  /**
   * Error message signal
   */
  error = signal<string | null>(null);

  /**
   * Success message signal (for resend)
   */
  success = signal<string | null>(null);

  /**
   * Computed challenge type from challenge session
   */
  currentChallengeType = computed(() => {
    const challenge = this.challenge();
    return challenge?.challengeName;
  });

  /**
   * Computed title based on challenge type and device name
   */
  title = computed(() => {
    const type = this.currentChallengeType();
    const deviceName = this.deviceName();
    
    switch (type) {
      case AuthChallenge.VERIFY_EMAIL:
        return 'Verify Email';
      case AuthChallenge.VERIFY_PHONE:
        return 'Verify Phone';
      case AuthChallenge.MFA_REQUIRED:
        // Show device name if available (e.g., "Verify microsoft")
        return deviceName ? `Verify ${deviceName}` : 'Two-Factor Authentication';
      case AuthChallenge.MFA_SETUP_REQUIRED:
        return 'Set Up Multi-Factor Authentication';
      default:
        return 'Verify Code';
    }
  });

  /**
   * Computed unified icon classes based on challenge type
   * Includes PrimeNG icon, color, and base styling
   */
  challengeIconClasses = computed(() => {
    const type = this.currentChallengeType();
    let iconClass = 'pi ';
    const colorClass = 'text-primary-600'; // Use primary color for all icons

    switch (type) {
      case AuthChallenge.VERIFY_EMAIL:
        iconClass += 'pi-envelope';
        break;
      case AuthChallenge.VERIFY_PHONE:
        iconClass += 'pi-phone';
        break;
      case AuthChallenge.MFA_REQUIRED: {
        const method = this.mfaMethod();
        if (method === 'totp') {
          iconClass += 'pi-key';
        } else if (method === 'sms') {
          iconClass += 'pi-phone';
        } else if (method === 'email') {
          iconClass += 'pi-envelope';
        } else {
          iconClass += 'pi-shield';
        }
        break;
      }
      case AuthChallenge.MFA_SETUP_REQUIRED: {
        const method = this.mfaMethod() || (this.route.snapshot.queryParams['method'] as MFAMethod);
        if (method === 'sms') {
          iconClass += 'pi-phone';
        } else if (method === 'email') {
          iconClass += 'pi-envelope';
        } else {
          iconClass += 'pi-shield';
        }
        break;
      }
      default:
        iconClass += 'pi-shield';
    }

    return `challenge-icon ${iconClass} ${colorClass}`;
  });

  /**
   * Masked destination from query params (passed from mfa-setup or mfa-selector)
   */
  private maskedDestinationFromQuery = signal<string | null>(null);

  /**
   * Computed masked destination (email or phone)
   * Priority: query params > challenge parameters > API call if needed
   */
  maskedDestination = computed(() => {
    // First check query params (passed from parent components)
    const fromQuery = this.maskedDestinationFromQuery();
    if (fromQuery) {
      return fromQuery;
    }

    // Then check challenge parameters
    const challenge = this.challenge();
    if (!challenge) return null;
    return getMaskedDestination(challenge);
  });

  /**
   * Computed description based on challenge type and parameters
   * Uses mfaMethod() to respect user's selected method (not just backend's preferred)
   */
  description = computed(() => {
    const challenge = this.challenge();
    const type = this.currentChallengeType();
    const destination = this.maskedDestination();

    switch (type) {
      case AuthChallenge.VERIFY_EMAIL: {
        return destination
          ? `We've sent a verification code to ${destination}. Please enter it below.`
          : 'Please enter the verification code sent to your email.';
      }
      case AuthChallenge.VERIFY_PHONE: {
        if (challenge && requiresPhoneCollection(challenge)) {
          return 'Please provide your phone number to continue. We will send a verification code to confirm it.';
        }
        return destination
          ? `We've sent a verification code to ${destination}. Please enter it below.`
          : 'Please enter the verification code sent to your phone.';
      }
      case AuthChallenge.MFA_REQUIRED: {
        // Use mfaMethod() which respects user's selected method from query params
        const method = this.mfaMethod();
        const deviceName = this.deviceName();
        
        if (method === 'totp') {
          // Show device name if available (e.g., "microsoft", "Google")
          return deviceName
            ? `Please enter the code from ${deviceName}.`
            : 'Please enter the code from your authenticator app.';
        }
        // For SMS/Email, show destination
        if (method === 'sms' || method === 'email') {
          return destination
            ? `We've sent a verification code to ${destination}. Please enter it below.`
            : 'Please enter the verification code.';
        }
        return 'Please enter the verification code.';
      }
      case AuthChallenge.MFA_SETUP_REQUIRED: {
        // Always prioritize query params for MFA_SETUP_REQUIRED to avoid stale state
        const method = (this.route.snapshot.queryParams['method'] as MFAMethod) || this.mfaMethod();

        if (method === 'totp') {
          return 'Please enter the code from your authenticator app.';
        }

        if (destination && (method === 'sms' || method === 'email')) {
          return `We've sent a verification code to ${destination}. Please enter it below.`;
        }
        return 'Please enter the verification code.';
      }
      default:
        return 'Please enter the verification code.';
    }
  });

  /**
   * Computed OTP length based on challenge type
   */
  otpLength = computed(() => {
    // Default to 6 digits for all OTP codes
    return 6;
  });

  /**
   * Selected method from query params (if user chose different method)
   */
  selectedMethod = signal<MFAMethod | undefined>(undefined);

  /**
   * Computed MFA method for display and submission
   * Uses selected method from query params if available, otherwise from challenge parameters
   * For MFA_SETUP_REQUIRED, always prioritize query params to avoid stale state
   * Uses SDK helper utility for type-safe access
   */
  mfaMethod = computed(() => {
    const challenge = this.challenge();
    const challengeName = challenge?.challengeName;

    // For MFA_SETUP_REQUIRED, always prioritize query params to avoid stale state
    // This prevents wrong method descriptions (e.g., TOTP showing SMS text)
    if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      const queryMethod = this.route.snapshot.queryParams['method'] as MFAMethod | undefined;
      if (queryMethod && ['sms', 'email', 'totp'].includes(queryMethod)) {
        return queryMethod;
      }
    }

    // If user selected a different method via selector, use that
    const selected = this.selectedMethod();
    if (selected) {
      return selected;
    }

    // Otherwise use method from challenge parameters
    if (!challenge) return undefined;
    return getMFAMethod(challenge);
  });

  /**
   * Device name for the current verification
   * Gets device name from preferredDeviceId in challenge parameters
   */
  deviceName = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return undefined;
    
    const params = challenge.challengeParameters;
    const preferredDeviceId = params?.['preferredDeviceId'] as number | undefined;
    const devices = (params?.['devices'] as Array<{ id: number; name: string; type: string }>) || [];
    
    if (preferredDeviceId && devices.length > 0) {
      const device = devices.find((d) => d.id === preferredDeviceId);
      return device?.name;
    }
    
    return undefined;
  });

  /**
   * Whether phone collection is required (user has no phone number)
   * Uses SDK helper utility for type-safe access
   */
  requiresPhoneCollection = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return false;
    return requiresPhoneCollection(challenge);
  });

  /**
   * Computed whether resend code is available
   * Resend is only available for email/phone verification and MFA with SMS/email methods
   * Not available during phone collection phase
   */
  canResend = computed(() => {
    // Don't show resend during phone collection
    if (this.requiresPhoneCollection()) {
      return false;
    }

    const type = this.currentChallengeType();
    if (type === AuthChallenge.VERIFY_EMAIL || type === AuthChallenge.VERIFY_PHONE) {
      return true;
    }
    if (type === AuthChallenge.MFA_REQUIRED) {
      const method = this.mfaMethod();
      // Resend only for SMS/email MFA, not for TOTP
      return method === 'sms' || method === 'email';
    }
    if (type === AuthChallenge.MFA_SETUP_REQUIRED) {
      const method = this.mfaMethod() || (this.route.snapshot.queryParams['method'] as MFAMethod);
      // Resend only for SMS/email MFA setup
      return method === 'sms' || method === 'email';
    }
    return false;
  });

  /**
   * Injected client configuration
   */
  private readonly config = inject<NAuthClientConfig>(NAUTH_CLIENT_CONFIG);

  /**
   * @param fb - Form builder for reactive forms
   * @param auth - Auth service for authentication
   * @param router - Router for navigation
   * @param route - Activated route for route parameters
   * @param orchestrator - Challenge orchestrator service
   */
  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly orchestrator: ChallengeOrchestratorService,
  ) {
    this.otpForm = this.fb.group({
      phone: ['', [this.phoneValidator, Validators.maxLength(20)]],
      code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(10)]],
    });
  }

  /**
   * Phone number validator for E.164 format
   *
   * @param control - Form control to validate
   * @returns Validation errors or null if valid
   */
  private phoneValidator = (control: AbstractControl): ValidationErrors | null => {
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
        phoneFormat: {
          message: 'Phone must be in E.164 format with + prefix (e.g., +14155552671)',
        },
      };
    }

    return null;
  };

  /**
   * Initialize component
   *
   * Subscribes to challenge updates from AuthService.
   * Validates challenge type and updates component state.
   * Handles route changes for progressive challenges.
   * Reads method from query params if user selected a different method.
   */
  ngOnInit(): void {
    let isFirstLoad = true;

    // Read method from query params (if user selected different method)
    this.route.queryParams
      .pipe(
        map((params: Record<string, string>) => params['method'] as MFAMethod | undefined),
        takeUntil(this.destroy$),
      )
      .subscribe((method: MFAMethod | undefined) => {
        if (method && ['sms', 'email', 'totp'].includes(method)) {
          const previousMethod = this.selectedMethod();
          this.selectedMethod.set(method);

          // If user switched methods (not first load), request new code
          if (
            !isFirstLoad &&
            previousMethod !== method &&
            (method === 'sms' || method === 'email')
          ) {
            this.requestCodeForMethod(method);
          }
        }
      });

    // Subscribe to challenge updates (handles progressive challenges)
    this.auth.challenge$.pipe(takeUntil(this.destroy$)).subscribe((challenge) => {
      this.loadChallenge(challenge);
      // Focus appropriate input after challenge loads (with small delay for DOM update)
      setTimeout(() => this.focusInput(), 100);
    });

    // Also check current challenge on init (in case component is reused)
    const currentChallenge = this.auth.getCurrentChallenge();
    const mode = this.route.snapshot.queryParams['mode'] as string;
    const isAuthenticatedFlow =
      (!currentChallenge && this.auth.isAuthenticated()) || mode === 'setup';

    // Check if we're on the MFA setup verification route
    const isMfaSetupVerifyRoute = this.router.url.includes('/mfa-setup-required/verify');

    if (currentChallenge) {
      this.loadChallenge(currentChallenge);

      // Read masked destination from query params (if passed from parent component)
      const maskedDest = this.route.snapshot.queryParams['maskedDestination'] as string | undefined;
      if (maskedDest) {
        this.maskedDestinationFromQuery.set(maskedDest);
      }

      // If user arrived with a method query param, handle it
      const queryMethod = this.route.snapshot.queryParams['method'] as MFAMethod | undefined;
      if (queryMethod && ['sms', 'email', 'totp'].includes(queryMethod)) {
        this.selectedMethod.set(queryMethod);

        // For MFA_REQUIRED: Always call getChallengeData to send code and get masked destination
        // This ensures code is sent when user selects a method
        if (
          (queryMethod === 'sms' || queryMethod === 'email') &&
          currentChallenge.challengeName === AuthChallenge.MFA_REQUIRED
        ) {
          // Small delay to ensure challenge is fully loaded
          setTimeout(() => {
            this.requestCodeForMethod(queryMethod);
          }, 100);
        }
      } else if (
        isMfaSetupVerifyRoute &&
        currentChallenge.challengeName === AuthChallenge.MFA_SETUP_REQUIRED
      ) {
        // For MFA_SETUP_REQUIRED route, ensure method is set from challenge if not in query params
        const methodFromChallenge = getMFAMethod(currentChallenge);
        if (methodFromChallenge && ['sms', 'email'].includes(methodFromChallenge)) {
          this.selectedMethod.set(methodFromChallenge);
        }
      }
    } else if (isAuthenticatedFlow) {
      // Authenticated flow: load synthetic challenge (no actual challenge session)
      this.loadChallenge(null);

      // Read masked destination from query params
      const maskedDest = this.route.snapshot.queryParams['maskedDestination'] as string | undefined;
      if (maskedDest) {
        this.maskedDestinationFromQuery.set(maskedDest);
      }

      // Set method from query params
      const queryMethod = this.route.snapshot.queryParams['method'] as MFAMethod | undefined;
      if (queryMethod && ['sms', 'email', 'totp'].includes(queryMethod)) {
        this.selectedMethod.set(queryMethod);
      }
    } else {
      this.router.navigate(['/login']);
    }

    isFirstLoad = false;
  }

  /**
   * Focus appropriate input after view initialization
   */
  ngAfterViewInit(): void {
    // Focus appropriate input when view is ready
    setTimeout(() => this.focusInput(), 100);
  }

  /**
   * Focus the appropriate input based on current challenge mode
   * - Phone input if phone collection is required
   * - OTP input otherwise
   */
  private focusInput(): void {
    const challenge = this.challenge();
    if (!challenge) {
      return;
    }

    // Check if phone collection is required
    if (requiresPhoneCollection(challenge)) {
      this.focusPhoneInput();
    } else {
      this.focusOtpInput();
    }
  }

  /**
   * Focus the phone input field
   */
  private focusPhoneInput(): void {
    if (!this.phoneInputRef?.nativeElement) {
      return;
    }

    // PrimeNG InputMask renders an input element
    const input = this.phoneInputRef.nativeElement.querySelector('input');
    if (input) {
      input.focus();
    }
  }

  /**
   * Focus the first input element in the OTP component
   * Also sets autocomplete="one-time-code" on the first input for password manager support
   */
  private focusOtpInput(): void {
    if (!this.otpInputRef?.nativeElement) {
      return;
    }

    // PrimeNG InputOtp renders multiple input elements
    // Find the first input element and set autocomplete attribute for password managers
    const firstInput = this.otpInputRef.nativeElement.querySelector('input');
    if (firstInput) {
      firstInput.setAttribute('autocomplete', 'one-time-code');
      firstInput.focus();
    }
  }

  /**
   * Load and validate challenge
   *
   * @param challenge - Challenge response from AuthService
   */
  private loadChallenge(challenge: AuthResponse | null): void {
    // Check if this is authenticated flow (no challenge session but user is authenticated)
    const isAuthenticatedFlow = !challenge && this.auth.isAuthenticated();
    const mode = this.route.snapshot.queryParams['mode'] as string;
    const isMfaSetupVerifyRoute = this.router.url.includes('/mfa-setup-required/verify');

    if (isAuthenticatedFlow || mode === 'setup') {
      // Authenticated flow: create synthetic challenge for internal logic
      // No need to navigate away - user is already authenticated
      const method = this.route.snapshot.queryParams['method'] as MFAMethod;
      if (method && (method === 'sms' || method === 'email')) {
        // Create synthetic challenge for authenticated MFA setup
        const syntheticChallenge: AuthResponse = {
          challengeName: AuthChallenge.MFA_SETUP_REQUIRED,
          session: undefined,
          challengeParameters: { method },
        };
        this.challenge.set(syntheticChallenge);
        this.error.set(null);
        this.success.set(null);
        this.loading.set(false);

        // Trigger toast for authenticated flow
        // Code was already sent by setupMfaDevice() in mfa-setup component
        // Uses authenticated endpoint which gets userId from req.user
        this.triggerToastForAuthenticatedFlow(
          AuthChallenge.MFA_SETUP_REQUIRED,
          method as 'sms' | 'email',
        );
        // Start resend timer immediately when code is sent
        this.startResendTimer();
        return;
      }
    }

    // For MFA_SETUP_REQUIRED verification route, ensure we have a challenge
    // If not loaded yet, try to get it from AuthService
    if (isMfaSetupVerifyRoute && !challenge) {
      const currentChallenge = this.auth.getCurrentChallenge();
      if (currentChallenge && currentChallenge.challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
        challenge = currentChallenge;
      } else {
        // Challenge might have expired or not been set - redirect to setup selector
        this.router.navigate(['/auth/challenge/mfa-setup-required']);
        return;
      }
    }

    if (!challenge) {
      this.router.navigate(['/login']);
      return;
    }

    // Determine challenge type
    const challengeName = challenge.challengeName;
    if (!challengeName) {
      this.router.navigate(['/login']);
      return;
    }

    // Update challenge signal
    this.challenge.set(challenge);

    // Reset form when challenge changes
    // Keep phone field if transitioning from collection to verification
    const currentPhone = this.otpForm.get('phone')?.value;
    this.otpForm.reset();
    if (currentPhone && !requiresPhoneCollection(challenge)) {
      // Phone was collected, keep it in form (though not needed for verification)
      this.otpForm.patchValue({ phone: currentPhone });
    }
    this.error.set(null);
    this.success.set(null);
    this.loading.set(false);

    // Trigger toast for MFA_SETUP_REQUIRED if method is SMS/Email
    // getSetupData() doesn't emit challenge events, so we need manual trigger
    if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      const sessionId = challenge.session || '';
      // Get method from query params (set by mfa-setup component) or challenge parameters
      // Use a small delay to ensure route params are available after navigation
      setTimeout(() => {
        const method =
          (this.route.snapshot.queryParams['method'] as MFAMethod) ||
          this.selectedMethod() ||
          this.mfaMethod() ||
          (challenge.challengeParameters?.['method'] as MFAMethod);
        if (method === 'sms' || method === 'email') {
          this.triggerToast(sessionId, AuthChallenge.MFA_SETUP_REQUIRED, method as 'sms' | 'email');
          // Start resend timer when code is initially sent
          this.startResendTimer();
        }
      }, 100);
    }

    // Start resend timer for VERIFY_EMAIL and VERIFY_PHONE challenges
    // Code is sent automatically when challenge is created, so timer should start immediately
    if (
      challengeName === AuthChallenge.VERIFY_EMAIL ||
      challengeName === AuthChallenge.VERIFY_PHONE
    ) {
      this.startResendTimer();

      // Trigger toast for email/phone verification
      // Code is sent automatically when challenge is created
      const sessionId = challenge.session;
      if (sessionId) {
        const method = challengeName === AuthChallenge.VERIFY_EMAIL ? 'email' : 'sms';
        console.log(
          '[OTP Component] Triggering toast for initial challenge:',
          challengeName,
          sessionId,
          method,
        );
        this.triggerToast(sessionId, challengeName, method);
      }
    }

    // For MFA_REQUIRED with SMS/Email preferred (or implicitly selected by backend),
    // the backend sends the code automatically when the challenge is created.
    // Whenever this screen is shown in that state, the resend button should
    // start with a countdown to prevent immediate resends.
    if (challengeName === AuthChallenge.MFA_REQUIRED) {
      const method = this.mfaMethod();
      if (method === 'sms' || method === 'email') {
        this.startResendTimer();
        // Trigger toast for verification code (code was sent when challenge was created)
        const challengeSessionId = challenge.session;
        if (challengeSessionId) {
          // Small delay to ensure challenge is fully loaded
          setTimeout(() => {
            this.triggerToast(
              challengeSessionId,
              AuthChallenge.MFA_REQUIRED,
              method as 'sms' | 'email',
            );
          }, 100);
        }
      }
    }

    // Routing logic is now handled by challengeRouteGuard
    // This component only handles OTP-based challenges
    // Toast simulation for other challenges is handled by app.ts subscription to authEvents$
  }

  /**
   * Handle paste event from PrimeNG InputOtp
   *
   * Called when user pastes a code. Checks if form is valid and auto-submits.
   */
  onPaste(): void {
    // Small delay to let PrimeNG process the paste
    setTimeout(() => {
      if (this.otpForm.valid && !this.loading()) {
        this.onSubmit();
      }
    }, 100);
  }

  /**
   * Handle form submission
   *
   * Submits phone number (for collection) or OTP code (for verification) to complete the challenge.
   * Handles progressive challenges by routing to next challenge if needed.
   */
  async onSubmit(): Promise<void> {
    const challenge = this.challenge();
    const challengeName = challenge?.challengeName;

    // Check if this is authenticated flow (MFA_SETUP_REQUIRED without session but user is authenticated)
    const isAuthenticatedFlow =
      challengeName === AuthChallenge.MFA_SETUP_REQUIRED &&
      !challenge?.session &&
      this.auth.isAuthenticated();
    const mode = this.route.snapshot.queryParams['mode'] as string;
    const isAuthenticatedMfaSetup = isAuthenticatedFlow || mode === 'setup';

    // For authenticated flow, session is not required
    // For challenge flow, session is required
    if (!isAuthenticatedMfaSetup && !challenge?.session) {
      this.error.set('Challenge session expired. Please login again.');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
      return;
    }

    if (!challengeName) {
      this.error.set('Invalid challenge type.');
      return;
    }
    if (!challengeName) {
      this.error.set('Invalid challenge type.');
      return;
    }

    // Handle phone collection for VERIFY_PHONE
    if (challengeName === AuthChallenge.VERIFY_PHONE && requiresPhoneCollection(challenge)) {
      if (this.otpForm.get('phone')?.invalid) {
        this.otpForm.get('phone')?.markAsTouched();
        return;
      }

      this.loading.set(true);
      this.error.set(null);
      this.success.set(null);

      const phone = this.otpForm.get('phone')?.value;
      if (!phone) {
        this.loading.set(false);
        this.error.set('Phone number is required.');
        return;
      }

      // Format phone number (remove whitespace and mask placeholder characters)
      const formattedPhone = phone.replace(/[\s_]/g, '');

      // Submit phone for collection
      const collectResponse: VerifyPhoneCollectResponse = {
        type: AuthChallenge.VERIFY_PHONE,
        session: challenge.session!,
        phone: formattedPhone,
      };

      try {
        const response: AuthResponse = await this.auth.respondToChallenge(collectResponse);
        // After phone collection, backend sends verification code
        // The response will have the same VERIFY_PHONE challenge but with masked phone
        // Update challenge state and reload
        this.loadChallenge(response);
      } catch (err: unknown) {
        this.loading.set(false);
        this.handleError(err);
      }
      return;
    }

    // Handle code verification
    if (this.otpForm.get('code')?.invalid) {
      this.otpForm.get('code')?.markAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    const { code } = this.otpForm.value;

    // Build challenge response based on type
    let challengeResponse:
      | VerifyEmailResponse
      | VerifyPhoneCodeResponse
      | MFACodeResponse
      | MFASetupResponse;

    switch (challengeName) {
      case AuthChallenge.VERIFY_EMAIL:
        challengeResponse = {
          type: AuthChallenge.VERIFY_EMAIL,
          session: challenge.session!,
          code: code.trim(),
        };
        break;

      case AuthChallenge.VERIFY_PHONE:
        challengeResponse = {
          type: AuthChallenge.VERIFY_PHONE,
          session: challenge.session!,
          code: code.trim(),
        };
        break;

      case AuthChallenge.MFA_REQUIRED: {
        const method = this.mfaMethod();
        if (!method) {
          this.loading.set(false);
          this.error.set('MFA method not specified.');
          return;
        }
        // SDK auto-injects deviceId if one was selected via selectMFADevice()
        challengeResponse = {
          type: AuthChallenge.MFA_REQUIRED,
          session: challenge.session!,
          method,
          code: code.trim(),
          // No manual deviceId needed - SDK handles it!
        };
        break;
      }

      case AuthChallenge.MFA_SETUP_REQUIRED: {
        const method = this.mfaMethod() || (this.route.snapshot.queryParams['method'] as MFAMethod);
        if (!method || (method !== 'sms' && method !== 'email')) {
          this.loading.set(false);
          this.error.set('MFA method not specified for setup.');
          return;
        }

        // Use the already-determined authenticated flow status
        if (isAuthenticatedMfaSetup) {
          // Authenticated flow: use verifyMfaSetup
          const setupData = { code: code.trim() };
          this.auth
            .getClient()
            .verifyMfaSetup(method, setupData)
            .then(() => {
              this.loading.set(false);
              // Navigate back to dashboard
              this.router.navigate(['/dashboard']);
            })
            .catch((err) => {
              this.loading.set(false);
              this.handleError(err);
            });
          return; // Early return, async handling above
        } else {
          // Challenge flow: use respondToChallenge
          challengeResponse = {
            type: AuthChallenge.MFA_SETUP_REQUIRED,
            session: challenge.session!,
            method: method as 'sms' | 'email',
            setupData: { code: code.trim() },
          };
        }
        break;
      }

      default:
        this.loading.set(false);
        this.error.set('Invalid challenge type.');
        return;
    }

    try {
      const response: AuthResponse = await this.auth.respondToChallenge(challengeResponse);

      // If response has another challenge, route to it
      if (response.challengeName) {
        await this.handleNextChallenge(response);
      } else {
        // All challenges complete, redirect to success
        const successUrl = this.config.redirects?.success || '/dashboard';
        await this.router.navigate([successUrl]);
      }
    } catch (err: unknown) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle next challenge in progressive flow
   *
   * Uses orchestrator to determine and navigate to the appropriate challenge.
   *
   * @param response - Auth response with next challenge
   */
  private async handleNextChallenge(response: AuthResponse): Promise<void> {
    // Universal handler for progressive challenges
    await this.orchestrator.handleAuthResponse(response);
  }

  /**
   * Request code for a specific MFA method (MFA_REQUIRED only).
   * Gets the masked destination and sends the code.
   *
   * @param method - MFA method to request code for
   */
  private async requestCodeForMethod(method: MFAMethod): Promise<void> {
    const challenge = this.challenge();
    if (!challenge?.session || challenge.challengeName !== AuthChallenge.MFA_REQUIRED) {
      return;
    }

    // Only SMS and Email support code sending
    if (method !== 'sms' && method !== 'email') {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    // Use getChallengeData() which accepts a method parameter
    // This triggers code sending and returns masked destination
    try {
      const response = await this.auth.getChallengeData(challenge.session, method);
      if (response) {
        // For SMS/Email, challengeData is the masked destination string
        const maskedDest =
          (typeof response.challengeData === 'string' ? response.challengeData : null) ||
          'your device';

        // Store masked destination from API response
        this.maskedDestinationFromQuery.set(maskedDest);

        // Trigger toast for verification code
        if (challenge.session) {
          this.triggerToast(
            challenge.session,
            AuthChallenge.MFA_REQUIRED,
            method as 'sms' | 'email',
          );
        }

        this.success.set(`Code sent to ${maskedDest}`);
        setTimeout(() => {
          this.success.set(null);
        }, 3000);

        this.startResendTimer();
      }
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Resend verification code
   *
   * Calls the resend code API and shows success message.
   * Starts a 60-second countdown timer to prevent spam.
   * For MFA_SETUP_REQUIRED, calls getSetupData() instead of resendCode().
   */
  async resendCode(): Promise<void> {
    const challenge = this.challenge();
    const isMfaSetupVerifyRoute = this.router.url.includes('/mfa-setup-required/verify');

    // For MFA_SETUP_REQUIRED, prioritize query params, then selectedMethod, then challenge method
    // This ensures method is always available even after back navigation
    let method: MFAMethod | undefined;
    if (isMfaSetupVerifyRoute || challenge?.challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      method =
        (this.route.snapshot.queryParams['method'] as MFAMethod) ||
        this.selectedMethod() ||
        (challenge ? getMFAMethod(challenge) : undefined) ||
        this.mfaMethod();
    } else {
      // For other challenges, use standard priority
      method =
        (this.route.snapshot.queryParams['method'] as MFAMethod) ||
        this.selectedMethod() ||
        this.mfaMethod();
    }

    const mode = this.route.snapshot.queryParams['mode'] as string;

    // Check if this is authenticated flow (no challenge session) or challenge flow
    const isAuthenticatedFlow =
      (!challenge?.session && this.auth.isAuthenticated()) || mode === 'setup';

    // For MFA_SETUP_REQUIRED, we might not have a challenge session if coming from authenticated flow
    // But we should still have the challenge in AuthService for challenge flow
    if (!isAuthenticatedFlow) {
      // For challenge flow, ensure we have a valid challenge session
      const currentChallenge = this.auth.getCurrentChallenge();
      if (!currentChallenge?.session && !challenge?.session) {
        this.error.set('Challenge session expired. Please login again.');
        return;
      }
      // If challenge is not loaded but exists in AuthService, load it
      if (!challenge && currentChallenge) {
        this.loadChallenge(currentChallenge);
        // Re-run resend with updated challenge
        setTimeout(() => this.resendCode(), 100);
        return;
      }
    }

    const challengeName =
      challenge?.challengeName ||
      (isMfaSetupVerifyRoute ? AuthChallenge.MFA_SETUP_REQUIRED : undefined);

    if (!challengeName) {
      this.error.set('Unable to determine challenge type. Please try again.');
      return;
    }

    // Prevent resend if timer is active
    if (this.resendTimer() > 0) {
      return;
    }

    // MFA_SETUP_REQUIRED uses getSetupData() or setupMfaDevice() depending on flow
    if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      if (!method || (method !== 'sms' && method !== 'email')) {
        this.error.set('MFA method (SMS or Email) is required for resending code during setup.');
        return;
      }

      this.resending.set(true);
      this.error.set(null);
      this.success.set(null);

      // Clear toast flag to allow new toast on resend
      if (isAuthenticatedFlow) {
        // For authenticated flow, clear the authenticated toast flag
        const authenticatedToastKey = `authenticated-${method}`;
        this.toastTriggeredSessions.delete(authenticatedToastKey);
      } else if (challenge?.session) {
        // For challenge flow, clear the session-based toast flag
        const toastKey = `${challenge.session}-${method}`;
        this.toastTriggeredSessions.delete(toastKey);
      }

      if (isAuthenticatedFlow) {
        // Authenticated flow: use setupMfaDevice
        // Start timer immediately when resend is triggered (before API call)
        this.startResendTimer();
        this.auth
          .getClient()
          .setupMfaDevice(method)
          .then(() => {
            this.resending.set(false);
            const maskedDest = method === 'sms' ? 'your phone' : 'your email';
            this.success.set(`Code sent to ${maskedDest}`);
            setTimeout(() => {
              this.success.set(null);
            }, 3000);
            // Trigger toast for authenticated flow
            this.triggerToastForAuthenticatedFlow(
              AuthChallenge.MFA_SETUP_REQUIRED,
              method as 'sms' | 'email',
            );
          })
          .catch((err) => {
            this.resending.set(false);
            this.handleError(err);
          });
        return; // Early return, async handling above
      }

      // Challenge flow: use getSetupData
      if (!challenge || !challenge.session) {
        this.resending.set(false);
        this.error.set('Challenge session expired. Please login again.');
        return;
      }
      // Start timer immediately when resend is triggered (before API call)
      this.startResendTimer();
      try {
        const response = await this.auth.getSetupData(challenge.session, method);
        if (response) {
          const destination =
            (response.setupData['maskedPhone'] as string) ||
            (response.setupData['maskedEmail'] as string) ||
            'your device';
          this.success.set(`Code sent to ${destination}`);
          setTimeout(() => {
            this.success.set(null);
          }, 5000);

          // Update masked destination from response
          if (response.setupData['maskedPhone']) {
            this.maskedDestinationFromQuery.set(response.setupData['maskedPhone'] as string);
          } else if (response.setupData['maskedEmail']) {
            this.maskedDestinationFromQuery.set(response.setupData['maskedEmail'] as string);
          }

          // Refresh toast with new code
          if (challenge) {
            const sessionId = challenge.session;
            if (sessionId && method) {
              // Clear toast flag to allow new toast on resend
              const toastKey = `${sessionId}-${method}`;
              this.toastTriggeredSessions.delete(toastKey);
              // Trigger toast after resend
              this.triggerToast(sessionId, challengeName, method as 'sms' | 'email');
            }
          }
        }
      } catch (err) {
        this.handleError(err);
      } finally {
        this.resending.set(false);
      }
      return;
    }

    // Check if resend is supported for current method (for other challenge types)
    if (method === 'passkey' || method === 'totp') {
      this.error.set(
        `Cannot resend code for MFA method '${method}'. Only SMS and Email support code resending.`,
      );
      return;
    }

    // For other challenge types, use resendCode()
    if (!challenge || !challenge.session) {
      this.error.set('Challenge session expired. Please login again.');
      return;
    }

    // Determine method from challenge type if not already set
    // For VERIFY_EMAIL/VERIFY_PHONE, method is derived from challenge type
    let toastMethod: 'sms' | 'email' | undefined = method as 'sms' | 'email' | undefined;
    if (!toastMethod && challenge.challengeName) {
      if (challenge.challengeName === AuthChallenge.VERIFY_EMAIL) {
        toastMethod = 'email';
      } else if (challenge.challengeName === AuthChallenge.VERIFY_PHONE) {
        toastMethod = 'sms';
      }
    }

    // Clear toast flag to allow new toast on resend
    if (challenge?.session && toastMethod) {
      const toastKey = `${challenge.session}-${toastMethod}`;
      this.toastTriggeredSessions.delete(toastKey);
    }

    this.resending.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const response = await this.auth.resendCode(challenge.session);
      if (response) {
        this.success.set(`Code sent to ${response.destination || 'your device'}`);
        setTimeout(() => {
          this.success.set(null);
        }, 5000);

        this.startResendTimer();

        // Trigger toast after resend
        if (challenge && challenge.session && toastMethod) {
          const challengeName = challenge.challengeName || AuthChallenge.MFA_REQUIRED;
          this.triggerToast(challenge.session, challengeName, toastMethod);
        }
      }
    } catch (err) {
      this.handleError(err);
    } finally {
      this.resending.set(false);
    }
  }

  /**
   * Start resend countdown timer (5 seconds)
   */
  private startResendTimer(): void {
    // Clear any existing timer
    this.clearResendTimer();

    // Set initial countdown
    this.resendTimer.set(5);

    // Start countdown interval
    this.timerInterval = setInterval(() => {
      const current = this.resendTimer();
      if (current <= 1) {
        this.clearResendTimer();
      } else {
        this.resendTimer.set(current - 1);
      }
    }, 1000);
  }

  /**
   * Clear resend timer
   */
  private clearResendTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.resendTimer.set(0);
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearResendTimer();
    // Clear toast tracking on destroy to allow fresh triggers on next load
    this.toastTriggeredSessions.clear();
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Navigate back to method selection or login based on challenge type
   * - MFA_REQUIRED (login): go to mfa-selector
   * - MFA_SETUP_REQUIRED (signup): go to mfa-setup selector
   * - Other challenges: go to login
   *
   * Clears selectedMethod signal and challenge session to allow fresh state
   */
  goBack(): void {
    const challengeName = this.currentChallengeType();
    const isMfaSetupVerifyRoute = this.router.url.includes('/mfa-setup-required/verify');

    // Clear selectedMethod signal to prevent stale state
    // This fixes issues where wrong method descriptions are shown
    this.selectedMethod.set(undefined);

    // Clear masked destination from query to reset state
    this.maskedDestinationFromQuery.set(null);

    if (challengeName === AuthChallenge.MFA_REQUIRED) {
      // Login flow: go to method selector
      this.router.navigate(['/auth/challenge/mfa-selector']);
    } else if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED || isMfaSetupVerifyRoute) {
      // Signup flow: go to method setup selector
      // Clear challenge session for unauthenticated flows to allow fresh session creation
      // This is important when coming back with max attempts exceeded
      if (!this.auth.isAuthenticated()) {
        this.auth.clearChallenge();
      }
      // Clear any query params to reset to method selection
      this.router.navigate(['/auth/challenge/mfa-setup-required']);
    } else {
      // Other challenges: go to login
      this.router.navigate(['/login']);
    }
  }

  /**
   * Handle and format errors for display
   *
   * @param err - Error object (can be NAuthClientError or generic Error)
   */
  private handleError(err: unknown): void {
    handleAuthError(err, this.error);
  }
}
