import { Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { BaseApiKey } from '../entities/api-key.entity';
import { BaseUser } from '../entities/user.entity';
import { NAuthConfig } from '../interfaces/config.interface';
import { IUser } from '../interfaces/entities.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ContextStorage } from '../utils/context-storage';
import { ensureValidatedDto } from '../utils/dto-validator';
import { isValidIpOrCidr, ipMatchesEntry } from '../utils/ip-match';
import { InternalAuthAuditService } from './auth-audit.service';
import {
  CreateApiKeyDTO,
  UpdateApiKeyDTO,
  RevokeApiKeyDTO,
  DeleteApiKeyDTO,
  ApiKeyResponseDTO,
  CreateApiKeyResponseDTO,
  ListApiKeysResponseDTO,
  RevokeApiKeyResponseDTO,
  DeleteApiKeyResponseDTO,
} from '../dto/api-key.dto';
import { AdminCreateApiKeyDTO, AdminUpdateApiKeyDTO, AdminManageApiKeyDTO } from '../dto/admin-api-key.dto';

/** Result of a successful API key validation (internal auth path). */
export interface ApiKeyValidationResult {
  /** External key identifier (UUID v4) */
  keyId: string;
  /** Owning user's external identifier (UUID v4) — callers load the user context from this */
  sub: string;
}

/**
 * API Key Service
 *
 * Owns the full API key lifecycle and validation. Keys authenticate **as their owning user**.
 *
 * Identity convention (matches the rest of the toolkit):
 * - **Self-service** methods (`createKey`, `listKeys`, `updateKey`, `revokeKey`, `deleteKey`)
 *   act on the *currently authenticated* user, resolved from request context. They take no
 *   user identifier.
 * - **Admin** methods (`adminCreateKey`, `adminListKeys`, `adminUpdateKey`, `adminRevokeKey`,
 *   `adminDeleteKey`) act on a target user identified by `sub`. Protect them with admin auth.
 *
 * Every public method takes a request DTO and returns a response DTO, and validates the DTO at
 * runtime (via {@link ensureValidatedDto}) so non-NestJS callers are protected from invalid input.
 *
 * Security:
 * - Only a SHA-256 hash of the key is stored; the plaintext is returned once at creation.
 * - Presented keys are hashed and looked up by that hash (indexed, unique) — the plaintext never
 *   leaves the caller and is never compared field-by-field.
 * - Per-key IP allowlists (optional) restrict which source IPs may use a key.
 */
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepository: Repository<BaseApiKey>,
    private readonly userRepository: Repository<BaseUser>,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly auditService?: InternalAuthAuditService,
  ) {
    this.logger?.log?.('ApiKeyService initialized');
  }

  // ==========================================================================
  // Self-service (acting user resolved from auth context)
  // ==========================================================================

  /**
   * Create an API key for the currently authenticated user.
   *
   * @throws {NAuthException} API_KEY_CREATION_DISABLED, API_KEY_LIMIT_REACHED,
   *   API_KEY_EXPIRY_REQUIRED, API_KEY_INDEFINITE_NOT_ALLOWED, API_KEY_EXPIRY_TOO_LONG,
   *   VALIDATION_FAILED, FORBIDDEN (not authenticated)
   */
  async createKey(dto: CreateApiKeyDTO): Promise<CreateApiKeyResponseDTO> {
    dto = await ensureValidatedDto(CreateApiKeyDTO, dto);
    const user = this.getCurrentUserOrThrow();
    return this.createForUser(user.id, dto, false);
  }

  /**
   * List the current user's API keys (sanitized; never includes secrets).
   */
  async listKeys(): Promise<ListApiKeysResponseDTO> {
    const user = this.getCurrentUserOrThrow();
    return this.listForUser(user.id);
  }

  /**
   * Update the current user's key (label and/or IP allowlist). Secret and expiry are immutable.
   *
   * @throws {NAuthException} API_KEY_NOT_FOUND, VALIDATION_FAILED, FORBIDDEN
   */
  async updateKey(dto: UpdateApiKeyDTO): Promise<ApiKeyResponseDTO> {
    dto = await ensureValidatedDto(UpdateApiKeyDTO, dto);
    const user = this.getCurrentUserOrThrow();
    return this.updateForUser(user.id, dto.keyId, dto.name, dto.allowedIps);
  }

  /**
   * Revoke (soft-delete) one of the current user's keys.
   *
   * @throws {NAuthException} API_KEY_NOT_FOUND, FORBIDDEN
   */
  async revokeKey(dto: RevokeApiKeyDTO): Promise<RevokeApiKeyResponseDTO> {
    dto = await ensureValidatedDto(RevokeApiKeyDTO, dto);
    const user = this.getCurrentUserOrThrow();
    return this.revokeForUser(user.id, dto.keyId, 'user_revoked');
  }

  /**
   * Permanently delete one of the current user's keys.
   *
   * @throws {NAuthException} API_KEY_NOT_FOUND, FORBIDDEN
   */
  async deleteKey(dto: DeleteApiKeyDTO): Promise<DeleteApiKeyResponseDTO> {
    dto = await ensureValidatedDto(DeleteApiKeyDTO, dto);
    const user = this.getCurrentUserOrThrow();
    return this.deleteForUser(user.id, dto.keyId);
  }

  // ==========================================================================
  // Admin (target user identified by sub) — protect with admin authentication
  // ==========================================================================

  /**
   * Create an API key on behalf of a user. Bypasses `allowUserCreation`, but still enforces
   * `maxKeysPerUser`, expiry, and IP-restriction rules.
   *
   * @throws {NAuthException} USER_NOT_FOUND, or any API_KEY_* creation error
   */
  async adminCreateKey(dto: AdminCreateApiKeyDTO): Promise<CreateApiKeyResponseDTO> {
    dto = await ensureValidatedDto(AdminCreateApiKeyDTO, dto);
    const userId = await this.resolveUserIdBySub(dto.sub);
    return this.createForUser(userId, dto, true);
  }

  /**
   * List a user's API keys (admin).
   *
   * @throws {NAuthException} USER_NOT_FOUND
   */
  async adminListKeys(dto: AdminManageApiKeyDTO): Promise<ListApiKeysResponseDTO> {
    dto = await ensureValidatedDto(AdminManageApiKeyDTO, dto);
    const userId = await this.resolveUserIdBySub(dto.sub);
    return this.listForUser(userId);
  }

  /**
   * Update a user's key (admin).
   *
   * @throws {NAuthException} USER_NOT_FOUND, API_KEY_NOT_FOUND, VALIDATION_FAILED
   */
  async adminUpdateKey(dto: AdminUpdateApiKeyDTO): Promise<ApiKeyResponseDTO> {
    dto = await ensureValidatedDto(AdminUpdateApiKeyDTO, dto);
    const userId = await this.resolveUserIdBySub(dto.sub);
    return this.updateForUser(userId, dto.keyId, dto.name, dto.allowedIps);
  }

  /**
   * Revoke (soft-delete) a user's key (admin).
   *
   * @throws {NAuthException} USER_NOT_FOUND, API_KEY_NOT_FOUND, VALIDATION_FAILED
   */
  async adminRevokeKey(dto: AdminManageApiKeyDTO): Promise<RevokeApiKeyResponseDTO> {
    dto = await ensureValidatedDto(AdminManageApiKeyDTO, dto);
    const keyId = this.requireKeyId(dto.keyId);
    const userId = await this.resolveUserIdBySub(dto.sub);
    return this.revokeForUser(userId, keyId, 'admin_revoked');
  }

  /**
   * Permanently delete a user's key (admin).
   *
   * @throws {NAuthException} USER_NOT_FOUND, API_KEY_NOT_FOUND, VALIDATION_FAILED
   */
  async adminDeleteKey(dto: AdminManageApiKeyDTO): Promise<DeleteApiKeyResponseDTO> {
    dto = await ensureValidatedDto(AdminManageApiKeyDTO, dto);
    const keyId = this.requireKeyId(dto.keyId);
    const userId = await this.resolveUserIdBySub(dto.sub);
    return this.deleteForUser(userId, keyId);
  }

  // ==========================================================================
  // Validation (internal auth path — called by the handler / guard)
  // ==========================================================================

  /**
   * Validate a presented API key and resolve its owner.
   *
   * On any failure this throws a precise {@link NAuthException} (access denied) — callers
   * MUST NOT fall back to other credentials.
   *
   * @param rawKey - The full plaintext key from the request header
   * @param callerIp - Source IP of the request (for IP-allowlist enforcement + usage tracking)
   * @throws {NAuthException} API_KEY_INVALID, API_KEY_EXPIRED, API_KEY_IP_NOT_ALLOWED
   */
  async validateKey(rawKey: string, callerIp?: string | null): Promise<ApiKeyValidationResult> {
    if (typeof rawKey !== 'string' || rawKey.length === 0) {
      await this.audit(AuthAuditEventType.API_KEY_AUTH_FAILED, null, 'FAILURE', { reason: 'malformed' });
      throw new NAuthException(AuthErrorCode.API_KEY_INVALID, 'Invalid API key');
    }

    // Look up by the hash of the presented key (indexed). A miss means unknown/invalid.
    const key = await this.apiKeyRepository.findOne({ where: { keyHash: this.hashKey(rawKey) } });
    if (!key || !key.isActive) {
      await this.audit(AuthAuditEventType.API_KEY_AUTH_FAILED, key?.userId ?? null, 'FAILURE', { reason: 'invalid' });
      throw new NAuthException(AuthErrorCode.API_KEY_INVALID, 'Invalid API key');
    }

    if (key.isExpired()) {
      await this.audit(AuthAuditEventType.API_KEY_AUTH_FAILED, key.userId, 'FAILURE', {
        keyId: key.keyId,
        reason: 'expired',
      });
      throw new NAuthException(AuthErrorCode.API_KEY_EXPIRED, 'API key has expired');
    }

    if (!key.isIpAllowed(callerIp, ipMatchesEntry)) {
      await this.audit(AuthAuditEventType.API_KEY_AUTH_FAILED, key.userId, 'SUSPICIOUS', {
        keyId: key.keyId,
        reason: 'ip_not_allowed',
      });
      throw new NAuthException(AuthErrorCode.API_KEY_IP_NOT_ALLOWED, 'API key not permitted from this IP address');
    }

    const owner = await this.userRepository.findOne({
      where: { id: key.userId },
      select: { id: true, sub: true, isActive: true },
    });
    if (!owner || !owner.isActive) {
      await this.audit(AuthAuditEventType.API_KEY_AUTH_FAILED, key.userId, 'FAILURE', {
        keyId: key.keyId,
        reason: 'owner_inactive',
      });
      throw new NAuthException(AuthErrorCode.API_KEY_INVALID, 'Invalid API key');
    }

    await this.recordUsage(key, callerIp ?? null);

    return { keyId: key.keyId, sub: owner.sub };
  }

  // ==========================================================================
  // Internal primitives (keyed by internal userId)
  // ==========================================================================

  /**
   * Core key creation for a resolved user.
   */
  private async createForUser(
    userId: number,
    params: { name?: string; expiresInDays?: number | null; allowedIps?: string[] },
    createdByAdmin: boolean,
  ): Promise<CreateApiKeyResponseDTO> {
    const cfg = this.config.apiKeys ?? {};

    // Creation-rights gate: only admins may create keys unless user creation is enabled.
    if (!createdByAdmin && cfg.allowUserCreation !== true) {
      throw new NAuthException(
        AuthErrorCode.API_KEY_CREATION_DISABLED,
        'API key creation is disabled for users. Contact an administrator.',
      );
    }

    const maxKeys = cfg.maxKeysPerUser ?? 10;
    const activeCount = await this.apiKeyRepository.count({ where: { userId, isActive: true } });
    if (activeCount >= maxKeys) {
      throw new NAuthException(AuthErrorCode.API_KEY_LIMIT_REACHED, `Maximum of ${maxKeys} active API keys reached.`, {
        maxKeysPerUser: maxKeys,
      });
    }

    const expiresAt = this.resolveExpiry(params.expiresInDays);
    const allowedIps = this.normalizeAllowedIps(params.allowedIps);

    // Server-generated 256-bit secret. The plaintext is returned once; only its hash is stored.
    const keyId = randomUUID();
    const rawKey = randomBytes(32).toString('base64url');
    const keyHash = this.hashKey(rawKey);

    const entity = this.apiKeyRepository.create({
      keyId,
      userId,
      keyHash,
      name: params.name ?? null,
      lastFour: rawKey.slice(-4),
      allowedIps: allowedIps.length > 0 ? allowedIps : null,
      expiresAt,
      isActive: true,
      createdByAdmin,
      usageCount: 0,
    });

    const saved = await this.apiKeyRepository.save(entity);

    await this.audit(AuthAuditEventType.API_KEY_CREATED, userId, 'SUCCESS', {
      keyId,
      createdByAdmin,
      hasExpiry: expiresAt !== null,
      ipRestricted: allowedIps.length > 0,
    });

    return { key: rawKey, apiKey: this.toResponse(saved) };
  }

  /**
   * List a resolved user's keys.
   */
  private async listForUser(userId: number): Promise<ListApiKeysResponseDTO> {
    const keys = await this.apiKeyRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return { apiKeys: keys.map((k) => this.toResponse(k)) };
  }

  /**
   * Update a resolved user's key (label / IP allowlist).
   */
  private async updateForUser(
    userId: number,
    keyId: string,
    name: string | undefined,
    allowedIps: string[] | undefined,
  ): Promise<ApiKeyResponseDTO> {
    const key = await this.apiKeyRepository.findOne({ where: { keyId, userId } });
    if (!key) {
      throw new NAuthException(AuthErrorCode.API_KEY_NOT_FOUND, 'API key not found');
    }

    if (name !== undefined) {
      key.name = name ?? null;
    }
    if (allowedIps !== undefined) {
      const normalized = this.normalizeAllowedIps(allowedIps);
      key.allowedIps = normalized.length > 0 ? normalized : null;
    }

    const saved = await this.apiKeyRepository.save(key);
    await this.audit(AuthAuditEventType.API_KEY_UPDATED, userId, 'INFO', { keyId });
    return this.toResponse(saved);
  }

  /**
   * Revoke (soft-delete) a resolved user's key.
   */
  private async revokeForUser(userId: number, keyId: string, reason: string): Promise<RevokeApiKeyResponseDTO> {
    const key = await this.apiKeyRepository.findOne({ where: { keyId, userId } });
    if (!key) {
      throw new NAuthException(AuthErrorCode.API_KEY_NOT_FOUND, 'API key not found');
    }
    if (key.isActive) {
      key.isActive = false;
      key.revokedAt = new Date();
      key.revokeReason = reason;
      await this.apiKeyRepository.save(key);
    }
    await this.audit(AuthAuditEventType.API_KEY_REVOKED, userId, 'INFO', { keyId });
    return { success: true };
  }

  /**
   * Permanently delete a resolved user's key.
   */
  private async deleteForUser(userId: number, keyId: string): Promise<DeleteApiKeyResponseDTO> {
    const key = await this.apiKeyRepository.findOne({ where: { keyId, userId } });
    if (!key) {
      throw new NAuthException(AuthErrorCode.API_KEY_NOT_FOUND, 'API key not found');
    }
    await this.apiKeyRepository.remove(key);
    await this.audit(AuthAuditEventType.API_KEY_DELETED, userId, 'INFO', { keyId });
    return { success: true };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Resolve the currently authenticated user from request context.
   *
   * @throws {NAuthException} FORBIDDEN when no authenticated user is present
   */
  private getCurrentUserOrThrow(): IUser {
    const currentUser = ContextStorage.get<IUser>('CURRENT_USER');
    if (!currentUser) {
      throw new NAuthException(AuthErrorCode.FORBIDDEN, 'Authentication required');
    }
    return currentUser;
  }

  /**
   * Resolve an internal user id from an external sub (UUID).
   *
   * @throws {NAuthException} USER_NOT_FOUND
   */
  private async resolveUserIdBySub(sub: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { sub }, select: { id: true } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }
    return user.id;
  }

  /**
   * Ensure a keyId is present for admin revoke/delete operations.
   */
  private requireKeyId(keyId: string | undefined): string {
    if (!keyId) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'keyId is required for this operation');
    }
    return keyId;
  }

  /**
   * Resolve the mandatory, config-bounded expiry.
   */
  private resolveExpiry(expiresInDays: number | null | undefined): Date | null {
    const cfg = this.config.apiKeys ?? {};

    if (expiresInDays === undefined) {
      throw new NAuthException(
        AuthErrorCode.API_KEY_EXPIRY_REQUIRED,
        'An expiry must be specified when creating an API key (a number of days, or null for never).',
      );
    }

    if (expiresInDays === null) {
      if (cfg.allowIndefinite === false) {
        throw new NAuthException(
          AuthErrorCode.API_KEY_INDEFINITE_NOT_ALLOWED,
          'Non-expiring API keys are not allowed. Specify an expiry in days.',
        );
      }
      return null;
    }

    if (!Number.isInteger(expiresInDays) || expiresInDays < 1) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'expiresInDays must be a positive integer or null.');
    }

    if (typeof cfg.maxExpiryDays === 'number' && expiresInDays > cfg.maxExpiryDays) {
      throw new NAuthException(
        AuthErrorCode.API_KEY_EXPIRY_TOO_LONG,
        `Expiry exceeds the maximum of ${cfg.maxExpiryDays} days.`,
        { maxExpiryDays: cfg.maxExpiryDays },
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    return expiresAt;
  }

  /**
   * Validate and normalize an IP allowlist per configuration.
   */
  private normalizeAllowedIps(allowedIps: string[] | undefined): string[] {
    const cfg = this.config.apiKeys ?? {};
    const ipCfg = cfg.ipRestrictions ?? {};

    if (ipCfg.enabled === false) {
      if (allowedIps && allowedIps.length > 0) {
        this.logger?.debug?.('[ApiKey] IP restrictions disabled - ignoring provided allowedIps');
      }
      return [];
    }

    const normalized = (allowedIps ?? []).map((e) => e.trim()).filter((e) => e.length > 0);

    if (ipCfg.requireForNewKeys === true && normalized.length === 0) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'An IP allowlist is required for new API keys (apiKeys.ipRestrictions.requireForNewKeys).',
      );
    }

    const maxIps = ipCfg.maxIpsPerKey ?? 20;
    if (normalized.length > maxIps) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, `An API key may have at most ${maxIps} IP entries.`, {
        maxIpsPerKey: maxIps,
      });
    }

    const invalid = normalized.filter((e) => !isValidIpOrCidr(e));
    if (invalid.length > 0) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'allowedIps contains invalid IP or CIDR entries.', {
        invalid,
      });
    }

    return normalized;
  }

  /**
   * Compute the SHA-256 hex hash of a key string (used for storage + indexed lookup).
   */
  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Update last-used metadata, throttled to avoid a write on every request.
   * Never throws — usage tracking must not block authentication.
   */
  private async recordUsage(key: BaseApiKey, callerIp: string | null): Promise<void> {
    const cfg = this.config.apiKeys ?? {};
    const throttleMs = (cfg.lastUsedThrottleSeconds ?? 60) * 1000;
    const now = Date.now();
    const last = key.lastUsedAt ? key.lastUsedAt.getTime() : 0;

    if (last !== 0 && now - last < throttleMs) {
      return;
    }

    try {
      const update: { lastUsedAt: Date; lastUsedIp?: string | null } = {
        lastUsedAt: new Date(now),
      };
      if (cfg.trackUsageIp !== false) {
        update.lastUsedIp = callerIp;
      }
      await this.apiKeyRepository.update({ id: key.id }, update);
      // Atomic increment avoids lost updates under concurrent use (read-modify-write race).
      await this.apiKeyRepository.increment({ id: key.id }, 'usageCount', 1);

      await this.audit(AuthAuditEventType.API_KEY_USED, key.userId, 'SUCCESS', { keyId: key.keyId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.debug?.(`[ApiKey] Failed to record usage for key ${key.keyId}: ${message}`);
    }
  }

  /**
   * Build a sanitized response DTO from an entity.
   */
  private toResponse(key: BaseApiKey): ApiKeyResponseDTO {
    return {
      keyId: key.keyId,
      name: key.name ?? null,
      lastFour: key.lastFour ?? null,
      allowedIps: key.allowedIps ?? null,
      expiresAt: key.expiresAt ?? null,
      isActive: key.isActive,
      createdByAdmin: key.createdByAdmin,
      lastUsedAt: key.lastUsedAt ?? null,
      lastUsedIp: key.lastUsedIp ?? null,
      usageCount: key.usageCount ?? 0,
      createdAt: key.createdAt,
    };
  }

  /**
   * Record an audit event (no-op when audit logging is disabled). Never throws.
   */
  private async audit(
    eventType: AuthAuditEventType,
    userId: number | null,
    eventStatus: 'SUCCESS' | 'FAILURE' | 'INFO' | 'SUSPICIOUS',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditService) {
      return;
    }
    try {
      await this.auditService.recordEvent({
        userId: userId ?? undefined,
        eventType,
        eventStatus,
        authMethod: 'api-key',
        metadata,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.debug?.(`[ApiKey] Failed to record audit event ${eventType}: ${message}`);
    }
  }
}
