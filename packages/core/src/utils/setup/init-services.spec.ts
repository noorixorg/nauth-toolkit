/**
 * Init Services Unit Tests
 *
 * Tests service initialization functionality.
 */

import { Repository } from 'typeorm';
import { initServices } from './init-services';
import {
  NAuthConfig,
  NAuthLogger,
  StorageAdapter,
  BaseUser,
  BaseSession,
  BaseLoginAttempt,
  BaseVerificationToken,
  BaseSocialAccount,
  BaseChallengeSession,
  BaseMFADevice,
  BaseAuthAudit,
  BaseTrustedDevice,
} from '../../index';

describe('initServices', () => {
  let mockConfig: NAuthConfig;
  let mockRepositories: any;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockEmailProvider: unknown;
  let mockSmsProvider: unknown;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'a'.repeat(32), expiresIn: 3600 },
        refreshToken: { secret: 'a'.repeat(32), expiresIn: 86400 },
      },
      emailProvider: {
        sendVerificationEmail: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        sendWelcomeEmail: jest.fn(),
        sendAdminPasswordResetEmail: jest.fn(),
      } as any,
    } as NAuthConfig;

    mockRepositories = {
      userRepository: {} as Repository<BaseUser>,
      sessionRepository: {} as Repository<BaseSession>,
      loginAttemptRepository: {} as Repository<BaseLoginAttempt>,
      verificationTokenRepository: {} as Repository<BaseVerificationToken>,
      socialAccountRepository: {} as Repository<BaseSocialAccount>,
      challengeSessionRepository: {} as Repository<BaseChallengeSession>,
      mfaDeviceRepository: {} as Repository<BaseMFADevice>,
      authAuditRepository: {} as Repository<BaseAuthAudit>,
      trustedDeviceRepository: null,
    };

    mockStorageAdapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      incr: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(undefined),
      ttl: jest.fn().mockResolvedValue(-1),
      hget: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(undefined),
      hgetall: jest.fn().mockResolvedValue({}),
      hdel: jest.fn().mockResolvedValue(0),
      lpush: jest.fn().mockResolvedValue(undefined),
      lrange: jest.fn().mockResolvedValue([]),
      llen: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([]),
      scan: jest.fn().mockResolvedValue([0, []]),
      cleanup: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockEmailProvider = mockConfig.emailProvider;
    mockSmsProvider = undefined;
  });

  it('should initialize all services', () => {
    const services = initServices(
      mockConfig,
      mockRepositories,
      mockStorageAdapter,
      mockLogger,
      mockEmailProvider,
      mockSmsProvider,
    );

    expect(services).toBeDefined();
    expect(services.passwordService).toBeDefined();
    expect(services.jwtService).toBeDefined();
    expect(services.clientInfoService).toBeDefined();
    expect(services.authService).toBeDefined();
  });

  it('should throw error when emailProvider is missing', () => {
    expect(() => {
      initServices(mockConfig, mockRepositories, mockStorageAdapter, mockLogger, undefined, mockSmsProvider);
    }).toThrow();
  });
});
