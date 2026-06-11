import {
  IOnboardingCompletedHook,
  OnboardingCompletedMetadata,
  IPasswordChangedHook,
  PasswordChangedMetadata,
  IMFADeviceRemovedHook,
  MFADeviceRemovedMetadata,
  IAdaptiveMFARiskDetectedHook,
  AdaptiveMFARiskDetectedMetadata,
  IAccountStatusChangedHook,
  AccountStatusChangedMetadata,
  IEmailChangedHook,
  EmailChangedMetadata,
  IAccountLockedHook,
  AccountLockedMetadata,
  ISessionsRevokedHook,
  SessionsRevokedMetadata,
  IMFAFirstEnabledHook,
  MFAFirstEnabledMetadata,
  IMFAMethodAddedHook,
  MFAMethodAddedMetadata,
} from '../interfaces/hooks.interface';
import type { EmailProvider } from '../interfaces/provider.interface';
import type { NAuthConfig } from '../interfaces/config.interface';
import type { LoggerProvider } from '../interfaces/logger.interface';
import type { IUser } from '../interfaces/entities.interface';
import type { HookRegistryService } from './hook-registry.service';

/**
 * Internal helper for built-in email notification hooks.
 *
 * @internal
 */
class EmailNotificationsBase {
  constructor(
    protected readonly emailProvider: EmailProvider,
    protected readonly config: NAuthConfig,
    protected readonly logger?: LoggerProvider,
  ) {}

  /**
   * Decide whether a notification email should be sent.
   *
   * @param notificationType - Matches keys in `config.emailNotifications.suppress`
   */
  protected shouldSend(notificationType: string): boolean {
    const notifications = this.config.emailNotifications;

    // Global kill switch
    if (notifications?.enabled === false) {
      this.logger?.debug?.(`[EmailNotifications] Global kill switch: ${notificationType} email suppressed`);
      return false;
    }

    const suppress = notifications?.suppress as Record<string, boolean | undefined> | undefined;
    const configured = suppress?.[notificationType];

    // Default suppression behavior: optional notifications are DISABLED by default (true),
    // while code emails are ENABLED by default (false).
    const defaultSuppressed = !['emailVerification', 'passwordReset', 'adminPasswordReset'].includes(notificationType);
    const shouldSuppress = configured !== undefined ? configured : defaultSuppressed;

    if (shouldSuppress) {
      this.logger?.debug?.(`[EmailNotifications] ${notificationType} email suppressed by config`);
      return false;
    }

    return true;
  }

  protected getDisplayName(user: IUser): string {
    // Prefer real names if present; fall back to username; finally email local-part.
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (user.username) return user.username;
    if (user.email) return user.email.split('@')[0] || user.email;
    return user.sub;
  }
}

/**
 * Built-in email notification hooks (adapter-internal)
 *
 * Registers lifecycle hooks and sends notification emails via the configured EmailProvider.
 * Uses `config.emailNotifications` for suppression (opt-in for optional notifications).
 *
 * @internal
 *
 * Important behavior:
 * - Uses `config.emailNotifications` as the source of truth for suppression / enablement.
 * - Optional notifications are DISABLED by default (opt-in).
 * - Code emails (verification/password reset/admin reset) are handled elsewhere and are ENABLED by default.
 *
 * @example
 * ```typescript
 * // Framework adapters register these with HookRegistryService
 * registerBuiltInEmailNotificationHooks(hookRegistry, emailProvider, config, logger);
 * ```
 */
class WelcomeEmailNotificationHook extends EmailNotificationsBase implements IOnboardingCompletedHook {
  /**
   * Onboarding completed hook.
   *
   * Welcome emails are sent:
   * - Immediately after signup if verificationMethod = 'none'
   * - After the final required verification succeeds if verificationMethod = 'email' | 'phone' | 'both'
   */
  async execute(user: IUser, _metadata: OnboardingCompletedMetadata): Promise<void> {
    if (!this.shouldSend('welcome')) return;
    if (!user.email) return;
    await this.emailProvider.sendWelcomeEmail(user.email, this.getDisplayName(user));
  }
}

class PasswordChangedEmailNotificationHook extends EmailNotificationsBase implements IPasswordChangedHook {
  async execute(metadata: PasswordChangedMetadata): Promise<void> {
    if (!this.shouldSend('passwordChanged')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendPasswordChangedEmail?.(metadata.user.email, {
      changedBy: metadata.changedBy,
      sessionsRevoked: metadata.sessionsRevoked,
      timestamp: new Date().toISOString(),
    });
  }
}

class MFADeviceRemovedEmailNotificationHook extends EmailNotificationsBase implements IMFADeviceRemovedHook {
  async execute(metadata: MFADeviceRemovedMetadata): Promise<void> {
    if (!this.shouldSend('mfaDeviceRemoved')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendMFADeviceRemovedEmail?.(metadata.user.email, {
      deviceType: String(metadata.deviceType),
      deviceName: metadata.deviceName,
      removedBy: metadata.removedBy,
      reason: metadata.reason,
      remainingDeviceCount: metadata.remainingDeviceCount,
    });
  }
}

class AdaptiveMFARiskEmailNotificationHook extends EmailNotificationsBase implements IAdaptiveMFARiskDetectedHook {
  async execute(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void> {
    if (!this.shouldSend('adaptiveMfaRiskDetected')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendAdaptiveMFARiskAlertEmail?.(metadata.user.email, {
      riskScore: metadata.riskScore,
      riskLevel: metadata.riskLevel,
      riskFactors: metadata.riskFactors.map((f) => String(f)),
      action: metadata.action,
      timestamp: metadata.timestamp.toISOString(),
    });
  }
}

class AccountStatusEmailNotificationHook extends EmailNotificationsBase implements IAccountStatusChangedHook {
  async execute(metadata: AccountStatusChangedMetadata): Promise<void> {
    if (!metadata.user.email) return;
    const timestamp = new Date().toISOString();
    if (metadata.status === 'disabled') {
      if (!this.shouldSend('accountDisabled')) return;
      await this.emailProvider.sendAccountDisabledEmail?.(metadata.user.email, {
        reason: metadata.reason,
        performedBy: metadata.performedBy,
        timestamp,
      });
      return;
    }
    if (metadata.status === 'enabled') {
      if (!this.shouldSend('accountEnabled')) return;
      await this.emailProvider.sendAccountEnabledEmail?.(metadata.user.email, {
        reason: metadata.reason,
        performedBy: metadata.performedBy,
        timestamp,
      });
    }
  }
}

class EmailChangedEmailNotificationHook extends EmailNotificationsBase implements IEmailChangedHook {
  async execute(metadata: EmailChangedMetadata): Promise<void> {
    const timestamp = new Date().toISOString();
    if (this.shouldSend('emailChangedOld')) {
      await this.emailProvider.sendEmailChangedAlertEmail?.(metadata.oldEmail, {
        newEmail: metadata.newEmail,
        deactivatedMFADevices: metadata.deactivatedMFADevices,
        timestamp,
      });
    }
    if (this.shouldSend('emailChangedNew')) {
      await this.emailProvider.sendEmailChangedConfirmationEmail?.(metadata.newEmail, {
        oldEmail: metadata.oldEmail,
        timestamp,
      });
    }
  }
}

class AccountLockedEmailNotificationHook extends EmailNotificationsBase implements IAccountLockedHook {
  async execute(metadata: AccountLockedMetadata): Promise<void> {
    if (!this.shouldSend('accountLockout')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendAccountLockedEmail?.(metadata.user.email, {
      reason: metadata.reason,
      lockType: metadata.lockType,
      lockDuration: metadata.lockDuration,
      lockedUntil: metadata.lockedUntil,
      ipAddress: metadata.ipAddress,
      failedAttempts: metadata.failedAttempts,
    });
  }
}

class SessionsRevokedEmailNotificationHook extends EmailNotificationsBase implements ISessionsRevokedHook {
  async execute(metadata: SessionsRevokedMetadata): Promise<void> {
    if (metadata.initiatedBy === 'user') return;
    if (!this.shouldSend('sessionsRevoked')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendSessionsRevokedEmail?.(metadata.user.email, {
      revokedCount: metadata.revokedCount,
      reason: metadata.reason,
      triggerEvent: metadata.triggerEvent,
      timestamp: new Date().toISOString(),
    });
  }
}

class MFAFirstEnabledEmailNotificationHook extends EmailNotificationsBase implements IMFAFirstEnabledHook {
  async execute(metadata: MFAFirstEnabledMetadata): Promise<void> {
    if (!this.shouldSend('mfaFirstEnabled')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendMFAFirstEnabledEmail?.(metadata.user.email, {
      firstMethod: String(metadata.firstMethod),
      deviceName: metadata.deviceName,
      timestamp: metadata.enforcedAt.toISOString(),
    });
  }
}

class MFAMethodAddedEmailNotificationHook extends EmailNotificationsBase implements IMFAMethodAddedHook {
  async execute(metadata: MFAMethodAddedMetadata): Promise<void> {
    if (!this.shouldSend('mfaMethodAdded')) return;
    if (!metadata.user.email) return;
    await this.emailProvider.sendMFAMethodAddedEmail?.(metadata.user.email, {
      method: String(metadata.method),
      enabledMethods: metadata.enabledMethods.map((m) => String(m)),
      timestamp: metadata.timestamp.toISOString(),
    });
  }
}

/**
 * Register built-in email notification hooks into the HookRegistryService.
 *
 * @param hookRegistry - Hook registry service instance
 * @param emailProvider - Email provider instance
 * @param config - NAuth configuration
 * @param logger - Optional logger for debug messages
 */
export function registerBuiltInEmailNotificationHooks(
  hookRegistry: HookRegistryService,
  emailProvider: EmailProvider,
  config: NAuthConfig,
  logger?: LoggerProvider,
): void {
  hookRegistry.registerOnboardingCompleted(new WelcomeEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerPasswordChanged(new PasswordChangedEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerMFADeviceRemoved(new MFADeviceRemovedEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerAdaptiveMFARiskDetected(new AdaptiveMFARiskEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerAccountStatusChanged(new AccountStatusEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerEmailChanged(new EmailChangedEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerAccountLocked(new AccountLockedEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerSessionsRevoked(new SessionsRevokedEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerMFAFirstEnabled(new MFAFirstEnabledEmailNotificationHook(emailProvider, config, logger));
  hookRegistry.registerMFAMethodAdded(new MFAMethodAddedEmailNotificationHook(emailProvider, config, logger));
}
