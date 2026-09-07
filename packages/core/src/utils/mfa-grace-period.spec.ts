/**
 * MFA Grace Period Utility Unit Tests
 *
 * Covers the day-based grace window, the client-facing payload, and the
 * `mfa.grace.skipForSignup` escape hatch.
 */

import {
  buildMfaGracePeriodInfo,
  calculateMfaGracePeriodWindow,
  DEFAULT_MFA_GRACE_PERIOD_DAYS,
  isMfaExempt,
  shouldSkipMfaSetupForSignup,
} from './mfa-grace-period';
import { NAuthConfig } from '../interfaces/config.interface';
import { IUser } from '../interfaces/entities.interface';

describe('mfa-grace-period', () => {
  const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const makeUser = (overrides: Partial<IUser> = {}): IUser =>
    ({
      id: 1,
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      email: 'test@example.com',
      mfaEnabled: false,
      mfaExempt: false,
      createdAt: daysAgo(1),
      ...overrides,
    }) as IUser;

  const makeConfig = (mfa: NAuthConfig['mfa']): NAuthConfig => ({ mfa }) as NAuthConfig;

  describe('isMfaExempt', () => {
    it('treats boolean true as exempt', () => {
      expect(isMfaExempt(makeUser({ mfaExempt: true }))).toBe(true);
    });

    it('treats MySQL tinyint 1 as exempt', () => {
      expect(isMfaExempt(makeUser({ mfaExempt: 1 as unknown as boolean }))).toBe(true);
    });

    it('treats false as not exempt', () => {
      expect(isMfaExempt(makeUser({ mfaExempt: false }))).toBe(false);
    });
  });

  describe('calculateMfaGracePeriodWindow', () => {
    it('reports an active window inside the configured period', () => {
      const result = calculateMfaGracePeriodWindow(makeUser({ createdAt: daysAgo(2) }), makeConfig({ gracePeriod: 7 }));

      expect(result.isActive).toBe(true);
      expect(result.endsAt).toBeInstanceOf(Date);
    });

    it('reports an expired window past the configured period', () => {
      const result = calculateMfaGracePeriodWindow(
        makeUser({ createdAt: daysAgo(30) }),
        makeConfig({ gracePeriod: 7 }),
      );

      expect(result.isActive).toBe(false);
      expect(result.endsAt).toBeUndefined();
    });

    it('disables the window when gracePeriod is 0', () => {
      expect(calculateMfaGracePeriodWindow(makeUser(), makeConfig({ gracePeriod: 0 })).isActive).toBe(false);
    });

    it('falls back to the default period when unconfigured', () => {
      expect(
        calculateMfaGracePeriodWindow(
          makeUser({ createdAt: daysAgo(DEFAULT_MFA_GRACE_PERIOD_DAYS - 1) }),
          makeConfig({}),
        ).isActive,
      ).toBe(true);
      expect(
        calculateMfaGracePeriodWindow(
          makeUser({ createdAt: daysAgo(DEFAULT_MFA_GRACE_PERIOD_DAYS + 1) }),
          makeConfig({}),
        ).isActive,
      ).toBe(false);
    });

    it('is inactive when the user has no creation date', () => {
      expect(
        calculateMfaGracePeriodWindow(
          makeUser({ createdAt: undefined as unknown as Date }),
          makeConfig({ gracePeriod: 7 }),
        ).isActive,
      ).toBe(false);
    });
  });

  describe('shouldSkipMfaSetupForSignup', () => {
    it('skips only when both the flag and the signup flow are present', () => {
      const config = makeConfig({ grace: { skipForSignup: true } });

      expect(shouldSkipMfaSetupForSignup(config, true)).toBe(true);
      expect(shouldSkipMfaSetupForSignup(config, false)).toBe(false);
      expect(shouldSkipMfaSetupForSignup(config, undefined)).toBe(false);
    });

    it('does not skip when the option is off', () => {
      expect(shouldSkipMfaSetupForSignup(makeConfig({ grace: { skipForSignup: false } }), true)).toBe(false);
      expect(shouldSkipMfaSetupForSignup(makeConfig({}), true)).toBe(false);
    });
  });

  describe('buildMfaGracePeriodInfo', () => {
    const enforcedConfig = makeConfig({ enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 });

    it('returns the window payload during an active grace period', () => {
      const result = buildMfaGracePeriodInfo(makeUser({ createdAt: daysAgo(2) }), enforcedConfig);

      expect(result).toEqual({
        active: true,
        endsAt: expect.any(String),
        daysRemaining: 5,
        enforcement: 'REQUIRED',
      });
    });

    it('rounds a partial final day up to 1', () => {
      const result = buildMfaGracePeriodInfo(makeUser({ createdAt: daysAgo(6.9) }), enforcedConfig);

      expect(result?.daysRemaining).toBe(1);
    });

    it('returns undefined once the grace period has expired', () => {
      expect(buildMfaGracePeriodInfo(makeUser({ createdAt: daysAgo(30) }), enforcedConfig)).toBeUndefined();
    });

    it('returns undefined when MFA is disabled', () => {
      expect(
        buildMfaGracePeriodInfo(makeUser(), makeConfig({ enabled: false, enforcement: 'REQUIRED', gracePeriod: 7 })),
      ).toBeUndefined();
    });

    it('returns undefined for OPTIONAL enforcement', () => {
      expect(
        buildMfaGracePeriodInfo(makeUser(), makeConfig({ enabled: true, enforcement: 'OPTIONAL', gracePeriod: 7 })),
      ).toBeUndefined();
    });

    it('returns undefined when the user already has MFA enabled', () => {
      expect(buildMfaGracePeriodInfo(makeUser({ mfaEnabled: true }), enforcedConfig)).toBeUndefined();
    });

    it('returns undefined when the user is MFA exempt', () => {
      expect(buildMfaGracePeriodInfo(makeUser({ mfaExempt: true }), enforcedConfig)).toBeUndefined();
    });

    it('works for ADAPTIVE enforcement', () => {
      const result = buildMfaGracePeriodInfo(
        makeUser({ createdAt: daysAgo(1) }),
        makeConfig({ enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 }),
      );

      expect(result?.enforcement).toBe('ADAPTIVE');
    });

    describe('with grace.skipForSignup', () => {
      const skipConfig = makeConfig({
        enabled: true,
        enforcement: 'REQUIRED',
        gracePeriod: 0,
        grace: { skipForSignup: true },
      });

      it('reports requiredAtNextLogin during signup when gracePeriod is 0', () => {
        expect(buildMfaGracePeriodInfo(makeUser(), skipConfig, { isSignup: true })).toEqual({
          active: true,
          daysRemaining: 0,
          enforcement: 'REQUIRED',
          requiredAtNextLogin: true,
        });
      });

      it('returns undefined outside the signup flow', () => {
        expect(buildMfaGracePeriodInfo(makeUser(), skipConfig, { isSignup: false })).toBeUndefined();
        expect(buildMfaGracePeriodInfo(makeUser(), skipConfig)).toBeUndefined();
      });

      it('prefers the day-based window when one is still open', () => {
        const result = buildMfaGracePeriodInfo(
          makeUser({ createdAt: daysAgo(1) }),
          makeConfig({ enabled: true, enforcement: 'REQUIRED', gracePeriod: 7, grace: { skipForSignup: true } }),
          { isSignup: true },
        );

        expect(result?.requiredAtNextLogin).toBeUndefined();
        expect(result?.endsAt).toEqual(expect.any(String));
        expect(result?.daysRemaining).toBe(6);
      });

      it('still returns undefined for an exempt user signing up', () => {
        expect(buildMfaGracePeriodInfo(makeUser({ mfaExempt: true }), skipConfig, { isSignup: true })).toBeUndefined();
      });
    });

    describe('social logins', () => {
      const socialExemptConfig = makeConfig({
        enabled: true,
        enforcement: 'REQUIRED',
        gracePeriod: 7,
        requireForSocialLogin: false,
      });

      const socialEnforcedConfig = makeConfig({
        enabled: true,
        enforcement: 'REQUIRED',
        gracePeriod: 7,
        requireForSocialLogin: true,
      });

      it('returns undefined for a social login when requireForSocialLogin is false', () => {
        // Setup is never demanded for these users, so announcing a deadline would send
        // the client chasing a setup flow that is never enforced
        expect(buildMfaGracePeriodInfo(makeUser(), socialExemptConfig, { authMethod: 'social' })).toBeUndefined();
        expect(
          buildMfaGracePeriodInfo(makeUser(), socialExemptConfig, { authMethod: 'social', isSignup: true }),
        ).toBeUndefined();
      });

      it('still reports the window for password logins when social is exempted', () => {
        expect(buildMfaGracePeriodInfo(makeUser(), socialExemptConfig, { authMethod: 'password' })?.active).toBe(true);
      });

      it('reports the window for a social login when requireForSocialLogin is true', () => {
        const result = buildMfaGracePeriodInfo(makeUser({ createdAt: daysAgo(2) }), socialEnforcedConfig, {
          authMethod: 'social',
        });

        expect(result).toEqual({
          active: true,
          endsAt: expect.any(String),
          daysRemaining: 5,
          enforcement: 'REQUIRED',
        });
      });

      it('reports requiredAtNextLogin for an enforced social signup with gracePeriod 0', () => {
        const result = buildMfaGracePeriodInfo(
          makeUser(),
          makeConfig({
            enabled: true,
            enforcement: 'REQUIRED',
            gracePeriod: 0,
            requireForSocialLogin: true,
            grace: { skipForSignup: true },
          }),
          { authMethod: 'social', isSignup: true },
        );

        expect(result).toEqual({
          active: true,
          daysRemaining: 0,
          enforcement: 'REQUIRED',
          requiredAtNextLogin: true,
        });
      });

      it('treats an unspecified authMethod as password', () => {
        expect(buildMfaGracePeriodInfo(makeUser(), socialExemptConfig)?.active).toBe(true);
      });
    });
  });
});
