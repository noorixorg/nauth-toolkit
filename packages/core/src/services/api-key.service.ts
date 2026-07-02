import { Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { BaseApiKey } from '../entities/api-key.entity';
import { BaseUser } from '../entities/user.entity';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { isValidIpOrCidr, ipMatchesEntry } from '../utils/ip-match';
import { InternalAuthAuditService } from './auth-audit.service';
import { ApiKeyResponseDTO, CreateApiKeyResponseDTO } from '../dto/api-key.dto';

/**
 * Parameters for creating an API key.
 * The owning `userId` is always supplied by the caller (never from request bodies).
 */
export interface CreateApiKeyParams {
  /** Internal user ID the key authenticates as */
  userId: number;
  /** Optional label */
  name?: string | null;
  /** Expiry in days, `null` for never, or `undefined` to trigger the mandatory-expiry error */
  expiresInDays?: number | null;
  /** Optional IP allowlist (IPs / IPv4 CIDR ranges) */
  allowedIps?: string[];
  /** Whether an administrator is creating the key on behalf of the user */
  createdByAdmin?: boolean;
}

/** Parameters for updating an API key's mutable fields. */
export interface UpdateApiKeyParams {
  userId: number;
  keyId: string;
  name?: string | null;
  allowedIps?: string[];
}

/** Result of a successful API key validation. */
export interface ApiKeyValidationResult {
  /** External key identifier (UUID v4) */
  keyId: string;
  /** Internal owning user ID */
  userId: number;
  /** Owning user's external identifier (UUID v4) */
  sub: string;
}

/**
 * API Key Service
 *
 * Manages the lifecycle of API keys (create/list/update/revoke/delete) and validates
 * keys presented on requests. Keys authenticate as their owning user.
 *
 * Security:
 * - Only a SHA-256 hash of the full key is stored; the plaintext is returned once at creation.
 * - Lookup uses a non-secret, indexed `lookupId`; the secret is compared in constant time.
 * - Per-key IP allowlists (optional) restrict which source IPs may use a key.
 *
 * @remarks
 * This service does NOT enforce endpoint authorization. Route protection (which endpoints
 * accept API keys) is the responsibility of the framework adapter (guard/middleware).
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

  /**
   * Create a new API key.
   *
   * @param params - Creation parameters (owning userId is required)
   * @returns The plaintext key (shown once) plus sanitized metadata
   * @throws {NAuthException} API_KEY_CREATION_DISABLED, API_KEY_LIMIT_REACHED,
   *   API_KEY_EXPIRY_REQUIRED, API_KEY_INDEFINITE_NOT_ALLOWED, API_KEY_EXPIRY_TOO_LONG,
   *   VALIDATION_FAILED (invalid IP allowlist), USER_NOT_FOUND
   */
  async createKey(params: CreateApiKeyParams): Promise<CreateApiKeyResponseDTO> {
    const cfg = this.config.apiKeys ?? {};

    // Creation-rights gate: only admins may create keys unless user creation is enabled.
    if (!params.createdByAdmin && cfg.allowUserCreation !== true) {
      throw new NAuthException(
        AuthErrorCode.API_KEY_CREATION_DISABLED,
        'API key creation is disabled for users. Contact an administrator.',
      );
    }

    const user = await this.userRepository.findOne({ where: { id: params.userId } });
    if (!user) {
      throw new NAuthException(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }

    // Enforce per-user active key limit.
    const maxKeys = cfg.maxKeysPerUser ?? 10;
    const activeCount = await this.apiKeyRepository.count({ where: { userId: params.userId, isActive: true } });
    if (activeCount >= maxKeys) {
      throw new NAuthException(AuthErrorCode.API_KEY_LIMIT_REACHED, `Maximum of ${maxKeys} active API keys reached.`, {
        maxKeysPerUser: maxKeys,
      });
    }

    const expiresAt = this.resolveExpiry(params.expiresInDays);
    const allowedIps = this.normalizeAllowedIps(params.allowedIps);

    // Generate the key material.
    const keyId = randomUUID();
    const lookupId = randomBytes(8).toString('hex'); // 16 non-secret hex chars
    const secret = randomBytes(32).toString('base64url');
    const prefix = cfg.keyPrefix ?? 'nauth';
    const fullKey = `${prefix}_${lookupId}.${secret}`;
    const keyHash = this.hashKey(fullKey);

    const entity = this.apiKeyRepository.create({
      keyId,
      userId: params.userId,
      lookupId,
      keyHash,
      name: params.name ?? null,
      lastFour: secret.slice(-4),
      allowedIps: allowedIps.length > 0 ? allowedIps : null,
      expiresAt,
      isActive: true,
      createdByAdmin: params.createdByAdmin === true,
      usageCount: 0,
    });

    const saved = await this.apiKeyRepository.save(entity);

    await this.audit(AuthAuditEventType.API_KEY_CREATED, params.userId, 'SUCCESS', {
      keyId,
      createdByAdmin: entity.createdByAdmin,
      hasExpiry: expiresAt !== null,
      ipRestricted: allowedIps.length > 0,
    });

    return { key: fullKey, apiKey: this.toResponse(saved) };
  }

  /**
   * Update a key's mutable fields (name and IP allowlist).
   * The secret and expiry are immutable — rotate/extend by deleting and recreating.
   *
   * @throws {NAuthException} API_KEY_NOT_FOUND, VALIDATION_FAILED
   */
  async updateKey(params: UpdateApiKeyParams): Promise<ApiKeyResponseDTO> {
    const key = await this.apiKeyRepository.findOne({ where: { keyId: params.keyId, userId: params.userId } });
    if (!key) {
      throw new NAuthException(AuthErrorCode.API_KEY_NOT_FOUND, 'API key not found');
    }

    if (params.name !== undefined) {
      key.name = params.name ?? null;
    }
    if (params.allowedIps !== undefined) {
      const allowedIps = this.normalizeAllowedIps(params.allowedIps);
      key.allowedIps = allowedIps.length > 0 ? allowedIps : null;
    }

    const saved = await this.apiKeyRepository.save(key);

    await this.audit(AuthAuditEventType.API_KEY_UPDATED, params.userId, 'INFO', { keyId: params.keyId });

    return this.toResponse(saved);
  }

  /**
   * List all keys owned by a user (sanitized; never includes secrets).
   */
  async listKeys(userId: number): Promise<ApiKeyResponseDTO[]> {
    const keys = await this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return keys.map((k) => this.toResponse(k));
  }

  /**
   * Revoke (soft-delete) a key. The record is retained for audit history.
   *
   * @throws {NAuthException} API_KEY_NOT_FOUND
   */
  async revokeKey(params: { userId: number; keyId: string; reason?: string }): Promise<{ success: boolean }> {
    const key = await this.apiKeyRepository.findOne({ where: { keyId: params.keyId, userId: params.userId } });
    if (!key) {
      throw new NAuthException(AuthErrorCode.API_KEY_NOT_FOUND, 'API key not found');
    }

    if (key.isActive) {
      key.isActive = false;
      key.revokedAt = new Date();
      key.revokeReason = params.reason ?? 'user_revoked';
      await this.apiKeyRepository.save(key);
    }

    await this.audit(AuthAuditEventType.API_KEY_REVOKED, params.userId, 'INFO', { keyId: params.keyId });

    return { success: true };
  }

  /**
   * Permanently delete a key.
   *
   * @throws {NAuthException} API_KEY_NOT_FOUND
   */
  async deleteKey(params: { userId: number; keyId: string }): Promise<{ success: boolean }> {
    const key = await this.apiKeyRepository.findOne({ where: { keyId: params.keyId, userId: params.userId } });
    if (!key) {
      throw new NAuthException(AuthErrorCode.API_KEY_NOT_FOUND, 'API key not found');
    }

    await this.apiKeyRepository.remove(key);

    await this.audit(AuthAuditEventType.API_KEY_DELETED, params.userId, 'INFO', { keyId: params.keyId });

    return { success: true };
  }

  /**
   * Validate a presented API key and resolve its owner.
   *
   * On any failure this throws a precise {@link NAuthException} (access denied) — callers
   * MUST NOT fall back to other credentials.
   *
   * @param rawKey - The full plaintext key from the request header
   * @param callerIp - Source IP of the request (for IP-allowlist enforcement + usage tracking)
   * @returns The owning user's identifiers on success
   * @throws {NAuthException} API_KEY_INVALID, API_KEY_EXPIRED, API_KEY_IP_NOT_ALLOWED
   */
  async validateKey(rawKey: string, callerIp?: string | null): Promise<ApiKeyValidationResult> {
    const lookupId = this.parseLookupId(rawKey);
    if (!lookupId) {
      await this.audit(AuthAuditEventType.API_KEY_AUTH_FAILED, null, 'FAILURE', { reason: 'malformed' });
      throw new NAuthException(AuthErrorCode.API_KEY_INVALID, 'Invalid API key');
    }

    const key = await this.apiKeyRepository.findOne({ where: { lookupId } });
    if (!key || !key.isActive || !this.hashesEqual(key.keyHash, this.hashKey(rawKey))) {
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

    // Resolve the owner's external id (sub) so callers can load the shared auth context.
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

    return { keyId: key.keyId, userId: key.userId, sub: owner.sub };
  }

  // ==========================================================================
  // Internal helpers
  // ==========================================================================

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

    // When IP restrictions are disabled, allowlists are ignored entirely.
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
   * Compute the SHA-256 hex hash of a full key string.
   */
  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Constant-time comparison of two equal-length hex hashes.
   */
  private hashesEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    try {
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  /**
   * Extract the non-secret lookup id from a raw key of the form `prefix_lookupId.secret`.
   */
  private parseLookupId(rawKey: string): string | null {
    if (typeof rawKey !== 'string') {
      return null;
    }
    const dotIndex = rawKey.indexOf('.');
    if (dotIndex <= 0) {
      return null;
    }
    const head = rawKey.slice(0, dotIndex); // prefix_lookupId
    const underscoreIndex = head.lastIndexOf('_');
    if (underscoreIndex < 0 || underscoreIndex === head.length - 1) {
      return null;
    }
    return head.slice(underscoreIndex + 1);
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
      return; // Within throttle window - skip write and audit noise.
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
