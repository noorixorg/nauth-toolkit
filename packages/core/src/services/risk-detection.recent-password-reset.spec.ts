import { Repository } from 'typeorm';
import { RiskDetectionService } from './risk-detection.service';
import { IUser } from '../interfaces/entities.interface';
import { ClientInfo } from '../interfaces/client-info.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { RiskFactor } from '../enums/risk-factor.enum';
import { BaseSession, BaseAuthAudit } from '../entities';

describe('RiskDetectionService (recent_password_reset)', () => {
  let service: RiskDetectionService;
  let mockSessionRepository: jest.Mocked<Repository<BaseSession>>;
  let mockAuditRepository: jest.Mocked<Repository<BaseAuthAudit>>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  const mockClientInfo: ClientInfo = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    deviceToken: 'device-123',
    ipCountry: 'US',
  };

  beforeEach(() => {
    mockSessionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    mockAuditRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      mfa: {
        adaptive: {
          triggers: [RiskFactor.RECENT_PASSWORD_RESET],
        },
      },
    };

    service = new RiskDetectionService(mockSessionRepository, mockAuditRepository, mockConfig, mockLogger);
  });

  it('detects RECENT_PASSWORD_RESET when passwordChangedAt is after lastLoginAt', async () => {
    const user: IUser = {
      id: 1,
      sub: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      phone: null,
      firstName: null,
      lastName: null,
      passwordHash: 'hash',
      passwordChangedAt: new Date('2025-01-02T00:00:00.000Z'),
      passwordHistory: [],
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      mustChangePassword: false,
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lastLoginAt: new Date('2025-01-01T00:00:00.000Z'),
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

    const factors = await service.detectRiskFactors(user, mockClientInfo);
    expect(factors).toEqual([RiskFactor.RECENT_PASSWORD_RESET]);
  });

  it('does not detect RECENT_PASSWORD_RESET when lastLoginAt is missing', async () => {
    const user: IUser = {
      id: 1,
      sub: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      phone: null,
      firstName: null,
      lastName: null,
      passwordHash: 'hash',
      passwordChangedAt: new Date(),
      passwordHistory: [],
      isEmailVerified: true,
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

    const factors = await service.detectRiskFactors(user, mockClientInfo);
    expect(factors).toEqual([]);
  });
});
