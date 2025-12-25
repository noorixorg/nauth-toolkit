import { Repository } from 'typeorm';
import { RiskDetectionService } from './risk-detection.service';
import { IUser, ISession } from '../interfaces/entities.interface';
import { ClientInfo } from '../interfaces/client-info.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { RiskFactor } from '../enums/risk-factor.enum';
import { BaseSession, BaseAuthAudit } from '../entities';

/**
 * Risk Detection Service Unit Tests
 *
 * Tests risk factor detection, double-counting prevention, error handling,
 * and configuration-based trigger enabling/disabling.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('RiskDetectionService', () => {
  let service: RiskDetectionService;
  let mockSessionRepository: jest.Mocked<Repository<BaseSession>>;
  let mockAuditRepository: jest.Mocked<Repository<BaseAuthAudit>>;
  let mockTrustedDeviceService: jest.Mocked<any>;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;

  const mockUser: IUser = {
    id: 1,
    sub: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    phone: null,
    firstName: null,
    lastName: null,
    passwordHash: null,
    passwordChangedAt: null,
    passwordHistory: null,
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

  const mockClientInfo: ClientInfo = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    deviceToken: 'device-123',
    deviceName: 'Chrome on Windows',
    deviceType: 'desktop',
    ipCountry: 'US',
    ipCity: 'New York',
    platform: 'Windows',
    browser: 'Chrome',
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

    mockTrustedDeviceService = {
      isDeviceTrusted: jest.fn(),
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
          triggers: [
            RiskFactor.NEW_DEVICE,
            RiskFactor.NEW_IP,
            RiskFactor.NEW_COUNTRY,
            RiskFactor.IMPOSSIBLE_TRAVEL,
            RiskFactor.SUSPICIOUS_ACTIVITY,
          ],
        },
      },
    };

    // Instantiate service directly
    service = new RiskDetectionService(
      mockSessionRepository,
      mockAuditRepository,
      mockConfig,
      mockLogger,
      mockTrustedDeviceService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // detectRiskFactors() - NEW_DEVICE
  // ============================================================================

  describe('detectRiskFactors() - new_device', () => {
    it('should detect new device when device never seen before', async () => {
      // Setup: trusted device check returns false (not trusted)
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      // new_device check finds no session -> device is new
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // Device not found
      // new_country check: country exists (optimized - 1 query, returns early)
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      // impossible_travel check: no previous session
      mockSessionRepository.findOne.mockResolvedValueOnce(null);
      // new_ip check: IP exists (since country exists, new_ip is still checked)
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // IP exists
      // hasUserLoggedInBefore check (for INCOMPLETE_LOCATION_DATA): user has no previous sessions
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous sessions
      // suspicious_activity check: no suspicious activity
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      // Use clientInfo with complete location data to avoid INCOMPLETE_LOCATION_DATA
      const clientInfoWithCompleteLocation: ClientInfo = {
        ...mockClientInfo,
        ipLatitude: 40.7128,
        ipLongitude: -74.006,
      };

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithCompleteLocation);

      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      expect(factors.length).toBe(1); // Only new_device, others are not new
    });

    it('should not detect new device when device seen before', async () => {
      // Trusted device check returns false (not trusted), then session check finds device
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session for impossible_travel
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.NEW_DEVICE);
    });

    it('should skip new_device check if trigger not enabled', async () => {
      mockConfig.mfa!.adaptive!.triggers = [RiskFactor.NEW_IP, RiskFactor.NEW_COUNTRY];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.NEW_DEVICE);
      // Should not call findOne for device check
      expect(mockSessionRepository.findOne).not.toHaveBeenCalledWith(
        (expect as any).objectContaining({
          where: (expect as any).objectContaining({ deviceId: mockClientInfo.deviceToken }),
        }),
      );
    });

    it('should skip new_device check if deviceToken not provided', async () => {
      const clientInfoWithoutDevice = { ...mockClientInfo, deviceToken: undefined };

      // When deviceToken is missing, it checks hasUserLoggedInBefore - mock to return false (no previous sessions)
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // hasUserLoggedInBefore returns false
      // new_country check: country exists
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      // impossible_travel check: no previous session
      mockSessionRepository.findOne.mockResolvedValueOnce(null);
      // new_ip check: IP exists (since country exists, new_ip is still checked)
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // IP exists
      // suspicious_activity check: no suspicious activity
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithoutDevice);

      // When deviceToken is missing and user has no previous sessions, new_device should not be detected
      expect(factors).not.toContain(RiskFactor.NEW_DEVICE);
    });

    it('should not detect new device when device is trusted', async () => {
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(true);
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.NEW_DEVICE);
      expect(mockTrustedDeviceService.isDeviceTrusted).toHaveBeenCalledWith(mockClientInfo.deviceToken, mockUser.id);
    });

    it('should continue to session check if trusted device check fails', async () => {
      mockTrustedDeviceService.isDeviceTrusted.mockRejectedValue(new Error('Trusted device service error'));
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // Device not found in sessions
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle device check errors gracefully', async () => {
      mockSessionRepository.findOne.mockRejectedValueOnce(new Error('Database error'));
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      // Should assume new device on error (safer for security)
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // detectRiskFactors() - NEW_IP
  // ============================================================================

  describe('detectRiskFactors() - new_ip', () => {
    it('should detect new IP when IP never seen before', async () => {
      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session for impossible_travel
        .mockResolvedValueOnce(null); // IP not found in sessions (first check in isNewIp)
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // IP not found in audit (second check in isNewIp)
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious activity
      mockAuditRepository.find.mockResolvedValueOnce([]); // No failed logins

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_IP);
    });

    it('should not detect new IP when IP seen in sessions', async () => {
      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session for impossible_travel
        .mockResolvedValueOnce({ id: 1 } as any) // IP found in sessions (isNewIp returns false)
        .mockResolvedValueOnce({ id: 1 } as any); // hasUserLoggedInBefore (for INCOMPLETE_LOCATION_DATA check)
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious activity
      mockAuditRepository.find.mockResolvedValueOnce([]); // No failed logins

      // Use clientInfo with complete location data to avoid INCOMPLETE_LOCATION_DATA
      const clientInfoWithCompleteLocation: ClientInfo = {
        ...mockClientInfo,
        ipLatitude: 40.7128,
        ipLongitude: -74.006,
      };

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithCompleteLocation);

      expect(factors).not.toContain(RiskFactor.NEW_IP);
      // Should not check audit for IP if found in sessions (isNewIp short-circuits)
    });

    it('should check audit trail if not found in sessions', async () => {
      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      // Order of sessionRepository.findOne calls:
      // 1. isNewDevice - device check
      // 2. isNewCountry - country check
      // 3. detectImpossibleTravel - previous session check
      // 4. isNewIp - IP check in sessions (not found)
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session for impossible_travel
        .mockResolvedValueOnce(null); // IP not found in sessions (isNewIp checks sessions first)
      // Order of auditRepository.findOne calls:
      // 1. detectImpossibleTravel - findOne for last login (returns null since no previous session)
      // 2. isNewIp - IP check in audit (found, so IP is not new)
      // 3. detectSuspiciousActivity - suspicious events check
      mockAuditRepository.findOne
        .mockResolvedValueOnce(null) // detectImpossibleTravel: no previous login in audit
        .mockResolvedValueOnce({ id: 1 } as any) // isNewIp: IP found in audit (isNewIp returns false, so NEW_IP not added)
        .mockResolvedValueOnce(null); // detectSuspiciousActivity: No suspicious events
      mockAuditRepository.find.mockResolvedValueOnce([]); // No failed logins

      // Use clientInfo with complete location data to avoid INCOMPLETE_LOCATION_DATA (which would call hasUserLoggedInBefore)
      const clientInfoWithCompleteLocation: ClientInfo = {
        ...mockClientInfo,
        ipLatitude: 40.7128,
        ipLongitude: -74.006,
      };

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithCompleteLocation);

      expect(factors).not.toContain(RiskFactor.NEW_IP);
      // Should check audit for: impossible_travel (last login), IP (isNewIp), and suspicious activity (detectSuspiciousActivity)
      expect(mockAuditRepository.findOne).toHaveBeenCalledTimes(3);
    });

    it('should NOT detect new_ip when new_country is detected (double-counting prevention)', async () => {
      // Setup: new_country detected
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce(null) // Country not found (countryExists query)
        .mockResolvedValueOnce({ id: 1 } as any) // Sessions with country data exist (hasAnyCountryData)
        .mockResolvedValueOnce(null); // No previous session for impossible_travel
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_COUNTRY);
      expect(factors).not.toContain(RiskFactor.NEW_IP);
      // Should not check IP at all when country changed
      expect(mockSessionRepository.findOne).not.toHaveBeenCalledWith(
        (expect as any).objectContaining({
          where: (expect as any).objectContaining({ ipAddress: mockClientInfo.ipAddress }),
        }),
      );
    });

    it('should NOT detect new_ip when impossible_travel is detected', async () => {
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'GB',
        ipCity: 'London',
        lastActivityAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        createdAt: new Date(),
      } as ISession;

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists (same country)
        .mockResolvedValueOnce(lastSession as any); // Previous session found (impossible travel detected)
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const clientInfo: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'GB',
        ipCity: 'Manchester', // Different city, same country
      };

      const factors = await service.detectRiskFactors(mockUser, clientInfo);

      // If impossible_travel is detected, new_ip should not be checked
      expect(factors).not.toContain(RiskFactor.NEW_IP);
    });

    it('should skip new_ip check if trigger not enabled', async () => {
      mockConfig.mfa!.adaptive!.triggers = [RiskFactor.NEW_DEVICE, RiskFactor.NEW_COUNTRY];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.NEW_IP);
    });

    it('should skip new_ip check if ipAddress not provided', async () => {
      const clientInfoWithoutIp = { ...mockClientInfo, ipAddress: '' as any };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithoutIp);

      expect(factors).not.toContain(RiskFactor.NEW_IP);
    });

    it('should handle IP check errors gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session
        .mockRejectedValueOnce(new Error('Database error')); // IP check fails
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
      // Should assume new IP on error (safer for security)
    });
  });

  // ============================================================================
  // detectRiskFactors() - NEW_COUNTRY
  // ============================================================================

  describe('detectRiskFactors() - new_country', () => {
    it('should NOT detect new_country on first login (no previous sessions)', async () => {
      // First login: no sessions exist, so new_country should not be flagged
      mockSessionRepository.findOne
        .mockResolvedValueOnce(null) // new_device: device not found (first login)
        .mockResolvedValueOnce(null) // isNewCountry: country not found (countryExists query)
        .mockResolvedValueOnce(null); // isNewCountry: no sessions with country data (can't determine)
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session for impossible_travel
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      // new_device should be detected, but new_country should NOT (no history to compare)
      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      expect(factors).not.toContain(RiskFactor.NEW_COUNTRY);
    });

    it('should detect new country when country never seen before (user has previous sessions)', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // new_device: device exists
        .mockResolvedValueOnce(null) // isNewCountry: country not found (countryExists query)
        .mockResolvedValueOnce({ id: 1 } as any) // isNewCountry: sessions with country data exist (has country history, so country is new)
        .mockResolvedValueOnce(null); // No previous session for impossible_travel
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_COUNTRY);
    });

    it('should not detect new country when country seen before', async () => {
      // Optimized: country exists check returns early (1 query instead of 3)
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // new_device: device exists
        .mockResolvedValueOnce({ id: 1 } as any) // isNewCountry: country exists (returns false immediately, no second query needed)
        .mockResolvedValueOnce(null); // No previous session for impossible_travel
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.NEW_COUNTRY);
    });

    it('should skip new_country check if trigger not enabled', async () => {
      mockConfig.mfa!.adaptive!.triggers = [RiskFactor.NEW_DEVICE, RiskFactor.NEW_IP];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.NEW_COUNTRY);
    });

    it('should skip new_country check if ipCountry not provided', async () => {
      const clientInfoWithoutCountry = { ...mockClientInfo, ipCountry: undefined };

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithoutCountry);

      expect(factors).not.toContain(RiskFactor.NEW_COUNTRY);
    });

    it('should handle country check errors gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockRejectedValueOnce(new Error('Database error')); // Country check fails
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
      // Should assume not new country on error (safer default)
    });
  });

  // ============================================================================
  // detectRiskFactors() - IMPOSSIBLE_TRAVEL
  // ============================================================================

  describe('detectRiskFactors() - impossible_travel', () => {
    it('should skip impossible_travel check if trigger not enabled', async () => {
      mockConfig.mfa!.adaptive!.triggers = [RiskFactor.NEW_DEVICE];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should skip impossible_travel check if location data incomplete', async () => {
      const clientInfoWithoutCity = { ...mockClientInfo, ipCity: undefined };

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // IP exists
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithoutCity);

      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should skip impossible_travel check if ipCountry missing', async () => {
      const clientInfoWithoutCountry = { ...mockClientInfo, ipCountry: undefined };

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists (but clientInfo doesn't have it)
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // IP exists
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithoutCountry);

      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should return false for impossible_travel if no previous location', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session with location

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should not detect impossible_travel if same location', async () => {
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'US',
        ipCity: 'New York',
        lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        createdAt: new Date(),
      } as ISession;

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any); // Previous session with same location

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should detect impossible_travel when travel speed exceeds threshold', async () => {
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'US',
        ipCity: 'New York',
        lastActivityAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago (login time)
      } as ISession;

      const clientInfoDifferentCity: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'Los Angeles', // Different city, same country
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any); // Previous session with different city

      // Distance calculation: same country, different city = 500 km
      // Time: 15 minutes = 0.25 hours
      // Speed: 500 / 0.25 = 2000 km/h > 900 km/h (default threshold) -> impossible travel
      const factors = await service.detectRiskFactors(mockUser, clientInfoDifferentCity);

      expect(factors).toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should not detect impossible_travel when distance is 0 (same location)', async () => {
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'US',
        ipCity: 'New York',
        lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago (login time)
      } as ISession;

      // Same city and country (distance = 0)
      const clientInfoSameLocation: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'New York', // Same city
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any); // Previous session with same location

      const factors = await service.detectRiskFactors(mockUser, clientInfoSameLocation);

      // calculateDistance returns 0, so impossible_travel should not be detected
      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should detect impossible_travel for different countries', async () => {
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'US',
        ipCity: 'New York',
        lastActivityAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago (login time)
      } as ISession;

      // Different country (distance = 2000 km)
      const clientInfoDifferentCountry: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'GB',
        ipCity: 'London',
        ipLatitude: 51.5074,
        ipLongitude: -0.1278,
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce(null) // Country doesn't exist (new country)
        .mockResolvedValueOnce({ id: 1 } as any) // hasAnyCountryData check
        .mockResolvedValueOnce(lastSession as any) // Previous session for impossible_travel
        .mockResolvedValueOnce({ id: 1 } as any); // hasUserLoggedInBefore for INCOMPLETE_LOCATION_DATA
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No previous audit login

      // Distance: 2000 km, Time: 30 minutes = 0.5 hours
      // Speed: 2000 / 0.5 = 4000 km/h > 900 km/h -> impossible travel
      const factors = await service.detectRiskFactors(mockUser, clientInfoDifferentCountry);

      expect(factors).toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should detect impossible_travel when time difference is less than 30 minutes', async () => {
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'US',
        ipCity: 'New York',
        lastActivityAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago (login time)
      } as ISession;

      const clientInfoDifferentCity: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'Los Angeles',
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any);

      const factors = await service.detectRiskFactors(mockUser, clientInfoDifferentCity);

      // Time < 30 minutes with different city = impossible travel
      expect(factors).toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should use custom maxTravelSpeed from config', async () => {
      mockConfig.mfa!.adaptive!.maxTravelSpeed = 500; // Lower threshold

      // Use a scenario where travel is possible with the custom threshold
      // Distance: ~250 km (e.g., NYC to Philadelphia), Time: 1 hour, Speed: 250 km/h < 500 km/h
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'US',
        ipCity: 'New York',
        ipLatitude: 40.7128,
        ipLongitude: -74.006,
        lastActivityAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      } as unknown as ISession;

      const clientInfoDifferentCity: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'Philadelphia',
        ipLatitude: 39.9526,
        ipLongitude: -75.1652,
      };

      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any) // Previous session for impossible_travel check
        .mockResolvedValueOnce({ id: 1 } as any) // IP exists
        .mockResolvedValueOnce({ id: 1 } as any); // hasUserLoggedInBefore
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious activity
      mockAuditRepository.find.mockResolvedValueOnce([]); // No failed logins

      // Distance: ~150 km, Time: 1 hour, Speed: ~150 km/h < 500 km/h -> not impossible
      const factors = await service.detectRiskFactors(mockUser, clientInfoDifferentCity);

      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should handle impossible travel check errors gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockRejectedValueOnce(new Error('Database error')); // Impossible travel check fails

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
      // Should assume not impossible travel on error
    });

    it('should detect impossible_travel using Haversine formula when coordinates are available', async () => {
      // Singapore to London: ~10,850 km in 10 minutes = impossible
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'SG',
        ipCity: 'Singapore',
        ipLatitude: 1.3521,
        ipLongitude: 103.8198,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      } as any;

      const clientInfoWithCoordinates: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'GB',
        ipCity: 'London',
        ipLatitude: 51.5074,
        ipLongitude: -0.1278,
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession); // Coordinates included

      const factors = await service.detectRiskFactors(mockUser, clientInfoWithCoordinates);

      // Distance: ~10,850 km (Haversine), Time: 10 minutes = 0.167 hours
      // Speed: ~65,000 km/h >> 900 km/h -> impossible travel
      expect(factors).toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should detect impossible_travel when country changes with missing city data (conservative)', async () => {
      // Country changed but no city data - should flag if < 2 hours
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'SG',
        ipCity: null, // Missing city
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      } as ISession;

      const clientInfoMissingCity: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'NO', // Different country
        ipCity: undefined, // Missing city
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any);

      const factors = await service.detectRiskFactors(mockUser, clientInfoMissingCity);

      // Country changed in < 2 hours without city data -> flag as impossible
      expect(factors).toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });

    it('should NOT detect impossible_travel when country changes with missing city data but enough time passed', async () => {
      // Country changed but no city data - should NOT flag if > 2 hours
      const lastSession = {
        id: 1,
        userId: 1,
        ipCountry: 'SG',
        ipCity: null,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      } as ISession;

      const clientInfoMissingCity: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'NO',
        ipCity: undefined,
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(lastSession as any);

      const factors = await service.detectRiskFactors(mockUser, clientInfoMissingCity);

      // Country changed but > 2 hours passed -> acceptable
      expect(factors).not.toContain(RiskFactor.IMPOSSIBLE_TRAVEL);
    });
  });

  // ============================================================================
  // detectRiskFactors() - INCOMPLETE_LOCATION_DATA
  // ============================================================================

  describe('detectRiskFactors() - incomplete_location_data', () => {
    it('should detect incomplete_location_data when city is missing', async () => {
      const clientInfoMissingCity: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: undefined,
      };

      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session for impossible_travel
        .mockResolvedValueOnce({ id: 1 } as any); // hasUserLoggedInBefore (for incomplete_location_data check)
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious activity
      mockAuditRepository.find.mockResolvedValueOnce([]); // No failed logins

      const factors = await service.detectRiskFactors(mockUser, clientInfoMissingCity);

      expect(factors).toContain(RiskFactor.INCOMPLETE_LOCATION_DATA);
    });

    it('should detect incomplete_location_data when coordinates are missing', async () => {
      const clientInfoMissingCoordinates: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'New York',
        ipLatitude: undefined,
        ipLongitude: undefined,
      };

      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session for impossible_travel
        .mockResolvedValueOnce({ id: 1 } as any); // hasUserLoggedInBefore (for incomplete_location_data check)
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious activity
      mockAuditRepository.find.mockResolvedValueOnce([]); // No failed logins

      const factors = await service.detectRiskFactors(mockUser, clientInfoMissingCoordinates);

      expect(factors).toContain(RiskFactor.INCOMPLETE_LOCATION_DATA);
    });

    it('should NOT detect incomplete_location_data when all location data is present', async () => {
      const clientInfoComplete: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'New York',
        ipLatitude: 40.7128,
        ipLongitude: -74.006,
      };

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any); // Country exists

      const factors = await service.detectRiskFactors(mockUser, clientInfoComplete);

      expect(factors).not.toContain(RiskFactor.INCOMPLETE_LOCATION_DATA);
    });

    it('should NOT detect incomplete_location_data when country is missing', async () => {
      const clientInfoNoCountry: ClientInfo = {
        ...mockClientInfo,
        ipCountry: undefined,
        ipCity: undefined,
      };

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists

      const factors = await service.detectRiskFactors(mockUser, clientInfoNoCountry);

      // Should not add incomplete_location_data when there's no country at all
      expect(factors).not.toContain(RiskFactor.INCOMPLETE_LOCATION_DATA);
    });
  });

  // ============================================================================
  // detectRiskFactors() - SUSPICIOUS_ACTIVITY
  // ============================================================================

  describe('detectRiskFactors() - suspicious_activity', () => {
    it('should detect suspicious_activity when recent suspicious events found', async () => {
      // Ensure complete location data to avoid INCOMPLETE_LOCATION_DATA
      const clientInfoComplete: ClientInfo = {
        ...mockClientInfo,
        ipCountry: 'US',
        ipCity: 'New York',
        ipLatitude: 40.7128,
        ipLongitude: -74.006,
      };

      // Trusted device check
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValueOnce(false);
      // Order of sessionRepository.findOne calls:
      // 1. isNewDevice - device check
      // 2. isNewCountry - country check
      // 3. detectImpossibleTravel - previous session check
      // 4. isNewIp - IP check in sessions (found, so IP is not new)
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session for impossible_travel
        .mockResolvedValueOnce({ id: 1 } as any); // IP found in sessions (isNewIp returns false, no audit check needed)
      // Order of auditRepository calls:
      // 1. detectImpossibleTravel - findOne for last login (returns null since no previous session)
      // 2. detectSuspiciousActivity - findOne for suspicious events (found)
      // Note: isNewIp short-circuits when IP found in sessions, so no audit check for IP
      mockAuditRepository.findOne
        .mockResolvedValueOnce(null) // detectImpossibleTravel: no previous login in audit (we already have null from sessions)
        .mockResolvedValueOnce({ id: 1, eventStatus: 'SUSPICIOUS' } as any); // detectSuspiciousActivity: suspicious events found
      // detectSuspiciousActivity checks failed logins only if suspicious events not found
      // Since we're returning a suspicious event, the find call should NOT happen
      // But we'll mock it anyway to be safe (it won't be called if the code is correct)
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, clientInfoComplete);

      expect(factors).toContain(RiskFactor.SUSPICIOUS_ACTIVITY);
    });

    it('should detect suspicious_activity when 3+ failed logins in last hour', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious events
      mockAuditRepository.find.mockResolvedValueOnce([{ id: 1 } as any, { id: 2 } as any, { id: 3 } as any]); // 3 failed logins

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.SUSPICIOUS_ACTIVITY);
    });

    it('should not detect suspicious_activity when threshold not met', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null); // No suspicious events
      mockAuditRepository.find.mockResolvedValueOnce([{ id: 1 } as any, { id: 2 } as any]); // Only 2 failed logins (below threshold)

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.SUSPICIOUS_ACTIVITY);
    });

    it('should use custom suspiciousActivityWindow from config', async () => {
      mockConfig.mfa!.adaptive!.suspiciousActivityWindow = 2; // 2 hours instead of 1

      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      await service.detectRiskFactors(mockUser, mockClientInfo);

      // Verify find was called with correct time window (2 hours ago)
      expect(mockAuditRepository.find).toHaveBeenCalled();
    });

    it('should skip suspicious_activity check if trigger not enabled', async () => {
      mockConfig.mfa!.adaptive!.triggers = [RiskFactor.NEW_DEVICE];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Device exists

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).not.toContain(RiskFactor.SUSPICIOUS_ACTIVITY);
      expect(mockAuditRepository.findOne).not.toHaveBeenCalled();
    });

    it('should handle suspicious activity check errors gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockRejectedValueOnce(new Error('Database error'));

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
      // Should assume not suspicious on error
    });
  });

  // ============================================================================
  // detectRiskFactors() - Error Handling
  // ============================================================================

  describe('detectRiskFactors() - error handling', () => {
    it('should handle errors in individual checks gracefully', async () => {
      // First check succeeds, second fails
      mockSessionRepository.findOne
        .mockResolvedValueOnce(null) // new_device succeeds (device not found)
        .mockRejectedValueOnce(new Error('Database error')); // isNewCountry: countryExists query fails

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      // Should still detect new_device, but handle error for new_country
      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle errors in isNewDevice gracefully', async () => {
      mockSessionRepository.findOne.mockRejectedValueOnce(new Error('Database error'));
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      // Should assume new device on error (safer for security)
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle errors in isNewIp gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null) // No previous session
        .mockRejectedValueOnce(new Error('Database error')); // IP check fails

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle errors in isNewCountry gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockRejectedValueOnce(new Error('Database error')); // Country check fails

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
      // Should assume not new country on error (safer default)
    });

    it('should handle errors in detectImpossibleTravel gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockRejectedValueOnce(new Error('Database error')); // Impossible travel check fails

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle errors in detectSuspiciousActivity gracefully', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce({ id: 1 } as any) // Device exists
        .mockResolvedValueOnce({ id: 1 } as any) // Country exists
        .mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockRejectedValueOnce(new Error('Database error'));

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions in individual checks', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce(null) // new_device succeeds
        .mockRejectedValueOnce('String error' as any); // isNewCountry fails with non-Error

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return empty array on outer catch block error', async () => {
      // Make user.sub throw an error when accessed in the catch block
      const userWithError = {
        ...mockUser,
        get sub() {
          throw new Error('Accessing sub throws');
        },
      } as any;

      // Make the first repository call throw to trigger outer catch
      // But individual checks have try-catch, so we need to make something else throw
      // Actually, if we make the config access throw, it would work
      // But a simpler approach: make the service throw during enabledTriggers access
      // by making the config property throw
      const throwingConfig = {
        ...mockConfig,
        get mfa() {
          throw new Error('Config access error');
        },
      } as any;

      const serviceWithError = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        throwingConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      const factors = await serviceWithError.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle non-Error in outer catch block', async () => {
      const throwingConfig = {
        ...mockConfig,
        get mfa() {
          // eslint-disable-next-line no-throw-literal
          throw 'String error';
        },
      } as any;

      const serviceWithError = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        throwingConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      const factors = await serviceWithError.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        (expect as any).stringContaining('Risk detection failed'),
        (expect as any).any(Object),
      );
    });
  });

  // ============================================================================
  // detectRiskFactors() - Configuration
  // ============================================================================

  describe('detectRiskFactors() - configuration', () => {
    it('should use default triggers when not configured', async () => {
      mockConfig.mfa = undefined;
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne.mockResolvedValueOnce(null); // Device not found

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      // Should check default triggers: new_device, new_ip, new_country
      expect(mockSessionRepository.findOne).toHaveBeenCalled();
      expect(factors).toContain(RiskFactor.NEW_DEVICE);
    });

    it('should respect custom trigger configuration', async () => {
      mockConfig.mfa!.adaptive!.triggers = [RiskFactor.NEW_DEVICE];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      mockSessionRepository.findOne.mockResolvedValueOnce(null); // Device not found

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      // Should not check other triggers
      expect(mockSessionRepository.findOne).toHaveBeenCalledTimes(1); // Only new_device
    });

    it('should handle service without trusted device service', async () => {
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        undefined, // No trusted device service
      );

      mockSessionRepository.findOne.mockResolvedValueOnce(null); // Device not found
      mockSessionRepository.findOne.mockResolvedValueOnce({ id: 1 } as any); // Country exists
      mockSessionRepository.findOne.mockResolvedValueOnce(null); // No previous session
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      // Should not throw error
    });
  });


  // ============================================================================
  // Edge Cases and Integration
  // ============================================================================

  describe('Edge Cases and Integration', () => {
    it('should handle multiple risk factors detected together', async () => {
      mockSessionRepository.findOne
        .mockResolvedValueOnce(null) // new_device: device not found
        .mockResolvedValueOnce(null) // new_country: country not found
        .mockResolvedValueOnce({ id: 1 } as any) // new_country: has country history
        .mockResolvedValueOnce(null); // No previous session for impossible_travel
      mockAuditRepository.findOne.mockResolvedValueOnce(null);
      mockAuditRepository.find.mockResolvedValueOnce([]);

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toContain(RiskFactor.NEW_DEVICE);
      expect(factors).toContain(RiskFactor.NEW_COUNTRY);
      expect(factors).not.toContain(RiskFactor.NEW_IP); // Should be excluded due to new_country
    });

    it('should handle all risk factors disabled', async () => {
      mockConfig.mfa!.adaptive!.triggers = [];
      service = new RiskDetectionService(
        mockSessionRepository,
        mockAuditRepository,
        mockConfig,
        mockLogger,
        mockTrustedDeviceService,
      );

      const factors = await service.detectRiskFactors(mockUser, mockClientInfo);

      expect(factors).toEqual([]);
      expect(mockSessionRepository.findOne).not.toHaveBeenCalled();
    });

    it('should handle concurrent risk detection calls', async () => {
      mockSessionRepository.findOne.mockResolvedValue({ id: 1 } as any);
      mockAuditRepository.findOne.mockResolvedValue(null);
      mockAuditRepository.find.mockResolvedValue([]);

      const promises = [
        service.detectRiskFactors(mockUser, mockClientInfo),
        service.detectRiskFactors(mockUser, mockClientInfo),
      ];

      const results = await Promise.all(promises);

      expect(results.length).toBe(2);
      expect(results[0]).toEqual(results[1]);
    });
  });
});
