import { Repository } from 'typeorm';
import { AuthorizationService } from './authorization.service';
import { BaseAuthAudit, BaseUser } from '../entities';
import { IAuthAudit, IUser } from '../interfaces/entities.interface';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ClientInfoService } from './client-info.service';
import { ensureValidatedDto } from '../utils/dto-validator';
import { RiskFactor } from '../enums/risk-factor.enum';
import { AdminGetUserAuthHistoryDTO, GetUserAuthHistoryResponseDTO } from '../dto/admin-get-user-auth-history.dto';
import { GetEventsByTypeDTO, GetEventsByTypeResponseDTO } from '../dto/get-events-by-type.dto';
import { GetSuspiciousActivityDTO, GetSuspiciousActivityResponseDTO } from '../dto/get-suspicious-activity.dto';
import {
  GetRiskAssessmentHistoryDTO,
  GetRiskAssessmentHistoryResponseDTO,
} from '../dto/get-risk-assessment-history.dto';
import { isUUID } from 'class-validator';
import { ContextStorage } from '../utils/context-storage';

/**
 * DTO for creating audit events
 *
 * @internal
 * This DTO is only used by InternalAuthAuditService and should not be exposed
 * to consumer applications.
 */
export interface CreateAuthAuditEventDTO {
  userId?: number; // Internal user ID (preferred)
  sub?: string; // External user identifier (will lookup userId)
  eventType: AuthAuditEventType;
  eventStatus: AuthAuditEventStatus;
  riskFactor?: number | null;
  riskFactors?: RiskFactor[] | null;
  adaptiveMfaTriggered?: boolean | null;
  // Note: ipAddress, ipCountry, ipCity, userAgent, platform, browser, deviceId, deviceName, deviceType
  // are automatically captured from ClientInfoService and cannot be overridden
  // Use metadata for event-specific data only
  deviceId?: string | null; // Special case: can override for newly created device tokens
  sessionId?: number | null;
  challengeSessionId?: number | null;
  authMethod?: string | null;
  performedBy?: string | null; // Auto-populated from session context if not provided (userId of authenticated user)
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
 * - User history queries (resolves sub to userId automatically)
 *
 * **Design Notes:**
 * - Only stores `userId` (integer) - no sub duplication
 * - All methods accepting sub resolve to userId before querying
 * - Risk tracking fields are infrastructure for future adaptive MFA (no business logic)
 *
 * **Note:** This is the public API class. Event recording is handled internally
 * by `InternalAuthAuditService` and is not exposed to consumer applications.
 *
 * @example
 * ```typescript
 * // Get user history (accepts sub, resolves to userId)
 * const history = await auditService.getUserAuthHistory({
 *   sub: 'user-uuid',
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
    protected readonly authorizationService?: AuthorizationService,
  ) {}

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get paginated authentication history for a user
   *
   * Accepts sub (external identifier) and resolves to userId for efficient queries.
   * Supports filtering by event types, status, and date ranges.
   *
   * @param request - Request DTO containing sub and filtering options
   * @returns Response DTO with paginated audit records
   * @throws {NAuthException} If user not found
   *
   * @example
   * ```typescript
   * const history = await auditService.getUserAuthHistory({
   *   sub: 'user-uuid',
   *   page: 1,
   *   limit: 50,
   *   eventTypes: [AuthAuditEventType.LOGIN_SUCCESS, AuthAuditEventType.LOGIN_FAILED],
   *   startDate: new Date('2025-01-01'),
   * });
   * ```
   */
  async getUserAuthHistory(request: AdminGetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO> {
    request = await ensureValidatedDto(AdminGetUserAuthHistoryDTO, request);

    // Shared by two callers: AuthService.getUserAuthHistory forces `sub` to the current
    // user for the self-service route, while the admin route passes an arbitrary one.
    // Authorizing unconditionally would break self-service, so the boundary is whether
    // the caller is reading someone else's history.
    const caller = ContextStorage.get<IUser>('CURRENT_USER');
    if (!caller || request.sub !== caller.sub) {
      await this.authorizationService?.authorize('admin.audit.read', { targetSub: request.sub });
    }
    // Resolve sub to userId
    const user = (await this.userRepository.findOne({ where: { sub: request.sub } })) as IUser | null;
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
    await this.authorizationService?.authorize('admin.audit.read');
    request = await ensureValidatedDto(GetEventsByTypeDTO, request);
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
   * @param request - Request DTO containing optional sub and limit
   * @returns Response DTO with array of suspicious audit events
   *
   * @example
   * ```typescript
   * // Get all suspicious activity
   * const suspicious = await auditService.getSuspiciousActivity({});
   *
   * // Get suspicious activity for specific user
   * const userSuspicious = await auditService.getSuspiciousActivity({
   *   sub: 'user-uuid',
   *   limit: 50,
   * });
   * ```
   */
  async getSuspiciousActivity(request: GetSuspiciousActivityDTO): Promise<GetSuspiciousActivityResponseDTO> {
    await this.authorizationService?.authorize('admin.audit.read');
    request = await ensureValidatedDto(GetSuspiciousActivityDTO, request);
    const limit = request.limit || 100;

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .where('(audit.eventStatus = :status OR audit.eventType = :eventType)', {
        status: 'SUSPICIOUS',
        eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
      });

    // Filter by user if provided
    if (request.sub) {
      const user = (await this.userRepository.findOne({ where: { sub: request.sub } })) as IUser | null;
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
   * @param request - Request DTO containing sub and limit
   * @returns Response DTO with array of risk assessment audit events
   * @throws {NAuthException} If user not found
   *
   * @example
   * ```typescript
   * const riskHistory = await auditService.getRiskAssessmentHistory({
   *   sub: 'user-uuid',
   *   limit: 50,
   * });
   * ```
   */
  async getRiskAssessmentHistory(request: GetRiskAssessmentHistoryDTO): Promise<GetRiskAssessmentHistoryResponseDTO> {
    await this.authorizationService?.authorize('admin.audit.read');
    request = await ensureValidatedDto(GetRiskAssessmentHistoryDTO, request);
    const limit = request.limit || 100;

    // Resolve sub to userId
    const user = (await this.userRepository.findOne({ where: { sub: request.sub } })) as IUser | null;
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
   * Note: These fields cannot be overridden via the DTO - they are always captured from the request context.
   * Only deviceId can be explicitly set for special cases (e.g., newly created device tokens).
   * Do not include ipAddress, ipCountry, ipCity, userAgent, platform, browser, deviceName, or deviceType
   * in the DTO - they will be automatically captured and attempts to include them will cause TypeScript errors.
   *
   * **Automatic performedBy Population:**
   * The `performedBy` field is automatically populated from the authenticated user's context:
   * - If userId is available from ClientInfoService (extracted from JWT token by interceptors/handlers), it is used as `performedBy`
   * - This captures who performed the action (e.g., admin performing action on another user)
   * - If no userId is found in client info, `performedBy` defaults to the event's `userId` (user performing action on themselves)
   * - Explicit `performedBy` in DTO overrides automatic population
   *
   * @internal
   * This method is only available in InternalAuthAuditService and should not
   * be exposed to consumer applications.
   *
   * @param data - Audit event data (only event-specific fields needed)
   * @param data.userId - Internal user ID (preferred, more efficient)
   * @param data.sub - External user identifier (will lookup userId if userId not provided)
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
   *   // ipAddress, userAgent, etc. automatically captured from request context
   * });
   * ```
   */
  async recordEvent(data: CreateAuthAuditEventDTO): Promise<IAuthAudit | null> {
    try {
      // Resolve userId if sub provided
      let userId = data.userId;
      if (!userId && data.sub) {
        // `sub` is expected to be a UUID in most deployments (e.g., Postgres UUID column).
        // Avoid hitting the database (and avoid adapter-level type-cast errors) when an invalid value is provided.
        if (!isUUID(data.sub)) {
          this.logger?.warn?.('Cannot record audit event - invalid sub format (expected UUID)', {
            sub: data.sub,
          });
          return null;
        }
        try {
          // NOTE: In some adapters (e.g., Postgres) `sub` may be a UUID column. If a caller accidentally
          // passes a non-UUID here (e.g., an email/username), the query can throw. Auditing must never
          // break auth flows, so we treat lookup failures as "user not found".
          const user = (await this.userRepository.findOne({ where: { sub: data.sub } })) as IUser | null;
          if (!user) {
            this.logger?.warn?.(`Cannot record audit event - user not found: ${data.sub}`);
            return null;
          }
          userId = user.id;
        } catch (lookupError: unknown) {
          const errorMessage = lookupError instanceof Error ? lookupError.message : 'Unknown error';
          this.logger?.warn?.(`Cannot record audit event - failed to resolve sub: ${errorMessage}`, {
            sub: data.sub,
          });
          return null;
        }
      }

      if (!userId) {
        this.logger?.warn?.('Cannot record audit event - userId or sub required');
        return null;
      }

      // ============================================================================
      // Auto-extract client info from context (when available)
      // Note: These fields are automatically captured and cannot be overridden by callers
      // ============================================================================
      let clientInfo: {
        ipAddress?: string | null;
        ipCountry?: string | null;
        ipCity?: string | null;
        ipLatitude?: number | null;
        ipLongitude?: number | null;
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

          // Debug logging
          if (!clientInfoFromContext.ipLatitude || !clientInfoFromContext.ipLongitude) {
            this.logger?.warn?.(
              `[AuthAuditService] Creating audit WITHOUT coordinates from context: ` +
                `IP=${clientInfoFromContext.ipAddress}, country=${clientInfoFromContext.ipCountry}, ` +
                `city=${clientInfoFromContext.ipCity}, lat=${clientInfoFromContext.ipLatitude}, ` +
                `lon=${clientInfoFromContext.ipLongitude}`,
            );
          } else {
            this.logger?.debug?.(
              `[AuthAuditService] Creating audit WITH coordinates from context: ` +
                `IP=${clientInfoFromContext.ipAddress}, ${clientInfoFromContext.ipCity}, ` +
                `${clientInfoFromContext.ipCountry} (${clientInfoFromContext.ipLatitude}, ${clientInfoFromContext.ipLongitude})`,
            );
          }

          // Automatically capture from context (no override allowed)
          clientInfo = {
            ipAddress: clientInfoFromContext.ipAddress || null,
            ipCountry: clientInfoFromContext.ipCountry || null,
            ipCity: clientInfoFromContext.ipCity || null,
            ipLatitude: clientInfoFromContext.ipLatitude || null,
            ipLongitude: clientInfoFromContext.ipLongitude || null,
            userAgent: clientInfoFromContext.userAgent || null,
            platform: clientInfoFromContext.platform || null,
            browser: clientInfoFromContext.browser || null,
            deviceId: clientInfoFromContext.deviceToken || null,
            deviceName: clientInfoFromContext.deviceName || null,
            deviceType: clientInfoFromContext.deviceType || null,
            sessionId: clientInfoFromContext.sessionId || null,
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
      // Use auto-extracted client info (deviceId can be overridden for special cases)
      // ============================================================================
      const mergedData = {
        ipAddress: clientInfo.ipAddress ?? null,
        ipCountry: clientInfo.ipCountry ?? null,
        ipCity: clientInfo.ipCity ?? null,
        ipLatitude: clientInfo.ipLatitude ?? null,
        ipLongitude: clientInfo.ipLongitude ?? null,
        userAgent: clientInfo.userAgent ?? null,
        platform: clientInfo.platform ?? null,
        browser: clientInfo.browser ?? null,
        deviceId: data.deviceId ?? clientInfo.deviceId ?? null, // Allow override for newly created device tokens
        deviceName: clientInfo.deviceName ?? null,
        deviceType: clientInfo.deviceType ?? null,
        sessionId: data.sessionId ?? clientInfo.sessionId ?? null,
      };

      // ============================================================================
      // Auto-populate performedBy from client info context (if available)
      // Prefer sub (UUID) over userId (internal id) for performedBy.
      // ============================================================================
      let performedBy: string | null = data.performedBy ?? null;
      if (!performedBy && this.clientInfoService) {
        try {
          const clientInfo = this.clientInfoService.get();
          if (clientInfo?.sub) {
            performedBy = clientInfo.sub;
          } else if (typeof clientInfo?.userId === 'number') {
            performedBy = String(clientInfo.userId);
          }
        } catch (error) {
          // Non-blocking: If client info extraction fails, continue without performedBy
          this.logger?.debug?.(
            `Failed to get sub/userId from client info for performedBy: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      // If still no performedBy and we have userId, use it as fallback
      // (most actions are performed by the user themselves)
      if (!performedBy && userId) {
        performedBy = String(userId);
      }

      // ============================================================================
      // Auto-populate performedByName in metadata from context (if performedBy is available)
      // ============================================================================
      let enrichedMetadata = data.metadata ?? null;
      if (performedBy && performedBy !== String(userId)) {
        try {
          const currentUser = ContextStorage.get<IUser>('CURRENT_USER');
          if (currentUser && currentUser.sub === performedBy) {
            // Build name from firstName and lastName if available, otherwise use email
            const firstName = currentUser.firstName?.trim();
            const lastName = currentUser.lastName?.trim();
            let performedByName: string;
            if (firstName || lastName) {
              performedByName = [firstName, lastName].filter(Boolean).join(' ');
            } else {
              performedByName = currentUser.email;
            }

            // Add performedByName to metadata
            enrichedMetadata = {
              ...(enrichedMetadata || {}),
              performedByName,
            };
          }
        } catch (lookupError) {
          const errorMessage = lookupError instanceof Error ? lookupError.message : 'Unknown error';
          this.logger?.debug?.(`Failed to get performedBy user from context for audit metadata: ${errorMessage}`);
        }
      }

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
        ipLatitude: mergedData.ipLatitude,
        ipLongitude: mergedData.ipLongitude,
        userAgent: mergedData.userAgent,
        platform: mergedData.platform,
        browser: mergedData.browser,
        deviceId: mergedData.deviceId,
        deviceName: mergedData.deviceName,
        deviceType: mergedData.deviceType,
        sessionId: mergedData.sessionId,
        challengeSessionId: data.challengeSessionId ?? null,
        authMethod: data.authMethod ?? null,
        performedBy,
        reason: data.reason ?? null,
        description: data.description ?? null,
        metadata: enrichedMetadata,
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
