/**
 * Get Repositories Unit Tests
 *
 * Tests repository discovery functionality.
 */

import { DataSource, Repository } from 'typeorm';
import { getRepositories } from './get-repositories';
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
  BaseRateLimit,
  BaseStorageLock,
  BaseSocialProviderSecret,
} from '../../entities';
import { NAuthException, AuthErrorCode } from '../../index';

describe('getRepositories', () => {
  let mockDataSource: jest.Mocked<DataSource>;
  let mockRepositories: Record<string, jest.Mocked<Repository<any>>>;

  beforeEach(() => {
    mockRepositories = {
      user: { findOne: jest.fn(), save: jest.fn() } as any,
      session: { findOne: jest.fn(), save: jest.fn() } as any,
      loginAttempt: { findOne: jest.fn(), save: jest.fn() } as any,
      verificationToken: { findOne: jest.fn(), save: jest.fn() } as any,
      socialAccount: { findOne: jest.fn(), save: jest.fn() } as any,
      challengeSession: { findOne: jest.fn(), save: jest.fn() } as any,
      mfaDevice: { findOne: jest.fn(), save: jest.fn() } as any,
      authAudit: { findOne: jest.fn(), save: jest.fn() } as any,
      trustedDevice: { findOne: jest.fn(), save: jest.fn() } as any,
      rateLimit: { findOne: jest.fn(), save: jest.fn() } as any,
      storageLock: { findOne: jest.fn(), save: jest.fn() } as any,
      socialProviderSecret: { findOne: jest.fn(), save: jest.fn() } as any,
    };

    mockDataSource = {
      entityMetadatas: [
        { tableName: 'nauth_users', target: BaseUser },
        { tableName: 'nauth_sessions', target: BaseSession },
        { tableName: 'nauth_login_attempts', target: BaseLoginAttempt },
        { tableName: 'nauth_verification_tokens', target: BaseVerificationToken },
        { tableName: 'nauth_social_accounts', target: BaseSocialAccount },
        { tableName: 'nauth_challenge_sessions', target: BaseChallengeSession },
        { tableName: 'nauth_mfa_devices', target: BaseMFADevice },
        { tableName: 'nauth_auth_audit', target: BaseAuthAudit },
        { tableName: 'nauth_social_provider_secrets', target: BaseSocialProviderSecret },
      ] as any,
      getRepository: jest.fn((target) => {
        if (target === BaseUser) return mockRepositories.user;
        if (target === BaseSession) return mockRepositories.session;
        if (target === BaseLoginAttempt) return mockRepositories.loginAttempt;
        if (target === BaseVerificationToken) return mockRepositories.verificationToken;
        if (target === BaseSocialAccount) return mockRepositories.socialAccount;
        if (target === BaseChallengeSession) return mockRepositories.challengeSession;
        if (target === BaseMFADevice) return mockRepositories.mfaDevice;
        if (target === BaseAuthAudit) return mockRepositories.authAudit;
        if (target === BaseSocialProviderSecret) return mockRepositories.socialProviderSecret;
        return null;
      }),
    } as any;
  });

  it('should get all required repositories by table name', () => {
    const repos = getRepositories(mockDataSource);
    expect(repos.userRepository).toBe(mockRepositories.user);
    expect(repos.sessionRepository).toBe(mockRepositories.session);
    expect(repos.loginAttemptRepository).toBe(mockRepositories.loginAttempt);
    expect(repos.verificationTokenRepository).toBe(mockRepositories.verificationToken);
    expect(repos.socialAccountRepository).toBe(mockRepositories.socialAccount);
    expect(repos.challengeSessionRepository).toBe(mockRepositories.challengeSession);
    expect(repos.mfaDeviceRepository).toBe(mockRepositories.mfaDevice);
    expect(repos.authAuditRepository).toBe(mockRepositories.authAudit);
    expect(repos.socialProviderSecretRepository).toBe(mockRepositories.socialProviderSecret);
  });

  it('should throw error when required entity not found', () => {
    const emptyDataSource = {
      entityMetadatas: [],
      getRepository: jest.fn(),
    } as any;

    expect(() => getRepositories(emptyDataSource)).toThrow(NAuthException);
    try {
      getRepositories(emptyDataSource);
    } catch (error) {
      expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
    }
  });

  it('should return null for optional repositories when not found', () => {
    const minimalDataSource = {
      entityMetadatas: [
        { tableName: 'nauth_users', target: BaseUser },
        { tableName: 'nauth_sessions', target: BaseSession },
        { tableName: 'nauth_login_attempts', target: BaseLoginAttempt },
        { tableName: 'nauth_verification_tokens', target: BaseVerificationToken },
        { tableName: 'nauth_social_accounts', target: BaseSocialAccount },
        { tableName: 'nauth_challenge_sessions', target: BaseChallengeSession },
        { tableName: 'nauth_mfa_devices', target: BaseMFADevice },
        { tableName: 'nauth_auth_audit', target: BaseAuthAudit },
        { tableName: 'nauth_social_provider_secrets', target: BaseSocialProviderSecret },
      ] as any,
      getRepository: jest.fn((target) => {
        if (target === BaseUser) return mockRepositories.user;
        if (target === BaseSession) return mockRepositories.session;
        if (target === BaseLoginAttempt) return mockRepositories.loginAttempt;
        if (target === BaseVerificationToken) return mockRepositories.verificationToken;
        if (target === BaseSocialAccount) return mockRepositories.socialAccount;
        if (target === BaseChallengeSession) return mockRepositories.challengeSession;
        if (target === BaseMFADevice) return mockRepositories.mfaDevice;
        if (target === BaseAuthAudit) return mockRepositories.authAudit;
        if (target === BaseSocialProviderSecret) return mockRepositories.socialProviderSecret;
        return null;
      }),
    } as any;

    const repos = getRepositories(minimalDataSource);
    expect(repos.trustedDeviceRepository).toBeNull();
    expect(repos.rateLimitRepository).toBeNull();
    expect(repos.storageLockRepository).toBeNull();
  });
});
