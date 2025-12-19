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
    // @ts-expect-error - Optional peer dependency, may not be installed
    const { TOTPMFAProviderService, TOTPService } = await import('@nauth-toolkit/mfa-totp');

    const totpService = new TOTPService(config, logger);

    const totpProvider = new TOTPMFAProviderService(
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

    mfaService.registerProvider(totpProvider as unknown as IMFAProviderService);
    logger?.debug?.('TOTP MFA provider registered');
  } catch (_error) {
    logger?.warn?.('TOTP MFA package not found. Install @nauth-toolkit/mfa-totp to enable TOTP MFA.');
  }

  // ============================================================================
  // SMS MFA Provider
  // ============================================================================
  if (phoneVerificationService) {
    try {
      // @ts-expect-error - Optional peer dependency, may not be installed
      const { SMSMFAProviderService } = await import('@nauth-toolkit/mfa-sms');

      const smsProvider = new SMSMFAProviderService(
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

      mfaService.registerProvider(smsProvider as unknown as IMFAProviderService);
      logger?.debug?.('SMS MFA provider registered');
    } catch (_error) {
      logger?.warn?.('SMS MFA package not found. Install @nauth-toolkit/mfa-sms to enable SMS MFA.');
    }
  } else {
    logger?.debug?.('Phone verification service not configured. Skipping SMS MFA registration.');
  }

  // ============================================================================
  // Email MFA Provider
  // ============================================================================
  try {
    // @ts-expect-error - Optional peer dependency, may not be installed
    const { EmailMFAProviderService } = await import('@nauth-toolkit/mfa-email');

    const emailProvider = new EmailMFAProviderService(
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

    mfaService.registerProvider(emailProvider as unknown as IMFAProviderService);
    logger?.debug?.('Email MFA provider registered');
  } catch (_error) {
    logger?.warn?.('Email MFA package not found. Install @nauth-toolkit/mfa-email to enable Email MFA.');
  }

  // ============================================================================
  // Passkey MFA Provider
  // ============================================================================
  try {
    // @ts-expect-error - Optional peer dependency, may not be installed
    const { PasskeyMFAProviderService, PasskeyService } = await import('@nauth-toolkit/mfa-passkey');

    const passkeyService = new PasskeyService(config, logger);

    const passkeyProvider = new PasskeyMFAProviderService(
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

    mfaService.registerProvider(passkeyProvider as unknown as IMFAProviderService);
    logger?.debug?.('Passkey MFA provider registered');
  } catch (_error) {
    logger?.warn?.('Passkey MFA package not found. Install @nauth-toolkit/mfa-passkey to enable Passkey MFA.');
  }
}
