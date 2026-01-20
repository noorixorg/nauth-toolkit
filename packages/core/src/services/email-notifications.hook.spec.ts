import { HookRegistryService } from './hook-registry.service';
import { registerBuiltInEmailNotificationHooks } from './email-notifications.hook';
import type { EmailProvider } from '../interfaces/provider.interface';
import type { NAuthConfig } from '../interfaces/config.interface';
import type { IUser } from '../interfaces/entities.interface';
import { RiskFactor } from '../enums/risk-factor.enum';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * EmailNotifications hook wiring tests
 *
 * Ensures built-in notification hooks do not affect verification-token emails and
 * that welcome notifications follow the documented behavior.
 */
describe('registerBuiltInEmailNotificationHooks', () => {
  const baseConfig: NAuthConfig = {
    jwt: {
      accessToken: { expiresIn: '15m', secret: 'test' },
      refreshToken: { expiresIn: '7d', secret: 'test-refresh' },
    },
  };

  const logger = {
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const baseUser: IUser = {
    id: 1,
    sub: 'user-sub-123',
    email: 'user@example.com',
    username: 'user',
    phone: null,
    firstName: 'Test',
    lastName: 'User',
    passwordHash: null,
    passwordChangedAt: null,
    passwordHistory: null,
    isEmailVerified: false,
    isPhoneVerified: false,
    isActive: true,
    mustChangePassword: false,
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: null,
    lastLoginIp: null,
    hasSocialAuth: false,
    socialProviders: null,
    mfaEnabled: false,
    mfaMethods: null,
    preferredMfaMethod: null,
    backupCodes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const createEmailProvider = (): jest.Mocked<EmailProvider> => {
    return {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendMFAEmailCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendAdminPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendLockoutEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
      sendMFADeviceRemovedEmail: jest.fn().mockResolvedValue(undefined),
      sendAdaptiveMFARiskAlertEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountDisabledEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountEnabledEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailChangedAlertEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailChangedConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountLockedEmail: jest.fn().mockResolvedValue(undefined),
      sendSessionsRevokedEmail: jest.fn().mockResolvedValue(undefined),
      sendMFAFirstEnabledEmail: jest.fn().mockResolvedValue(undefined),
      sendMFAMethodAddedEmail: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<EmailProvider>;
  };

  it('does not send welcome by default (optional notifications are opt-in)', async () => {
    const emailProvider = createEmailProvider();
    const hookRegistry = new HookRegistryService(logger);

    registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, baseConfig);

    await hookRegistry.executeOnboardingCompleted(baseUser, {
      verificationMethod: 'none',
      source: 'signup',
      completedAt: new Date(),
    });

    expect(emailProvider.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(emailProvider.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends welcome when suppress.welcome=false', async () => {
    const emailProvider = createEmailProvider();
    const config: NAuthConfig = {
      ...baseConfig,
      emailNotifications: {
        suppress: {
          welcome: false,
        },
      },
    };
    const hookRegistry = new HookRegistryService(logger);

    registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, config);

    await hookRegistry.executeOnboardingCompleted(baseUser, {
      verificationMethod: 'email',
      source: 'email_verification',
      completedAt: new Date(),
    });

    expect(emailProvider.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(emailProvider.sendWelcomeEmail).toHaveBeenCalledWith(baseUser.email, expect.any(String));
    // Ensure this hook never triggers code emails (those are driven by verification services/challenge system)
    expect(emailProvider.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not send welcome from postSignup (welcome is sent on onboardingCompleted)', async () => {
    const emailProvider = createEmailProvider();
    const config: NAuthConfig = {
      ...baseConfig,
      emailNotifications: {
        suppress: {
          welcome: false,
        },
      },
    };
    const hookRegistry = new HookRegistryService(logger);

    registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, config);

    await hookRegistry.executePostSignup(baseUser, { requiresVerification: true, signupType: 'password' });

    expect(emailProvider.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('sends sessionsRevoked email only when initiatedBy is not user', async () => {
    const emailProvider = createEmailProvider();
    const config: NAuthConfig = {
      ...baseConfig,
      emailNotifications: {
        suppress: {
          sessionsRevoked: false,
        },
      },
    };
    const hookRegistry = new HookRegistryService(logger);

    registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, config);

    await hookRegistry.executeSessionsRevoked({
      user: baseUser,
      revokedCount: 2,
      reason: 'password_changed',
      initiatedBy: 'system',
      triggerEvent: 'password_changed',
    });

    expect(emailProvider.sendSessionsRevokedEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeSessionsRevoked({
      user: baseUser,
      revokedCount: 1,
      reason: 'user_request',
      initiatedBy: 'user',
      triggerEvent: 'user_request',
    });

    expect(emailProvider.sendSessionsRevokedEmail).toHaveBeenCalledTimes(1);
  });

  it('sends adaptiveMfaRiskDetected email only when suppression is disabled', async () => {
    const emailProvider = createEmailProvider();
    const hookRegistry = new HookRegistryService(logger);

    // Default (optional notifications are suppressed): should NOT send
    registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, baseConfig);
    await hookRegistry.executeAdaptiveMFARiskDetected({
      user: baseUser,
      riskScore: 65,
      riskLevel: 'high',
      riskFactors: [RiskFactor.NEW_COUNTRY, RiskFactor.IMPOSSIBLE_TRAVEL],
      action: 'block_signin',
      authMethod: 'password',
      clientInfo: { ipAddress: '1.2.3.4', userAgent: 'ua' },
      timestamp: new Date(),
    });
    expect(emailProvider.sendAdaptiveMFARiskAlertEmail).not.toHaveBeenCalled();

    // Opt-in: allow this email
    const emailProvider2 = createEmailProvider();
    const hookRegistry2 = new HookRegistryService(logger);
    registerBuiltInEmailNotificationHooks(hookRegistry2, emailProvider2, {
      ...baseConfig,
      emailNotifications: { suppress: { adaptiveMfaRiskDetected: false } },
    });
    await hookRegistry2.executeAdaptiveMFARiskDetected({
      user: baseUser,
      riskScore: 65,
      riskLevel: 'high',
      riskFactors: [RiskFactor.NEW_COUNTRY, RiskFactor.IMPOSSIBLE_TRAVEL],
      action: 'block_signin',
      authMethod: 'password',
      clientInfo: { ipAddress: '1.2.3.4', userAgent: 'ua' },
      timestamp: new Date(),
    });
    expect(emailProvider2.sendAdaptiveMFARiskAlertEmail).toHaveBeenCalledTimes(1);
  });

  it('fires all notification emails when suppression is disabled', async () => {
    const emailProvider = createEmailProvider();
    const config: NAuthConfig = {
      ...baseConfig,
      emailNotifications: {
        suppress: {
          welcome: false,
          passwordChanged: false,
          mfaDeviceRemoved: false,
          adaptiveMfaRiskDetected: false,
          accountDisabled: false,
          accountEnabled: false,
          emailChangedOld: false,
          emailChangedNew: false,
          accountLockout: false,
          sessionsRevoked: false,
          mfaFirstEnabled: false,
          mfaMethodAdded: false,
        },
      },
    };
    const hookRegistry = new HookRegistryService(logger);
    registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, config);

    await hookRegistry.executeOnboardingCompleted(baseUser, {
      verificationMethod: 'none',
      source: 'signup',
      completedAt: new Date(),
    });
    expect(emailProvider.sendWelcomeEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executePasswordChanged({ user: baseUser, changedBy: 'user' });
    expect(emailProvider.sendPasswordChangedEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeMFADeviceRemoved({
      user: baseUser,
      deviceType: MFAMethod.TOTP,
      removedBy: 'user',
      remainingDeviceCount: 0,
    });
    expect(emailProvider.sendMFADeviceRemovedEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeAdaptiveMFARiskDetected({
      user: baseUser,
      riskScore: 65,
      riskLevel: 'high',
      riskFactors: [RiskFactor.NEW_COUNTRY],
      action: 'block_signin',
      authMethod: 'password',
      clientInfo: { ipAddress: '1.2.3.4', userAgent: 'ua' },
      timestamp: new Date(),
    });
    expect(emailProvider.sendAdaptiveMFARiskAlertEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeAccountStatusChanged({ user: baseUser, status: 'disabled', reason: 'test' });
    expect(emailProvider.sendAccountDisabledEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeAccountStatusChanged({ user: baseUser, status: 'enabled' });
    expect(emailProvider.sendAccountEnabledEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeEmailChanged({
      user: baseUser,
      oldEmail: 'old@example.com',
      newEmail: 'new@example.com',
      updateSource: 'user_request',
    });
    expect(emailProvider.sendEmailChangedAlertEmail).toHaveBeenCalledTimes(1);
    expect(emailProvider.sendEmailChangedConfirmationEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeAccountLocked({
      user: baseUser,
      reason: 'too_many_attempts',
      lockType: 'temporary',
      lockDuration: 900,
    });
    expect(emailProvider.sendAccountLockedEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeSessionsRevoked({
      user: baseUser,
      revokedCount: 2,
      reason: 'password_changed',
      initiatedBy: 'system',
      triggerEvent: 'password_changed',
    });
    expect(emailProvider.sendSessionsRevokedEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeMFAFirstEnabled({
      user: baseUser,
      firstMethod: MFAMethod.EMAIL,
      enforcedAt: new Date(),
    });
    expect(emailProvider.sendMFAFirstEnabledEmail).toHaveBeenCalledTimes(1);

    await hookRegistry.executeMFAMethodAdded({
      user: baseUser,
      method: MFAMethod.PASSKEY,
      isFirstMethod: false,
      enabledMethods: [MFAMethod.TOTP, MFAMethod.PASSKEY],
      timestamp: new Date(),
    });
    expect(emailProvider.sendMFAMethodAddedEmail).toHaveBeenCalledTimes(1);

    // Sanity: notification hooks must not send code emails
    expect(emailProvider.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

