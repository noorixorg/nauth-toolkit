/**
 * Bootstrap Unit Tests
 *
 * Tests NAuth bootstrap functionality.
 */

import { NAuth } from './bootstrap';
import { DataSource } from 'typeorm';
import { NAuthConfig, ExpressAdapter } from './index';

// Mock setup functions
jest.mock('./utils/setup/run-nauth-migrations');
jest.mock('./utils/setup/get-repositories');
jest.mock('./utils/setup/init-storage');
jest.mock('./utils/setup/init-services');
jest.mock('./utils/setup/register-mfa');
jest.mock('./utils/setup/init-social');

describe('NAuth', () => {
  let mockConfig: NAuthConfig;
  let mockDataSource: Partial<DataSource>;

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
      signup: {
        verificationMethod: 'none' as const,
      },
    } as NAuthConfig;

    mockDataSource = {
      isInitialized: true,
      entityMetadatas: [],
      getRepository: jest.fn(),
    };
  });

  describe('create', () => {
    it('should create NAuth instance', async () => {
      const { getRepositories } = require('./utils/setup/get-repositories');
      const { initStorage } = require('./utils/setup/init-storage');
      const { initServices } = require('./utils/setup/init-services');

      getRepositories.mockReturnValue({
        userRepository: {},
        sessionRepository: {},
        loginAttemptRepository: {},
        verificationTokenRepository: {},
        socialAccountRepository: {},
        challengeSessionRepository: {},
        mfaDeviceRepository: {},
        authAuditRepository: {},
        trustedDeviceRepository: null,
        rateLimitRepository: {},
        storageLockRepository: {},
      });

      initStorage.mockResolvedValue({
        initialize: jest.fn(),
        isHealthy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        decr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
        hdel: jest.fn(),
        lpush: jest.fn(),
        lrange: jest.fn(),
        llen: jest.fn(),
        keys: jest.fn(),
        scan: jest.fn(),
        cleanup: jest.fn(),
        disconnect: jest.fn(),
      });

      initServices.mockReturnValue({
        passwordService: {},
        jwtService: {},
        clientInfoService: {},
        authService: {},
        adminAuthService: {},
        socialAuthService: {},
        mfaService: {},
        emailVerificationService: {},
        phoneVerificationService: undefined,
        sessionService: {},
        challengeService: {},
        authChallengeHelperService: {},
        trustedDeviceService: null,
        socialProviderRegistry: {},
        hookRegistry: {},
        auditService: {},
        geoLocationService: undefined,
        riskDetectionService: undefined,
        riskScoringService: undefined,
        adaptiveMFADecisionService: undefined,
      });

      const instance = await NAuth.create({
        config: mockConfig,
        dataSource: mockDataSource as DataSource,
      });

      expect(instance).toBeDefined();
      expect(instance.config).toBe(mockConfig);
      expect(instance.adapter).toBeDefined();
    });

    it('should use ExpressAdapter by default', async () => {
      const { getRepositories } = require('./utils/setup/get-repositories');
      const { initStorage } = require('./utils/setup/init-storage');
      const { initServices } = require('./utils/setup/init-services');

      getRepositories.mockReturnValue({
        userRepository: {},
        sessionRepository: {},
        loginAttemptRepository: {},
        verificationTokenRepository: {},
        socialAccountRepository: {},
        challengeSessionRepository: {},
        mfaDeviceRepository: {},
        authAuditRepository: {},
        trustedDeviceRepository: null,
        rateLimitRepository: {},
        storageLockRepository: {},
      });

      initStorage.mockResolvedValue({
        initialize: jest.fn(),
        isHealthy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        decr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
        hdel: jest.fn(),
        lpush: jest.fn(),
        lrange: jest.fn(),
        llen: jest.fn(),
        keys: jest.fn(),
        scan: jest.fn(),
        cleanup: jest.fn(),
        disconnect: jest.fn(),
      });

      initServices.mockReturnValue({
        passwordService: {},
        jwtService: {},
        clientInfoService: {},
        authService: {},
        adminAuthService: {},
        socialAuthService: {},
        mfaService: {},
        emailVerificationService: {},
        phoneVerificationService: undefined,
        sessionService: {},
        challengeService: {},
        authChallengeHelperService: {},
        trustedDeviceService: null,
        socialProviderRegistry: {},
        hookRegistry: {},
        auditService: {},
        geoLocationService: undefined,
        riskDetectionService: undefined,
        riskScoringService: undefined,
        adaptiveMFADecisionService: undefined,
      });

      const instance = await NAuth.create({
        config: mockConfig,
        dataSource: mockDataSource as DataSource,
      });

      expect(instance.adapter).toBeInstanceOf(ExpressAdapter);
    });

    it('should throw error when AuthChallengeHelperService is not initialized', async () => {
      const { getRepositories } = require('./utils/setup/get-repositories');
      const { initStorage } = require('./utils/setup/init-storage');
      const { initServices } = require('./utils/setup/init-services');

      getRepositories.mockReturnValue({
        userRepository: {},
        sessionRepository: {},
        loginAttemptRepository: {},
        verificationTokenRepository: {},
        socialAccountRepository: {},
        challengeSessionRepository: {},
        mfaDeviceRepository: {},
        authAuditRepository: {},
        trustedDeviceRepository: null,
        rateLimitRepository: {},
        storageLockRepository: {},
      });

      initStorage.mockResolvedValue({
        initialize: jest.fn(),
        isHealthy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        decr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
        hdel: jest.fn(),
        lpush: jest.fn(),
        lrange: jest.fn(),
        llen: jest.fn(),
        keys: jest.fn(),
        scan: jest.fn(),
        cleanup: jest.fn(),
        disconnect: jest.fn(),
      });

      initServices.mockReturnValue({
        passwordService: {},
        jwtService: {},
        clientInfoService: {},
        authService: {},
        adminAuthService: {},
        socialAuthService: {},
        mfaService: {},
        emailVerificationService: {},
        phoneVerificationService: undefined,
        sessionService: {},
        challengeService: {},
        authChallengeHelperService: null,
        trustedDeviceService: null,
        socialProviderRegistry: {},
        hookRegistry: {},
        auditService: {},
        geoLocationService: undefined,
        riskDetectionService: undefined,
        riskScoringService: undefined,
        adaptiveMFADecisionService: undefined,
      });

      await expect(
        NAuth.create({
          config: mockConfig,
          dataSource: mockDataSource as DataSource,
        }),
      ).rejects.toThrow('AuthChallengeHelperService not initialized');
    });

    it('should register MFA providers when enabled', async () => {
      const { getRepositories } = require('./utils/setup/get-repositories');
      const { initStorage } = require('./utils/setup/init-storage');
      const { initServices } = require('./utils/setup/init-services');
      const { registerMFAProviders } = require('./utils/setup/register-mfa');

      getRepositories.mockReturnValue({
        userRepository: {},
        sessionRepository: {},
        loginAttemptRepository: {},
        verificationTokenRepository: {},
        socialAccountRepository: {},
        challengeSessionRepository: {},
        mfaDeviceRepository: {},
        authAuditRepository: {},
        trustedDeviceRepository: null,
        rateLimitRepository: {},
        storageLockRepository: {},
      });

      initStorage.mockResolvedValue({
        initialize: jest.fn(),
        isHealthy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        decr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
        hdel: jest.fn(),
        lpush: jest.fn(),
        lrange: jest.fn(),
        llen: jest.fn(),
        keys: jest.fn(),
        scan: jest.fn(),
        cleanup: jest.fn(),
        disconnect: jest.fn(),
      });

      initServices.mockReturnValue({
        passwordService: {},
        jwtService: {},
        clientInfoService: {},
        authService: {},
        adminAuthService: {},
        socialAuthService: {},
        mfaService: {},
        emailVerificationService: {},
        phoneVerificationService: undefined,
        sessionService: {},
        challengeService: {},
        authChallengeHelperService: {},
        trustedDeviceService: null,
        socialProviderRegistry: {},
        hookRegistry: {},
        auditService: {},
        geoLocationService: undefined,
        riskDetectionService: undefined,
        riskScoringService: undefined,
        adaptiveMFADecisionService: undefined,
      });

      registerMFAProviders.mockResolvedValue(undefined);

      const mfaConfig = {
        ...mockConfig,
        mfa: {
          enabled: true,
        },
      };

      await NAuth.create({
        config: mfaConfig as NAuthConfig,
        dataSource: mockDataSource as DataSource,
      });

      expect(registerMFAProviders).toHaveBeenCalled();
    });

    it('should create helpers with all methods', async () => {
      const { getRepositories } = require('./utils/setup/get-repositories');
      const { initStorage } = require('./utils/setup/init-storage');
      const { initServices } = require('./utils/setup/init-services');

      getRepositories.mockReturnValue({
        userRepository: {},
        sessionRepository: {},
        loginAttemptRepository: {},
        verificationTokenRepository: {},
        socialAccountRepository: {},
        challengeSessionRepository: {},
        mfaDeviceRepository: {},
        authAuditRepository: {},
        trustedDeviceRepository: null,
        rateLimitRepository: {},
        storageLockRepository: {},
      });

      initStorage.mockResolvedValue({
        initialize: jest.fn(),
        isHealthy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        decr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
        hdel: jest.fn(),
        lpush: jest.fn(),
        lrange: jest.fn(),
        llen: jest.fn(),
        keys: jest.fn(),
        scan: jest.fn(),
        cleanup: jest.fn(),
        disconnect: jest.fn(),
      });

      initServices.mockReturnValue({
        passwordService: {},
        jwtService: {},
        clientInfoService: {},
        authService: {},
        adminAuthService: {},
        socialAuthService: {},
        mfaService: {},
        emailVerificationService: {},
        phoneVerificationService: undefined,
        sessionService: {},
        challengeService: {},
        authChallengeHelperService: {},
        trustedDeviceService: null,
        socialProviderRegistry: {},
        hookRegistry: {},
        auditService: {},
        geoLocationService: undefined,
        riskDetectionService: undefined,
        riskScoringService: undefined,
        adaptiveMFADecisionService: undefined,
      });

      const instance = await NAuth.create({
        config: mockConfig,
        dataSource: mockDataSource as DataSource,
      });

      expect(instance.helpers).toBeDefined();
      expect(instance.helpers.public).toBeDefined();
      expect(instance.helpers.requireAuth).toBeDefined();
      expect(instance.helpers.optionalAuth).toBeDefined();
      expect(instance.helpers.tokenDelivery).toBeDefined();
      expect(instance.helpers.getCurrentUser).toBeDefined();
      expect(instance.helpers.getCurrentSession).toBeDefined();
      expect(instance.helpers.getClientInfo).toBeDefined();
    });

    it('should create CSRF no-op middleware when CSRF is disabled', async () => {
      const { getRepositories } = require('./utils/setup/get-repositories');
      const { initStorage } = require('./utils/setup/init-storage');
      const { initServices } = require('./utils/setup/init-services');

      getRepositories.mockReturnValue({
        userRepository: {},
        sessionRepository: {},
        loginAttemptRepository: {},
        verificationTokenRepository: {},
        socialAccountRepository: {},
        challengeSessionRepository: {},
        mfaDeviceRepository: {},
        authAuditRepository: {},
        trustedDeviceRepository: null,
        rateLimitRepository: {},
        storageLockRepository: {},
      });

      initStorage.mockResolvedValue({
        initialize: jest.fn(),
        isHealthy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        decr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
        hdel: jest.fn(),
        lpush: jest.fn(),
        lrange: jest.fn(),
        llen: jest.fn(),
        keys: jest.fn(),
        scan: jest.fn(),
        cleanup: jest.fn(),
        disconnect: jest.fn(),
      });

      initServices.mockReturnValue({
        passwordService: {},
        jwtService: {},
        clientInfoService: {},
        authService: {},
        adminAuthService: {},
        socialAuthService: {},
        mfaService: {},
        emailVerificationService: {},
        phoneVerificationService: undefined,
        sessionService: {},
        challengeService: {},
        authChallengeHelperService: {},
        trustedDeviceService: null,
        socialProviderRegistry: {},
        hookRegistry: {},
        auditService: {},
        geoLocationService: undefined,
        riskDetectionService: undefined,
        riskScoringService: undefined,
        adaptiveMFADecisionService: undefined,
      });

      const jsonConfig = {
        ...mockConfig,
        tokenDelivery: {
          method: 'json',
        },
      };

      const instance = await NAuth.create({
        config: jsonConfig as NAuthConfig,
        dataSource: mockDataSource as DataSource,
      });

      expect(instance.middleware.csrf).toBeDefined();
    });
  });
});
