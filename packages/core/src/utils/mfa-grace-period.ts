import { MfaGracePeriodInfo } from '../dto/auth-response.dto';
import { NAuthConfig } from '../interfaces/config.interface';
import { IUser } from '../interfaces/entities.interface';

/**
 * Default MFA grace period in days, applied when `mfa.gracePeriod` is not configured.
 */
export const DEFAULT_MFA_GRACE_PERIOD_DAYS = 7;

/**
 * Raw MFA grace period window for a user.
 *
 * Describes only the time window derived from the user's creation date and the
 * configured `mfa.gracePeriod` — it does not account for enforcement mode,
 * exemption, or whether the user already has MFA enabled.
 */
export interface MfaGracePeriodWindow {
  /**
   * Whether the grace period window is still open
   */
  isActive: boolean;

  /**
   * Timestamp at which the grace period window closes
   * Only present when the window is still active
   */
  endsAt?: Date;
}

/**
 * Milliseconds in one day, used to derive whole days remaining in a grace period.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Check whether a user is exempt from MFA enforcement.
 *
 * Normalises the different database representations of the `mfaExempt` flag
 * (boolean `true` in PostgreSQL, tinyint `1` in MySQL).
 *
 * @param user - User to check
 * @returns True if the user is exempt from MFA enforcement
 *
 * @example
 * ```typescript
 * if (isMfaExempt(user)) {
 *   // Skip all MFA setup / verification requirements
 * }
 * ```
 */
export function isMfaExempt(user: IUser): boolean {
  const mfaExempt = user.mfaExempt;
  return mfaExempt === true || (mfaExempt as unknown) === 1;
}

/**
 * Calculate the raw MFA grace period window for a user.
 *
 * The window runs for `mfa.gracePeriod` days from the user's creation date.
 * A configured grace period of `0` disables the window entirely.
 *
 * @param user - User to calculate the window for
 * @param config - Auth configuration
 * @returns Grace period window with active flag and end date
 *
 * @example
 * ```typescript
 * const window = calculateMfaGracePeriodWindow(user, config);
 * // { isActive: true, endsAt: 2025-02-01T00:00:00.000Z }
 * ```
 */
export function calculateMfaGracePeriodWindow(user: IUser, config: NAuthConfig): MfaGracePeriodWindow {
  const gracePeriod = config.mfa?.gracePeriod ?? DEFAULT_MFA_GRACE_PERIOD_DAYS;

  // No grace period configured - MFA enforcement applies immediately
  if (gracePeriod === 0) {
    return { isActive: false };
  }

  // Access createdAt from user interface
  const userWithDates = user as IUser & { createdAt: Date };
  const createdAt = userWithDates.createdAt;

  if (!createdAt) {
    // No creation date - grace period not active
    return { isActive: false };
  }

  const gracePeriodEnd = new Date(createdAt);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);

  const now = new Date();
  const isActive = now < gracePeriodEnd;

  return {
    isActive,
    endsAt: isActive ? gracePeriodEnd : undefined,
  };
}

/**
 * Check whether the MFA setup challenge should be suppressed for the signup flow.
 *
 * Backs `mfa.grace.skipForSignup`, which keeps signup frictionless by letting the user
 * finish signing up without an MFA wall. It is honoured even when `gracePeriod` is `0`,
 * and enforcement resumes on the user's next login.
 *
 * @param config - Auth configuration
 * @param isSignup - Whether the current flow is a signup (or a verification challenge it issued)
 * @returns True if the MFA setup challenge should be skipped for this flow
 *
 * @example
 * ```typescript
 * if (shouldSkipMfaSetupForSignup(config, context.isSignup)) {
 *   // Issue tokens now; the next login will demand MFA setup
 * }
 * ```
 */
export function shouldSkipMfaSetupForSignup(config: NAuthConfig, isSignup?: boolean): boolean {
  return isSignup === true && config.mfa?.grace?.skipForSignup === true;
}

/**
 * Build the client-facing MFA grace period payload for a user.
 *
 * Returns a payload only when MFA setup is pending but not yet being demanded, i.e.
 * MFA is enabled with `REQUIRED` or `ADAPTIVE` enforcement, the user has neither enabled
 * MFA nor been exempted, and either:
 * - the day-based grace window is still open, or
 * - the setup challenge was skipped for this signup via `mfa.grace.skipForSignup`,
 *   in which case the payload reports `requiredAtNextLogin: true`.
 *
 * Clients use this to run an optional MFA setup flow before enforcement kicks in.
 *
 * @param user - User to build the payload for
 * @param config - Auth configuration
 * @param options - Flow options
 * @param options.isSignup - Whether the current flow is a signup (or a verification challenge it issued)
 * @returns Grace period payload, or undefined when no grace period applies
 *
 * @example
 * ```typescript
 * const mfaGracePeriod = buildMfaGracePeriodInfo(user, config);
 * // { active: true, endsAt: '2025-02-01T00:00:00.000Z', daysRemaining: 7, enforcement: 'REQUIRED' }
 *
 * const signupGrace = buildMfaGracePeriodInfo(user, config, { isSignup: true });
 * // { active: true, daysRemaining: 0, enforcement: 'REQUIRED', requiredAtNextLogin: true }
 * ```
 */
export function buildMfaGracePeriodInfo(
  user: IUser,
  config: NAuthConfig,
  options?: { isSignup?: boolean },
): MfaGracePeriodInfo | undefined {
  // Grace period is an MFA-setup concept - irrelevant when MFA is off
  if (!config.mfa?.enabled) {
    return undefined;
  }

  // OPTIONAL enforcement never requires setup, so there is nothing to grant grace for
  const enforcement = config.mfa.enforcement ?? 'OPTIONAL';
  if (enforcement !== 'REQUIRED' && enforcement !== 'ADAPTIVE') {
    return undefined;
  }

  // Setup already done, or the user is exempt from enforcement entirely
  if (user.mfaEnabled || isMfaExempt(user)) {
    return undefined;
  }

  const window = calculateMfaGracePeriodWindow(user, config);

  if (window.isActive && window.endsAt) {
    // Round up so the final partial day still reports as 1 day remaining
    const daysRemaining = Math.max(1, Math.ceil((window.endsAt.getTime() - Date.now()) / MS_PER_DAY));

    return {
      active: true,
      endsAt: window.endsAt.toISOString(),
      daysRemaining,
      enforcement,
    };
  }

  // No day-based grace left, but the setup challenge is being skipped to keep this
  // signup frictionless - tell the client that the next login will demand setup.
  if (shouldSkipMfaSetupForSignup(config, options?.isSignup)) {
    return {
      active: true,
      daysRemaining: 0,
      enforcement,
      requiredAtNextLogin: true,
    };
  }

  return undefined;
}
