import { Repository } from 'typeorm';
import { BaseAuthAudit, BaseUser } from '../entities';
import { IAuthAudit, IUser } from '../interfaces/entities.interface';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ClientInfoService } from './client-info.service';
import { RiskFactor } from '../enums/risk-factor.enum';
import { GetUserAuthHistoryDTO, GetUserAuthHistoryResponseDTO } from '../dto/get-user-auth-history.dto';
import { GetEventsByTypeDTO, GetEventsByTypeResponseDTO } from '../dto/get-events-by-type.dto';
import { GetSuspiciousActivityDTO, GetSuspiciousActivityResponseDTO } from '../dto/get-suspicious-activity.dto';
import {
  GetRiskAssessmentHistoryDTO,
  GetRiskAssessmentHistoryResponseDTO,
} from '../dto/get-risk-assessment-history.dto';

/**
 * DTO for creating audit events
 *
 * @internal
 * This DTO is only used by InternalAuthAuditService and should not be exposed
 * to consumer applications.
 */
export interface CreateAuthAuditEventDTO {
  userId?: number; // Internal user ID (preferred)
  userSub?: string; // External user identifier (will lookup userId)
  eventType: AuthAuditEventType;
  eventStatus: AuthAuditEventStatus;
  riskFactor?: number | null;
  riskFactors?: RiskFactor[] | null;
  adaptiveMfaTriggered?: boolean | null;
  ipAddress?: string | null;
  ipCountry?: string | null;
  ipCity?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  browser?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  sessionId?: number | null;
  challengeSessionId?: number | null;
  authMethod?: string | null;
  performedBy?: string | null;
  reason?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Authentication Audit Service (Base Class - Public API)
 *
 * Manages audit trail queries for authentication and security events.
 * Provides query capabilities for retrieving audit history.
 *
 * **Key Features:**
 * - Efficient queries using userId (internal integer ID)
 * - Pagination support for large datasets
 * - Query filtering by event type, status, date ranges
 * - User history queries (resolves userSub to userId automatically)
 *
 * **Design Notes:**
 * - Only stores `userId` (integer) - no userSub duplication
 * - All methods accepting userSub resolve to userId before querying
 * - Risk tracking fields are infrastructure for future adaptive MFA (no business logic)
 *
 * **Note:** This is the public API class. Event recording is handled internally
 * by `InternalAuthAuditService` and is not exposed to consumer applications.
 *
 * @example
 * ```typescript
 * // Get user history (accepts userSub, resolves to userId)
 * const history = await auditService.getUserAuthHistory({
 *   userSub: 'user-uuid',
 *   page: 1,
 *   limit: 50,
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
export class AuthAuditService {
  constructor(
    protected readonly auditRepository: Repository<BaseAuthAudit>,
    protected readonly userRepository: Repository<BaseUser>,
    protected readonly logger: NAuthLogger,
    protected readonly clientInfoService?: ClientInfoService,
  ) {}

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get paginated authentication history for a user
   *
   * Accepts userSub (external identifier) and resolves to userId for efficient queries.
   * Supports filtering by event types, status, and date ranges.
   *
   * @param request - Request DTO containing userSub and filtering options
   * @returns Response DTO with paginated audit records
   * @throws {NAuthException} If user not found
   *
   * @example
   * ```typescript
   * const history = await auditService.getUserAuthHistory({
   *   userSub: 'user-uuid',
   *   page: 1,
   *   limit: 50,
   *   eventTypes: [AuthAuditEventType.LOGIN_SUCCESS, AuthAuditEventType.LOGIN_FAILED],
   *   startDate: new Date('2025-01-01'),
   * });
   * ```
   */
  async getUserAuthHistory(request: GetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO> {
    // Resolve userSub to userId
    const user = (await this.userRepository.findOne({ where: { sub: request.userSub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const page = request.page || 1;
    const limit = request.limit || 50;
    const skip = (page - 1) * limit;

    // Build query
    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.userId = :userId', { userId: user.id });

    // Date range filter
    if (request.startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate: request.startDate });
    }
    if (request.endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate: request.endDate });
    }

    // Event type filter
    if (request.eventTypes && request.eventTypes.length > 0) {
      queryBuilder.andWhere('audit.eventType IN (:...eventTypes)', { eventTypes: request.eventTypes });
    }

    // Event status filter
    if (request.eventStatus && request.eventStatus.length > 0) {
      queryBuilder.andWhere('audit.eventStatus IN (:...eventStatus)', { eventStatus: request.eventStatus });
    }

    // Order by date (newest first)
    queryBuilder.orderBy('audit.createdAt', 'DESC');

    // Pagination
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const response = new GetUserAuthHistoryResponseDTO();
    response.data = data as unknown as IAuthAudit[];
    response.total = total;
    response.page = page;
    response.limit = limit;
    response.totalPages = Math.ceil(total / limit);

    return response;
  }

  /**
   * Get events by type with pagination
   *
   * @param request - Request DTO containing eventType and pagination options
   * @returns Response DTO with paginated audit records
   *
   * @example
   * ```typescript
   * const events = await auditService.getEventsByType({
   *   eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
   *   page: 1,
   *   limit: 100,
   * });
   * ```
   */
  async getEventsByType(request: GetEventsByTypeDTO): Promise<GetEventsByTypeResponseDTO> {
    const page = request.page || 1;
    const limit = request.limit || 50;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditRepository.createQueryBuilder('audit').where('audit.eventType = :eventType', {
      eventType: request.eventType,
    });

    // Date range filter
    if (request.startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate: request.startDate });
    }
    if (request.endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate: request.endDate });
    }

    queryBuilder.orderBy('audit.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const response = new GetEventsByTypeResponseDTO();
    response.data = data as unknown as IAuthAudit[];
    response.total = total;
    response.page = page;
    response.limit = limit;
    response.totalPages = Math.ceil(total / limit);

    return response;
  }

  /**
   * Get suspicious activity events
   *
   * Returns events with SUSPICIOUS status or SUSPICIOUS_ACTIVITY event type.
   *
   * @param request - Request DTO containing optional userSub and limit
   * @returns Response DTO with array of suspicious audit events
   *
   * @example
   * ```typescript
   * // Get all suspicious activity
   * const suspicious = await auditService.getSuspiciousActivity({});
   *
   * // Get suspicious activity for specific user
   * const userSuspicious = await auditService.getSuspiciousActivity({
   *   userSub: 'user-uuid',
   *   limit: 50,
   * });
   * ```
   */
  async getSuspiciousActivity(request: GetSuspiciousActivityDTO): Promise<GetSuspiciousActivityResponseDTO> {
    const limit = request.limit || 100;

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .where('(audit.eventStatus = :status OR audit.eventType = :eventType)', {
        status: 'SUSPICIOUS',
        eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
      });

    // Filter by user if provided
    if (request.userSub) {
      const user = (await this.userRepository.findOne({ where: { sub: request.userSub } })) as IUser | null;
      if (!user) {
        throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
      }
      queryBuilder.andWhere('audit.userId = :userId', { userId: user.id });
    }

    queryBuilder.orderBy('audit.createdAt', 'DESC').take(limit);

    const data = await queryBuilder.getMany();

    const response = new GetSuspiciousActivityResponseDTO();
    response.data = data as unknown as IAuthAudit[];

    return response;
  }

  /**
   * Get risk assessment history for adaptive MFA analysis
   *
   * Returns events where risk assessment was performed (ADAPTIVE_MFA_RISK_ASSESSED,
   * ADAPTIVE_MFA_TRIGGERED, ADAPTIVE_MFA_BYPASSED).
   *
   * @param request - Request DTO containing userSub and limit
   * @returns Response DTO with array of risk assessment audit events
   * @throws {NAuthException} If user not found
   *
   * @example
   * ```typescript
   * const riskHistory = await auditService.getRiskAssessmentHistory({
   *   userSub: 'user-uuid',
   *   limit: 50,
   * });
   * ```
   */
  async getRiskAssessmentHistory(request: GetRiskAssessmentHistoryDTO): Promise<GetRiskAssessmentHistoryResponseDTO> {
    const limit = request.limit || 100;

    // Resolve userSub to userId
    const user = (await this.userRepository.findOne({ where: { sub: request.userSub } })) as IUser | null;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.userId = :userId', { userId: user.id })
      .andWhere('audit.eventType IN (:...eventTypes)', {
        eventTypes: [
          AuthAuditEventType.ADAPTIVE_MFA_RISK_ASSESSED,
          AuthAuditEventType.ADAPTIVE_MFA_TRIGGERED,
          AuthAuditEventType.ADAPTIVE_MFA_BYPASSED,
        ],
      })
      .orderBy('audit.createdAt', 'DESC')
      .take(limit);

    const data = await queryBuilder.getMany();

    const response = new GetRiskAssessmentHistoryResponseDTO();
    response.data = data as unknown as IAuthAudit[];

    return response;
  }
}

// ============================================================================
// Internal Service (Framework Adapters Only)
// ============================================================================

/**
 * Internal Authentication Audit Service
 *
 * Extends the base AuthAuditService with event recording capabilities.
 * This service is only available via `@nauth-toolkit/core/internal` and should
 * NOT be used by consumer applications.
 *
 * **Event Recording:**
 * The `recordEvent()` method is internal-only and is used by nauth-toolkit
 * services to log authentication events. Consumer applications should use
 * the query methods from the base `AuthAuditService` class.
 *
 * @internal
 * This class is only exported from `@nauth-toolkit/core/internal` for use
 * by framework adapters. Consumer applications should use the base
 * `AuthAuditService` from `@nauth-toolkit/core`.
 *
 * @example
 * ```typescript
 * // Framework adapter usage
 * import { AuthAuditService } from '@nauth-toolkit/core/internal';
 *
 * const auditService = new AuthAuditService(...);
 * // Can use recordEvent() here (internal only)
 * await auditService.recordEvent({ ... });
 * ```
 */
export class InternalAuthAuditService extends AuthAuditService {
  /**
   * Record an authentication audit event
   *
   * Creates an audit record for an authentication or security event.
   * Automatically extracts client information from request context when available.
   * This method is non-blocking - errors are logged but don't throw exceptions.
   *
   * **Automatic Client Info Extraction:**
   * When ClientInfoService is available, the following fields are automatically populated:
   * - ipAddress, ipCountry, ipCity (from request and geolocation)
   * - userAgent, platform, browser (from user agent parsing)
   * - deviceId, deviceName, deviceType (from request context)
   *
   * Explicitly provided fields in `data` will override auto-extracted values.
   *
   * @internal
   * This method is only available in InternalAuthAuditService and should not
   * be exposed to consumer applications.
   *
   * @param data - Audit event data (only event-specific fields needed)
   * @param data.userId - Internal user ID (preferred, more efficient)
   * @param data.userSub - External user identifier (will lookup userId if userId not provided)
   * @param data.eventType - Type of event
   * @param data.eventStatus - Event classification status
   * @returns Created audit record
   *
   * @example
   * ```typescript
   * // Simple recording - client info auto-populated
   * await auditService.recordEvent({
   *   userId: user.id,
   *   eventType: AuthAuditEventType.LOGIN_SUCCESS,
   *   eventStatus: 'SUCCESS',
   *   authMethod: 'password',
   *   // ipAddress, userAgent, deviceName, etc. automatically included!
   * });
   *
   * // Override specific fields if needed
   * await auditService.recordEvent({
   *   userId: user.id,
   *   eventType: AuthAuditEventType.LOGIN_SUCCESS,
   *   eventStatus: 'SUCCESS',
   *   ipAddress: 'custom-ip', // Overrides auto-extracted IP
   * });
   * ```
   */
  async recordEvent(data: CreateAuthAuditEventDTO): Promise<IAuthAudit | null> {
    try {
      // Resolve userId if userSub provided
      let userId = data.userId;
      if (!userId && data.userSub) {
        const user = (await this.userRepository.findOne({ where: { sub: data.userSub } })) as IUser | null;
        if (!user) {
          this.logger?.warn?.(`Cannot record audit event - user not found: ${data.userSub}`);
          return null;
        }
        userId = user.id;
      }

      if (!userId) {
        this.logger?.warn?.('Cannot record audit event - userId or userSub required');
        return null;
      }

      // ============================================================================
      // Auto-extract client info from context (when available)
      // ============================================================================
      let clientInfo: {
        ipAddress?: string | null;
        ipCountry?: string | null;
        ipCity?: string | null;
        userAgent?: string | null;
        platform?: string | null;
        browser?: string | null;
        deviceId?: string | null;
        deviceName?: string | null;
        deviceType?: string | null;
        sessionId?: number | null;
      } = {};

      if (this.clientInfoService) {
        try {
          const clientInfoFromContext = this.clientInfoService.get();
          // Only populate if not explicitly provided (allows override)
          clientInfo = {
            ipAddress: clientInfoFromContext.ipAddress || undefined,
            ipCountry: clientInfoFromContext.ipCountry || undefined,
            ipCity: clientInfoFromContext.ipCity || undefined,
            userAgent: clientInfoFromContext.userAgent || undefined,
            platform: clientInfoFromContext.platform || undefined,
            browser: clientInfoFromContext.browser || undefined,
            deviceId: clientInfoFromContext.deviceToken || undefined,
            deviceName: clientInfoFromContext.deviceName || undefined,
            deviceType: clientInfoFromContext.deviceType || undefined,
            sessionId: clientInfoFromContext.sessionId || undefined,
          };
        } catch (error) {
          // Non-blocking: If client info extraction fails, continue without it
          // This can happen if called outside request context (e.g., cron jobs)
          this.logger?.debug?.(
            `Failed to extract client info for audit: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      // ============================================================================
      // Merge: Explicitly provided fields override auto-extracted ones
      // ============================================================================
      const mergedData = {
        ipAddress: data.ipAddress ?? clientInfo.ipAddress ?? null,
        ipCountry: data.ipCountry ?? clientInfo.ipCountry ?? null,
        ipCity: data.ipCity ?? clientInfo.ipCity ?? null,
        userAgent: data.userAgent ?? clientInfo.userAgent ?? null,
        platform: data.platform ?? clientInfo.platform ?? null,
        browser: data.browser ?? clientInfo.browser ?? null,
        deviceId: data.deviceId ?? clientInfo.deviceId ?? null,
        deviceName: data.deviceName ?? clientInfo.deviceName ?? null,
        deviceType: data.deviceType ?? clientInfo.deviceType ?? null,
        sessionId: data.sessionId ?? clientInfo.sessionId ?? null,
      };

      // Create audit record
      const auditRecord = this.auditRepository.create({
        userId,
        eventType: data.eventType,
        eventStatus: data.eventStatus,
        riskFactor: data.riskFactor ?? null,
        riskFactors: data.riskFactors ?? null,
        adaptiveMfaTriggered: data.adaptiveMfaTriggered ?? null,
        ipAddress: mergedData.ipAddress,
        ipCountry: mergedData.ipCountry,
        ipCity: mergedData.ipCity,
        userAgent: mergedData.userAgent,
        platform: mergedData.platform,
        browser: mergedData.browser,
        deviceId: mergedData.deviceId,
        deviceName: mergedData.deviceName,
        deviceType: mergedData.deviceType,
        sessionId: mergedData.sessionId,
        challengeSessionId: data.challengeSessionId ?? null,
        authMethod: data.authMethod ?? null,
        performedBy: data.performedBy ?? null,
        reason: data.reason ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? null,
      });

      const saved = await this.auditRepository.save(auditRecord);
      return saved as unknown as IAuthAudit;
    } catch (error) {
      // Non-blocking: Log error but don't throw
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Failed to record audit event: ${errorMessage}`, { eventType: data.eventType, error });
      return null;
    }
  }
}
