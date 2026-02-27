/**
 * Service Initialization Helper
 *
 * Initializes all NAuth services in correct dependency order.
 * Matches NestJS AuthModule service initialization.
 */

import { Repository } from 'typeorm';
import type { EmailProvider, SMSProvider } from '../../interfaces/provider.interface';
// Public API imports
import {
  NAuthConfig,
  NAuthLogger,
  StorageAdapter,
  ClientInfoService,
  RateLimitStorageService,
  AccountLockoutStorageService,
  EmailVerificationService,
  PhoneVerificationService,
  MFAService,
  AuthService,
  AdminAuthService,
  SocialAuthService,
  NAuthException,
  AuthErrorCode,
  HookRegistryService,
} from '../../index';
import { registerBuiltInEmailNotificationHooks } from '../../services/email-notifications.hook';
// Internal API imports (for framework adapter use only)
import {
  PasswordService,
  JwtService,
  SessionService,
  PasswordResetService,
  AuthAuditService, // Internal version with recordEvent()
  ChallengeService,
  TrustedDeviceService,
  AuthFlowContextBuilder,
  AuthFlowStateMachineService,
  AuthChallengeHelperService,
  SocialProviderRegistry,
  GeoLocationService,
  RiskDetectionService,
  RiskScoringService,
  AdaptiveMFADecisionService,
} from '../../internal';
import {
  BaseUser,
  BaseSession,
  BaseLoginAttempt,
  BaseVerificationToken,
  BaseSocialAccount,
  BaseChallengeSession,
  BaseMFADevice,
  BaseAuthAudit,
  BaseTrustedDevice,
} from '../../entities';

/**
 * Service container returned by initServices()
 */
export interface NAuthServices {
  // Core services (always available)
  passwordService: PasswordService;
  jwtService: JwtService;
  clientInfoService: ClientInfoService;
  rateLimitStorageService: RateLimitStorageService;
  accountLockoutStorageService: AccountLockoutStorageService;
  sessionService: SessionService;
  challengeService: ChallengeService;
  emailVerificationService: EmailVerificationService;
  authFlowContextBuilder: AuthFlowContextBuilder;
  authFlowStateMachine: AuthFlowStateMachineService;
  authChallengeHelperService: AuthChallengeHelperService;
  authService: AuthService;
  adminAuthService: AdminAuthService;
  socialProviderRegistry: SocialProviderRegistry;
  socialAuthService: SocialAuthService;
  hookRegistry: HookRegistryService;

  // Conditional services
  auditService?: AuthAuditService;
  phoneVerificationService?: PhoneVerificationService;
  trustedDeviceService?: TrustedDeviceService;
  mfaService?: MFAService;
  geoLocationService?: GeoLocationService;
  riskDetectionService?: RiskDetectionService;
  riskScoringService?: RiskScoringService;
  adaptiveMFADecisionService?: AdaptiveMFADecisionService;
  csrfService?: unknown; // CsrfService (created in createNAuth)
}

/**
 * Initialize all services in correct dependency order
 *
 * Service initialization order matches NestJS AuthModule:
 * 1. PasswordService, JwtService (no dependencies)
 * 2. ClientInfoService (no dependencies)
 * 3. AuthAuditService (if enabled)
 * 4. RateLimitStorageService, AccountLockoutStorageService
 * 5. SessionService
 * 6. ChallengeService
 * 7. EmailVerificationService
 * 8. PhoneVerificationService (if SMS configured)
 * 9. TrustedDeviceService (if rememberDevices enabled)
 * 10. AuthFlowContextBuilder, AuthFlowStateMachine
 * 11. AuthChallengeHelperService
 * 12. MFAService (if enabled)
 * 13. AuthService
 * 14. SocialAuthService
 * 15. GeoLocationService (if MaxMind configured)
 * 16. Risk services (if adaptive MFA configured)
 *
 * @param config - NAuth configuration
 * @param repositories - Repository container
 * @param storageAdapter - Initialized storage adapter
 * @param logger - Logger instance
 * @param emailProvider - Email provider instance
 * @param smsProvider - SMS provider instance (optional)
 * @returns Service container with all initialized services
 */
export function initServices(
  config: NAuthConfig,
  repositories: {
    userRepository: Repository<BaseUser>;
    sessionRepository: Repository<BaseSession>;
    loginAttemptRepository: Repository<BaseLoginAttempt>;
    verificationTokenRepository: Repository<BaseVerificationToken>;
    socialAccountRepository: Repository<BaseSocialAccount>;
    challengeSessionRepository: Repository<BaseChallengeSession>;
    mfaDeviceRepository: Repository<BaseMFADevice>;
    authAuditRepository: Repository<BaseAuthAudit>;
    trustedDeviceRepository: Repository<BaseTrustedDevice> | null;
  },
  storageAdapter: StorageAdapter,
  logger: NAuthLogger,
  emailProvider: unknown,
  smsProvider?: unknown,
): NAuthServices {
  // ============================================================================
  // 1. Core Services (No Dependencies)
  // ============================================================================

  const passwordService = new PasswordService(config.password);
  const jwtService = new JwtService(config.jwt);
  const clientInfoService = new ClientInfoService();
  const hookRegistry = new HookRegistryService(logger);

  // ============================================================================
  // 2. Audit Service (Conditional)
  // ============================================================================

  const auditService =
    config.auditLogs?.enabled !== false
      ? new AuthAuditService(repositories.authAuditRepository, repositories.userRepository, logger, clientInfoService)
      : undefined;

  // ============================================================================
  // 3. Storage Services
  // ============================================================================

  const rateLimitStorageService = new RateLimitStorageService(storageAdapter);
  const accountLockoutStorageService = new AccountLockoutStorageService(storageAdapter);

  // ============================================================================
  // 4. Session Service
  // ============================================================================

  const sessionService = new SessionService(
    repositories.sessionRepository,
    storageAdapter,
    clientInfoService,
    config,
    logger,
    auditService,
  );

  // ============================================================================
  // 5. Challenge Service
  // ============================================================================

  const challengeService = new ChallengeService(
    repositories.challengeSessionRepository,
    clientInfoService,
    logger,
    auditService,
    config, // Pass config for maxAttempts
  );

  // ============================================================================
  // 6. Email Provider and Verification Service
  // ============================================================================

  if (!emailProvider) {
    throw new NAuthException(
      AuthErrorCode.VALIDATION_FAILED,
      'emailProvider is required. Install and configure an email package:\n' +
        '  yarn add @nauth-toolkit/email-console (for dev)\n' +
        '  yarn add @nauth-toolkit/email-nodemailer (for production)',
    );
  }

  // Validate email provider has required method
  if (typeof (emailProvider as Record<string, unknown>).sendVerificationEmail !== 'function') {
    throw new NAuthException(
      AuthErrorCode.VALIDATION_FAILED,
      'emailProvider must implement sendVerificationEmail method',
    );
  }

  // At this point the provider has been validated for required methods.
  // We still accept `unknown` inputs to keep peer-dependency providers optional,
  // but we narrow once validated to maintain strict typing.
  const typedEmailProvider = emailProvider as EmailProvider;

  // Inject logger into email provider if it supports it
  {
    const maybeLoggerAware = emailProvider as { setLogger?: (logger: NAuthLogger) => void };
    if (typeof maybeLoggerAware.setLogger === 'function') {
      maybeLoggerAware.setLogger(logger);
    }
  }

  // Inject global variables from email config if provider supports it
  if (
    emailProvider &&
    typeof (emailProvider as { setGlobalVariables?: (vars: Record<string, unknown>) => void }).setGlobalVariables ===
      'function' &&
    config.email
  ) {
    const mergedVars = (config.email.globalVariables ?? {}) as Record<string, unknown>;
    (emailProvider as { setGlobalVariables: (vars: Record<string, unknown>) => void }).setGlobalVariables(mergedVars);
  }

  // Inject config into email provider if it supports it (used for notification suppression logic)
  if (emailProvider && typeof (emailProvider as { setConfig?: (cfg: NAuthConfig) => void }).setConfig === 'function') {
    (emailProvider as { setConfig: (cfg: NAuthConfig) => void }).setConfig(config);
  }

  // ============================================================================
  // Register built-in email notification hooks (opt-in via emailNotifications)
  // ============================================================================
  try {
    // Framework adapters can suppress/override with their own hooks; built-ins are opt-in via config.
    const typedProvider = emailProvider as EmailProvider;
    registerBuiltInEmailNotificationHooks(hookRegistry, typedProvider, config, logger);
  } catch (error: unknown) {
    // Non-blocking: never prevent auth initialization if notifications wiring fails.
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger?.debug?.(`[EmailNotifications] Failed to register built-in email hooks: ${message}`);
  }

  const emailVerificationService = new EmailVerificationService(
    repositories.verificationTokenRepository,
    repositories.userRepository,
    typedEmailProvider,
    storageAdapter,
    config,
    clientInfoService,
    logger,
    hookRegistry,
    auditService,
  );

  // ============================================================================
  // 7. SMS Provider and Phone Verification Service (Conditional)
  // ============================================================================

  let phoneVerificationService: PhoneVerificationService | undefined;

  if (smsProvider) {
    const typedSmsProvider = smsProvider as SMSProvider;
    // Inject logger into SMS provider if it supports it
    {
      const maybeLoggerAware = smsProvider as { setLogger?: (logger: NAuthLogger) => void };
      if (typeof maybeLoggerAware.setLogger === 'function') {
        maybeLoggerAware.setLogger(logger);
      }
    }

    phoneVerificationService = new PhoneVerificationService(
      repositories.verificationTokenRepository,
      repositories.userRepository,
      typedSmsProvider,
      storageAdapter,
      config,
      clientInfoService,
      logger,
      hookRegistry,
      auditService,
    );
  }

  // ============================================================================
  // 8. Trusted Device Service (Conditional)
  // ============================================================================

  const trustedDeviceService = repositories.trustedDeviceRepository
    ? new TrustedDeviceService(config, logger, repositories.trustedDeviceRepository)
    : undefined;

  // ============================================================================
  // 9. Risk Detection and Adaptive MFA Services (Always created)
  // ============================================================================
  // NOTE: These services are needed by the auth flow context builder to decide
  // whether MFA is required / whether a sign-in should be blocked.
  const riskDetectionService = new RiskDetectionService(
    repositories.sessionRepository,
    repositories.authAuditRepository,
    config,
    logger,
    trustedDeviceService,
  );

  const riskScoringService = new RiskScoringService(config, logger);

  const adaptiveMFADecisionService = new AdaptiveMFADecisionService(
    riskDetectionService,
    riskScoringService,
    storageAdapter,
    clientInfoService,
    config,
    logger,
    auditService,
    hookRegistry,
  );

  // ============================================================================
  // 10. Auth Flow Services
  // ============================================================================

  const authFlowContextBuilder = new AuthFlowContextBuilder(
    trustedDeviceService,
    adaptiveMFADecisionService,
    clientInfoService,
    logger,
  );

  const authFlowStateMachine = new AuthFlowStateMachineService(authFlowContextBuilder, logger);

  const authChallengeHelperService = new AuthChallengeHelperService(
    challengeService,
    jwtService,
    sessionService,
    repositories.mfaDeviceRepository,
    logger,
    authFlowStateMachine,
    authFlowContextBuilder,
    clientInfoService,
    emailVerificationService,
    phoneVerificationService,
  );

  // ============================================================================
  // 10.5 Password Reset Service (Account Recovery)
  // ============================================================================
  const passwordResetService = new PasswordResetService(
    repositories.verificationTokenRepository,
    typedEmailProvider,
    storageAdapter,
    config,
    clientInfoService,
    logger,
    auditService,
    smsProvider ? (smsProvider as SMSProvider) : undefined,
  );

  // ============================================================================
  // 10. MFA Service (Conditional)
  // ============================================================================

  const mfaService = new MFAService(
    repositories.mfaDeviceRepository,
    repositories.userRepository,
    challengeService,
    config,
    logger,
    auditService,
    clientInfoService,
    hookRegistry,
  );

  // ============================================================================
  // 11. Auth Service
  // ============================================================================

  const authService = new AuthService(
    repositories.userRepository,
    repositories.loginAttemptRepository,
    passwordService,
    jwtService,
    sessionService,
    challengeService,
    authChallengeHelperService,
    emailVerificationService,
    clientInfoService,
    accountLockoutStorageService,
    config,
    logger,
    hookRegistry, // Hook registry for lifecycle hooks
    auditService,
    phoneVerificationService,
    mfaService,
    repositories.mfaDeviceRepository,
    trustedDeviceService,
    passwordResetService,
    undefined, // socialAuthService - will be set later
    repositories.sessionRepository,
    repositories.verificationTokenRepository,
    repositories.socialAccountRepository,
    repositories.challengeSessionRepository,
    repositories.authAuditRepository,
    repositories.trustedDeviceRepository || undefined,
  );

  // ============================================================================
  // 12. Social Auth Services
  // ============================================================================

  const socialProviderRegistry = new SocialProviderRegistry();

  const socialAuthService = new SocialAuthService(
    socialProviderRegistry,
    repositories.userRepository,
    repositories.socialAccountRepository,
    authService,
    logger,
    auditService,
  );

  const adminAuthService = new AdminAuthService(
    repositories.userRepository,
    repositories.loginAttemptRepository,
    passwordService,
    sessionService,
    challengeService,
    authChallengeHelperService,
    emailVerificationService,
    clientInfoService,
    accountLockoutStorageService,
    config,
    logger,
    hookRegistry,
    auditService,
    phoneVerificationService,
    repositories.mfaDeviceRepository,
    trustedDeviceService,
    passwordResetService,
    socialAuthService,
    repositories.sessionRepository,
    repositories.verificationTokenRepository,
    repositories.socialAccountRepository,
    repositories.challengeSessionRepository,
    repositories.authAuditRepository,
    repositories.trustedDeviceRepository || undefined,
  );

  // ============================================================================
  // 13. GeoLocation Service (Conditional)
  // ============================================================================

  let geoLocationService: GeoLocationService | undefined;

  if (config.geoLocation?.maxMind) {
    try {
      // Try to load MaxMind module (optional peer dependency)
      // IMPORTANT: initServices() is synchronous, so we provide a lazy module wrapper.
      // This avoids require() while keeping initServices() sync.
      const maxMindModule = {
        Reader: {
          open: async (dbPath: string) => {
            const lib = await import('@maxmind/geoip2-node');
            return await lib.Reader.open(dbPath);
          },
        },
      };
      geoLocationService = new GeoLocationService(config, storageAdapter, maxMindModule, logger);
    } catch {
      // MaxMind module not installed - service remains undefined
      logger?.warn?.('MaxMind GeoIP2 module not installed. Geolocation features will be disabled.');
    }
  }

  // ============================================================================
  // Return Service Container
  // ============================================================================

  return {
    passwordService,
    jwtService,
    clientInfoService,
    rateLimitStorageService,
    accountLockoutStorageService,
    sessionService,
    challengeService,
    emailVerificationService,
    authFlowContextBuilder,
    authFlowStateMachine,
    authChallengeHelperService,
    authService,
    adminAuthService,
    socialProviderRegistry,
    socialAuthService,
    hookRegistry,
    auditService,
    phoneVerificationService,
    trustedDeviceService,
    mfaService,
    geoLocationService,
    riskDetectionService,
    riskScoringService,
    adaptiveMFADecisionService,
  };
}
