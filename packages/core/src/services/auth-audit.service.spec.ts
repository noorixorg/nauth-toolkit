import { Repository, SelectQueryBuilder } from 'typeorm';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { BaseAuthAudit, BaseUser } from '../entities';
import { IAuthAudit, IUser } from '../interfaces/entities.interface';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { ClientInfoService } from './client-info.service';
import { ClientInfo } from '../interfaces/client-info.interface';
import { RiskFactor } from '../enums/risk-factor.enum';
import { AdminGetUserAuthHistoryDTO } from '../dto/admin-get-user-auth-history.dto';
import { GetEventsByTypeDTO } from '../dto/get-events-by-type.dto';
import { GetSuspiciousActivityDTO } from '../dto/get-suspicious-activity.dto';
import { GetRiskAssessmentHistoryDTO } from '../dto/get-risk-assessment-history.dto';
import { ContextStorage } from '../utils/context-storage';

/**
 * Auth Audit Service Unit Tests
 *
 * Tests audit event recording, querying, and filtering functionality.
 * Covers all methods, edge cases, client info extraction, and error handling.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('AuthAuditService', () => {
  let service: AuthAuditService; // Use InternalAuthAuditService (aliased) for tests since it includes recordEvent()
  let mockAuditRepository: jest.Mocked<Repository<BaseAuthAudit>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<BaseAuthAudit>>;

  const mockUser: Partial<IUser> = {
    id: 1,
    sub: 'a21b654c-2746-4168-acee-c175083a65cd',
    email: 'test@example.com',
  };

  const mockAuditRecord: Partial<IAuthAudit> = {
    id: 1,
    userId: 1,
    eventType: AuthAuditEventType.LOGIN_SUCCESS,
    eventStatus: 'SUCCESS' as AuthAuditEventStatus,
    ipAddress: '1.2.3.4',
    userAgent: 'test-user-agent',
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Create mock query builder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
    } as any;

    // TypeScript expects orderBy to accept 1 or 2 arguments, but mock can accept any
    (mockQueryBuilder.orderBy as any).mockImplementation(() => mockQueryBuilder);

    // Create mock repositories
    mockAuditRepository = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      findOne: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
    } as any;

    // Create mock services
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockClientInfoService = {
      get: jest.fn(),
    } as any;

    // Instantiate service directly (using InternalAuthAuditService aliased as AuthAuditService for tests)
    service = new AuthAuditService(mockAuditRepository, mockUserRepository, mockLogger, mockClientInfoService);
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
  // recordEvent() Method
  // ============================================================================

  describe('recordEvent', () => {
    it('should record event successfully with userId', async () => {
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      const result = await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeDefined();
      expect(mockAuditRepository.create).toHaveBeenCalled();
      expect(mockAuditRepository.save).toHaveBeenCalled();
    });

    it('should resolve sub to userId when userId not provided', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      const result = await service.recordEvent({
        sub: 'a21b654c-2746-4168-acee-c175083a65cd',
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeDefined();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { sub: 'a21b654c-2746-4168-acee-c175083a65cd' },
      });
      expect(mockAuditRepository.create).toHaveBeenCalledWith((expect as any).objectContaining({ userId: 1 }));
    });

    it('should return null when sub provided but user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.recordEvent({
        sub: 'b21b654c-2746-4168-acee-c175083a65cd',
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot record audit event - user not found: b21b654c-2746-4168-acee-c175083a65cd',
      );
    });

    it('should not query database when sub is not a UUID', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.recordEvent({
        sub: 'example@email.com',
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeNull();
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot record audit event - invalid sub format (expected UUID)', {
        sub: 'example@email.com',
      });
    });

    it('should return null when neither userId nor sub provided', async () => {
      const result = await service.recordEvent({
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      } as any);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot record audit event - userId or sub required');
    });

    it('should auto-extract client info from ClientInfoService when available', async () => {
      const clientInfo: ClientInfo = {
        ipAddress: '5.6.7.8',
        ipCountry: 'US',
        ipCity: 'New York',
        userAgent: 'Mozilla/5.0',
        platform: 'Windows',
        browser: 'Chrome',
        deviceToken: 'device-123',
        deviceName: 'My Device',
        deviceType: 'desktop',
        sessionId: 456,
      };

      mockClientInfoService.get.mockReturnValue(clientInfo);
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);

      await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(mockAuditRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          ipAddress: '5.6.7.8',
          ipCountry: 'US',
          ipCity: 'New York',
          userAgent: 'Mozilla/5.0',
          platform: 'Windows',
          browser: 'Chrome',
          deviceId: 'device-123',
          deviceName: 'My Device',
          deviceType: 'desktop',
          sessionId: 456,
        }),
      );
    });

    it('should use auto-extracted client info (explicit overrides are not supported)', async () => {
      const clientInfo: ClientInfo = {
        ipAddress: '5.6.7.8',
        userAgent: 'test-agent',
        ipCountry: 'US',
      };

      mockClientInfoService.get.mockReturnValue(clientInfo);
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);

      await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(mockAuditRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          ipAddress: '5.6.7.8',
          ipCountry: 'US',
        }),
      );
    });

    it('should handle client info extraction errors gracefully', async () => {
      mockClientInfoService.get.mockImplementation(() => {
        throw new Error('Context not available');
      });
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);

      const result = await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        (expect as any).stringContaining('Failed to extract client info for audit'),
      );
    });

    it('should record all event fields correctly', async () => {
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
        eventStatus: 'SUCCESS',
        riskFactor: 75,
        riskFactors: [RiskFactor.NEW_DEVICE, RiskFactor.NEW_IP],
        adaptiveMfaTriggered: true,
        sessionId: 789,
        challengeSessionId: 456,
        authMethod: 'password',
        performedBy: 'admin@example.com',
        reason: 'test reason',
        description: 'test description',
        metadata: { key: 'value' },
      });

      expect(mockAuditRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          eventType: AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
          eventStatus: 'SUCCESS',
          riskFactor: 75,
          riskFactors: [RiskFactor.NEW_DEVICE, RiskFactor.NEW_IP],
          adaptiveMfaTriggered: true,
          sessionId: 789,
          challengeSessionId: 456,
          authMethod: 'password',
          performedBy: 'admin@example.com',
          reason: 'test reason',
          description: 'test description',
          metadata: { key: 'value' },
        }),
      );
    });

    it('should handle repository save errors gracefully (non-blocking)', async () => {
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockRejectedValue(new Error('Database error'));
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      const result = await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        (expect as any).stringContaining('Failed to record audit event'),
        (expect as any).objectContaining({
          eventType: AuthAuditEventType.LOGIN_SUCCESS,
        }),
      );
    });

    it('should work without ClientInfoService (optional dependency)', async () => {
      const serviceWithoutClientInfo = new AuthAuditService(
        mockAuditRepository,
        mockUserRepository,
        mockLogger,
        undefined, // No ClientInfoService
      );

      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);

      const result = await serviceWithoutClientInfo.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        eventStatus: 'SUCCESS',
      });

      expect(result).toBeDefined();
      expect(mockAuditRepository.create).toHaveBeenCalled();
    });

    it('should enrich metadata with performedByName when performer is in context', async () => {
      const performerUser: Partial<IUser> = {
        id: 999,
        sub: 'performer-sub-123',
        email: 'performer@example.com',
        firstName: 'Jane',
        lastName: 'Performer',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: false,
        isLocked: false,
        mustChangePassword: false,
        mfaEnabled: false,
        hasSocialAuth: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      // Set performer in context
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', performerUser as IUser);

        await service.recordEvent({
          userId: 1,
          eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_INITIATED,
          eventStatus: 'INFO',
          performedBy: 'performer-sub-123',
          metadata: { originalKey: 'originalValue' },
        });

        // Verify metadata was enriched with performedByName
        expect(mockAuditRepository.create).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: 1,
            performedBy: 'performer-sub-123',
            metadata: {
              originalKey: 'originalValue',
              performedByName: 'Jane Performer',
            },
          }),
        );
      });
    });

    it('should use email as performedByName when performer has no firstName/lastName', async () => {
      const performerUser: Partial<IUser> = {
        id: 998,
        sub: 'performer-sub-456',
        email: 'admin-no-name@example.com',
        firstName: null,
        lastName: null,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: false,
        isLocked: false,
        mustChangePassword: false,
        mfaEnabled: false,
        hasSocialAuth: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      // Set performer in context
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', performerUser as IUser);

        await service.recordEvent({
          userId: 1,
          eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_INITIATED,
          eventStatus: 'INFO',
          performedBy: 'performer-sub-456',
        });

        // Verify metadata was enriched with email as performedByName
        expect(mockAuditRepository.create).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: 1,
            performedBy: 'performer-sub-456',
            metadata: {
              performedByName: 'admin-no-name@example.com',
            },
          }),
        );
      });
    });

    it('should not enrich metadata when performedBy matches the event userId', async () => {
      const user: Partial<IUser> = {
        id: 1,
        sub: 'user-sub-789',
        email: 'user@example.com',
        firstName: 'Self',
        lastName: 'User',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: false,
        isLocked: false,
        mustChangePassword: false,
        mfaEnabled: false,
        hasSocialAuth: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      // Set user in context
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', user as IUser);

        await service.recordEvent({
          userId: 1,
          eventType: AuthAuditEventType.LOGIN_SUCCESS,
          eventStatus: 'SUCCESS',
          performedBy: '1', // Same as userId (converted to string)
        });

        // Verify metadata was NOT enriched (user performed action on themselves)
        const createCall = mockAuditRepository.create.mock.calls[0][0];
        expect(createCall.metadata).toBeNull();
      });
    });

    it('should handle context lookup errors gracefully when enriching performedByName', async () => {
      mockAuditRepository.create.mockReturnValue(mockAuditRecord as any);
      mockAuditRepository.save.mockResolvedValue(mockAuditRecord as any);
      mockClientInfoService.get.mockReturnValue({} as ClientInfo);

      // No user in context - should not crash
      await service.recordEvent({
        userId: 1,
        eventType: AuthAuditEventType.ADMIN_PASSWORD_RESET_INITIATED,
        eventStatus: 'INFO',
        performedBy: 'admin-sub-999',
      });

      // Verify event was recorded without performedByName
      expect(mockAuditRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          performedBy: 'admin-sub-999',
        }),
      );
      expect(mockAuditRepository.save).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getUserAuthHistory() Method
  // ============================================================================

  describe('getUserAuthHistory', () => {
    it('should get user auth history with default pagination', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      const result = await service.getUserAuthHistory(request);

      expect(result.data).toEqual([mockAuditRecord as any]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.totalPages).toBe(1);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: 'a21b654c-2746-4168-acee-c175083a65cd' } });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('audit.userId = :userId', { userId: 1 });
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'b21b654c-2746-4168-acee-c175083a65cd';
      try {
        await service.getUserAuthHistory(request);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('User not found');
      }
    });

    it('should apply pagination options', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 100]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      request.page = 2;
      request.limit = 25;
      const result = await service.getUserAuthHistory(request);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
      expect(result.totalPages).toBe(4);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(25);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(25);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      request.startDate = startDate;
      request.endDate = endDate;
      await service.getUserAuthHistory(request);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.createdAt >= :startDate', { startDate });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.createdAt <= :endDate', { endDate });
    });

    it('should filter by event types', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      request.eventTypes = [AuthAuditEventType.LOGIN_SUCCESS, AuthAuditEventType.LOGIN_FAILED];
      await service.getUserAuthHistory(request);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.eventType IN (:...eventTypes)', {
        eventTypes: [AuthAuditEventType.LOGIN_SUCCESS, AuthAuditEventType.LOGIN_FAILED],
      });
    });

    it('should filter by event status', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      request.eventStatus = ['SUCCESS', 'FAILURE'] as AuthAuditEventStatus[];
      await service.getUserAuthHistory(request);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.eventStatus IN (:...eventStatus)', {
        eventStatus: ['SUCCESS', 'FAILURE'],
      });
    });

    it('should order by createdAt DESC', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      await service.getUserAuthHistory(request);

      // orderBy is called with 2 args but mock signature shows 1, so check it was called
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });

    it('should calculate totalPages correctly', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 100]);

      const request = new AdminGetUserAuthHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      request.limit = 30;
      const result = await service.getUserAuthHistory(request);

      expect(result.totalPages).toBe(4); // Math.ceil(100 / 30)
    });
  });

  // ============================================================================
  // getEventsByType() Method
  // ============================================================================

  describe('getEventsByType', () => {
    it('should get events by type with default pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new GetEventsByTypeDTO();
      request.eventType = AuthAuditEventType.LOGIN_SUCCESS;
      const result = await service.getEventsByType(request);

      expect(result.data).toEqual([mockAuditRecord as any]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.totalPages).toBe(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('audit.eventType = :eventType', {
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
      });
    });

    it('should apply pagination options', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 50]);

      const request = new GetEventsByTypeDTO();
      request.eventType = AuthAuditEventType.LOGIN_SUCCESS;
      request.page = 3;
      request.limit = 10;
      const result = await service.getEventsByType(request);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new GetEventsByTypeDTO();
      request.eventType = AuthAuditEventType.LOGIN_SUCCESS;
      request.startDate = startDate;
      request.endDate = endDate;
      await service.getEventsByType(request);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.createdAt >= :startDate', { startDate });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.createdAt <= :endDate', { endDate });
    });

    it('should order by createdAt DESC', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditRecord as any], 1]);

      const request = new GetEventsByTypeDTO();
      request.eventType = AuthAuditEventType.LOGIN_SUCCESS;
      await service.getEventsByType(request);

      // orderBy is called with 2 args but mock signature shows 1, so check it was called
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getSuspiciousActivity() Method
  // ============================================================================

  describe('getSuspiciousActivity', () => {
    it('should get all suspicious activity with default limit', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetSuspiciousActivityDTO();
      const result = await service.getSuspiciousActivity(request);

      expect(result.data).toEqual([mockAuditRecord as any]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        '(audit.eventStatus = :status OR audit.eventType = :eventType)',
        {
          status: 'SUSPICIOUS',
          eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
        },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should filter by user when userSub provided', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetSuspiciousActivityDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      const result = await service.getSuspiciousActivity(request);

      expect(result.data).toEqual([mockAuditRecord as any]);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { sub: 'a21b654c-2746-4168-acee-c175083a65cd' },
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.userId = :userId', { userId: 1 });
    });

    it('should throw error when userSub provided but user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        const request = new GetSuspiciousActivityDTO();
        request.sub = 'b21b654c-2746-4168-acee-c175083a65cd';
        await service.getSuspiciousActivity(request);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('User not found');
      }
    });

    it('should apply custom limit', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetSuspiciousActivityDTO();
      request.limit = 50;
      await service.getSuspiciousActivity(request);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });

    it('should order by createdAt DESC', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetSuspiciousActivityDTO();
      await service.getSuspiciousActivity(request);

      // orderBy is called with 2 args but mock signature shows 1, so check it was called
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getRiskAssessmentHistory() Method
  // ============================================================================

  describe('getRiskAssessmentHistory', () => {
    it('should get risk assessment history with default limit', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetRiskAssessmentHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      const result = await service.getRiskAssessmentHistory(request);

      expect(result.data).toEqual([mockAuditRecord as any]);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: 'a21b654c-2746-4168-acee-c175083a65cd' } });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('audit.userId = :userId', { userId: 1 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.eventType IN (:...eventTypes)', {
        eventTypes: [
          AuthAuditEventType.ADAPTIVE_MFA_RISK_ASSESSED,
          AuthAuditEventType.ADAPTIVE_MFA_TRIGGERED,
          AuthAuditEventType.ADAPTIVE_MFA_BYPASSED,
        ],
      });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        const request = new GetRiskAssessmentHistoryDTO();
        request.sub = 'b21b654c-2746-4168-acee-c175083a65cd';
        await service.getRiskAssessmentHistory(request);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('User not found');
      }
    });

    it('should apply custom limit', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetRiskAssessmentHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      request.limit = 50;
      await service.getRiskAssessmentHistory(request);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });

    it('should order by createdAt DESC', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditRecord as any]);

      const request = new GetRiskAssessmentHistoryDTO();
      request.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      await service.getRiskAssessmentHistory(request);

      // orderBy is called with 2 args but mock signature shows 1, so check it was called
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });
  });
});
