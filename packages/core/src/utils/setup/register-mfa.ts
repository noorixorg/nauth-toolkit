/**
 * MFA Provider Registration
 *
 * Dynamically loads and registers MFA providers with the MFAService.
 */

import { Repository } from 'typeorm';
// Public API imports
import {
  NAuthConfig,
  NAuthLogger,
  MFAService,
  BaseMFADevice,
  BaseUser,
  PhoneVerificationService,
  EmailVerificationService,
  AuthAuditService,
  ClientInfoService,
  IMFAProviderService,
} from '../../index';
// Internal API imports (for framework adapter use only)
import { PasswordService, ChallengeService } from '../../internal';

/**
 * Import an optional peer dependency at runtime without creating a compile-time
 * dependency for TypeScript consumers of `@nauth-toolkit/core`.
 *
 * IMPORTANT: the module specifier is intentionally typed as `string` (not a literal)
 * to prevent TypeScript from erroring when the peer dependency isn't installed.
 */
async function importOptional<TModule>(moduleName: string): Promise<TModule | null> {
  try {
    return (await import(moduleName)) as unknown as TModule;
  } catch {
    return null;
  }
}

/**
 * Register MFA providers with the MFA service
 *
 * Dynamically imports MFA provider packages based on configuration.
 * Each provider is initialized with required services and registered.
 *
 * @param config - NAuth configuration
 * @param mfaService - MFA management service
 * @param mfaDeviceRepository - MFA device repository
 * @param userRepository - User repository
 * @param logger - Logger instance
 * @param passwordService - Password service (required by base provider)
 * @param phoneVerificationService - Phone verification service (optional, for SMS MFA)
 * @param challengeService - Challenge service (optional)
 * @param auditService - Audit service (optional)
 * @param clientInfoService - Client info service (optional)
 */
export async function registerMFAProviders(
  config: NAuthConfig,
  mfaService: MFAService,
  mfaDeviceRepository: Repository<BaseMFADevice>,
  userRepository: Repository<BaseUser>,
  logger: NAuthLogger,
  passwordService: PasswordService,
  emailVerificationService: EmailVerificationService,
  phoneVerificationService?: PhoneVerificationService,
  challengeService?: ChallengeService,
  auditService?: AuthAuditService,
  clientInfoService?: ClientInfoService,
): Promise<void> {
  if (!config.mfa?.enabled) {
    return;
  }

  // ============================================================================
  // TOTP MFA Provider
  // ============================================================================
  try {
    type TotpModule = {
      TOTPMFAProviderService: new (...args: unknown[]) => IMFAProviderService;
      TOTPService: new (...args: unknown[]) => unknown;
    };

    const mod = await importOptional<TotpModule>('@nauth-toolkit/mfa-totp' as string);
    if (!mod) {
      logger?.warn?.('TOTP MFA package not found. Install @nauth-toolkit/mfa-totp to enable TOTP MFA.');
    } else {
      const totpService = new mod.TOTPService(config, logger);

      const totpProvider = new mod.TOTPMFAProviderService(
        mfaDeviceRepository,
        userRepository,
        config,
        logger,
        passwordService,
        totpService,
        challengeService,
        auditService,
        clientInfoService,
      );

      mfaService.registerProvider(totpProvider);
      logger?.debug?.('TOTP MFA provider registered');
    }
  } catch {
    logger?.warn?.('TOTP MFA package not found. Install @nauth-toolkit/mfa-totp to enable TOTP MFA.');
  }

  // ============================================================================
  // SMS MFA Provider
  // ============================================================================
  if (phoneVerificationService) {
    try {
      type SmsModule = {
        SMSMFAProviderService: new (...args: unknown[]) => IMFAProviderService;
      };

      const mod = await importOptional<SmsModule>('@nauth-toolkit/mfa-sms' as string);
      if (!mod) {
        logger?.warn?.('SMS MFA package not found. Install @nauth-toolkit/mfa-sms to enable SMS MFA.');
      } else {
        const smsProvider = new mod.SMSMFAProviderService(
          mfaDeviceRepository,
          userRepository,
          config,
          logger,
          passwordService,
          phoneVerificationService,
          challengeService,
          auditService,
          clientInfoService,
        );

        mfaService.registerProvider(smsProvider);
        logger?.debug?.('SMS MFA provider registered');
      }
    } catch {
      logger?.warn?.('SMS MFA package not found. Install @nauth-toolkit/mfa-sms to enable SMS MFA.');
    }
  } else {
    logger?.debug?.('Phone verification service not configured. Skipping SMS MFA registration.');
  }

  // ============================================================================
  // Email MFA Provider
  // ============================================================================
  try {
    type EmailModule = {
      EmailMFAProviderService: new (...args: unknown[]) => IMFAProviderService;
    };

    const mod = await importOptional<EmailModule>('@nauth-toolkit/mfa-email' as string);
    if (!mod) {
      logger?.warn?.('Email MFA package not found. Install @nauth-toolkit/mfa-email to enable Email MFA.');
    } else {
      const emailProvider = new mod.EmailMFAProviderService(
        mfaDeviceRepository,
        userRepository,
        config,
        logger,
        passwordService,
        emailVerificationService,
        challengeService,
        auditService,
        clientInfoService,
      );

      mfaService.registerProvider(emailProvider);
      logger?.debug?.('Email MFA provider registered');
    }
  } catch {
    logger?.warn?.('Email MFA package not found. Install @nauth-toolkit/mfa-email to enable Email MFA.');
  }

  // ============================================================================
  // Passkey MFA Provider
  // ============================================================================
  try {
    type PasskeyModule = {
      PasskeyMFAProviderService: new (...args: unknown[]) => IMFAProviderService;
      PasskeyService: new (...args: unknown[]) => unknown;
    };

    const mod = await importOptional<PasskeyModule>('@nauth-toolkit/mfa-passkey' as string);
    if (!mod) {
      logger?.warn?.('Passkey MFA package not found. Install @nauth-toolkit/mfa-passkey to enable Passkey MFA.');
    } else {
      const passkeyService = new mod.PasskeyService(config, logger);

      const passkeyProvider = new mod.PasskeyMFAProviderService(
        mfaDeviceRepository,
        userRepository,
        config,
        logger,
        passwordService,
        passkeyService,
        challengeService,
        auditService,
        clientInfoService,
      );

      mfaService.registerProvider(passkeyProvider);
      logger?.debug?.('Passkey MFA provider registered');
    }
  } catch {
    logger?.warn?.('Passkey MFA package not found. Install @nauth-toolkit/mfa-passkey to enable Passkey MFA.');
  }
}
