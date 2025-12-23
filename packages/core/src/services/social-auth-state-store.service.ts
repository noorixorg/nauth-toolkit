import * as crypto from 'crypto';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthException } from '../exceptions/nauth.exception';
import { ISocialAuthStateStore, SocialAuthRedirectContext } from '../interfaces/social-auth-state-store.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthLogger } from '../utils/nauth-logger';

/**
 * StorageAdapter-backed social OAuth state store
 *
 * Replaces in-memory `Map` usage for OAuth CSRF state to support multi-server deployments.
 *
 * This implementation stores:
 * - CSRF state record (provider + createdAt) under a short TTL
 * - Redirect context record (returnTo/appState/action) under the same TTL (optional)
 *
 * Replay protection:
 * - Uses a separate `used` marker key with `{ nx: true }` so both Redis and Database adapters
 *   can enforce one-time consumption without requiring special atomic commands.
 *
 * @example
 * ```typescript
 * const store = new SocialAuthStateStore(storageAdapter, logger);
 * const state = await store.createCsrfState('google');
 * await store.setRedirectContext(state, { returnTo: '/auth/callback', appState: '12345', action: 'login' });
 * // later during callback:
 * await store.validateAndConsumeCsrfState('google', state);
 * const ctx = await store.consumeRedirectContext(state);
 * ```
 */
export class SocialAuthStateStore implements ISocialAuthStateStore {
  private readonly ttlSeconds: number;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly logger?: NAuthLogger,
    ttlSeconds: number = 5 * 60,
  ) {
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Create a CSRF state token and persist it for one-time validation.
   */
  async createCsrfState(provider: string): Promise<string> {
    const normalizedProvider = this.normalizeProvider(provider);
    const state = crypto.randomBytes(32).toString('hex');

    const key = this.getCsrfKey(state);
    const value = JSON.stringify({
      provider: normalizedProvider,
      createdAt: Date.now(),
    } satisfies { provider: string; createdAt: number });

    await this.storage.set(key, value, this.ttlSeconds);
    return state;
  }

  /**
   * Validate and consume CSRF state (one-time).
   */
  async validateAndConsumeCsrfState(provider: string, state: string): Promise<void> {
    const normalizedProvider = this.normalizeProvider(provider);
    const normalizedState = this.normalizeState(state);

    // ============================================================================
    // Replay protection: mark state as used (NX) before reading record
    // ============================================================================
    // This avoids race conditions where two callbacks try to validate the same state.
    // Both Redis and DB adapters support nx semantics.
    const usedKey = this.getUsedKey(normalizedState);
    const usedSetResult = await this.storage.set(usedKey, '1', this.ttlSeconds, { nx: true });
    if (usedSetResult === null) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' });
    }

    const key = this.getCsrfKey(normalizedState);
    const raw = await this.storage.get(key);
    if (!raw) {
      // Missing/expired state
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' });
    }

    const parsed = this.safeParseCsrfRecord(raw);
    if (parsed.provider !== normalizedProvider) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'State provider mismatch', { field: 'state' });
    }

    // TTL should enforce expiry, but we keep an explicit check for DB edge cases
    if (Date.now() - parsed.createdAt > this.ttlSeconds * 1000) {
      // Clean up record to reduce storage pressure
      await this.storage.del(key);
      throw new NAuthException(AuthErrorCode.CHALLENGE_EXPIRED, 'State parameter expired');
    }

    // Consume (one-time): remove the CSRF record
    await this.storage.del(key);
  }

  /**
   * Persist redirect context for a CSRF state token.
   */
  async setRedirectContext(state: string, context: SocialAuthRedirectContext): Promise<void> {
    const normalizedState = this.normalizeState(state);
    const key = this.getRedirectKey(normalizedState);

    const payload = JSON.stringify({
      returnTo: this.normalizeReturnTo(context.returnTo),
      appState: context.appState,
      delivery: context.delivery,
      action: context.action,
      createdAt: Date.now(),
    } satisfies {
      returnTo: string;
      appState?: string;
      delivery?: 'cookies' | 'json';
      action: 'login' | 'link';
      createdAt: number;
    });

    await this.storage.set(key, payload, this.ttlSeconds);
  }

  /**
   * Consume redirect context (read + delete).
   */
  async consumeRedirectContext(state: string): Promise<SocialAuthRedirectContext | null> {
    const normalizedState = this.normalizeState(state);
    const key = this.getRedirectKey(normalizedState);
    const raw = await this.storage.get(key);
    if (!raw) {
      return null;
    }

    const parsed = this.safeParseRedirectRecord(raw);

    // TTL should enforce expiry, but keep explicit check and cleanup
    if (Date.now() - parsed.createdAt > this.ttlSeconds * 1000) {
      await this.storage.del(key);
      return null;
    }

    await this.storage.del(key);
    return {
      returnTo: parsed.returnTo,
      appState: parsed.appState,
      delivery: parsed.delivery,
      action: parsed.action,
    };
  }

  // ============================================================================
  // Key helpers
  // ============================================================================

  private getCsrfKey(state: string): string {
    return `social:oauth_csrf:${state}`;
  }

  private getUsedKey(state: string): string {
    return `social:oauth_csrf_used:${state}`;
  }

  private getRedirectKey(state: string): string {
    return `social:oauth_redirect:${state}`;
  }

  // ============================================================================
  // Validation helpers
  // ============================================================================

  private normalizeProvider(provider: string): string {
    if (typeof provider !== 'string') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Provider must be a string', { field: 'provider' });
    }
    const p = provider.trim().toLowerCase();
    if (!p) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Provider is required', { field: 'provider' });
    }
    return p;
  }

  private normalizeState(state: string): string {
    if (typeof state !== 'string') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'State must be a string', { field: 'state' });
    }
    const s = state.trim();
    if (!s) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'State is required', { field: 'state' });
    }
    if (s.length > 500) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'State parameter too long', { field: 'state' });
    }
    return s;
  }

  private normalizeReturnTo(returnTo: string): string {
    if (typeof returnTo !== 'string') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'returnTo must be a string', { field: 'returnTo' });
    }
    const v = returnTo.trim();
    if (!v) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'returnTo is required', { field: 'returnTo' });
    }
    // NOTE: Additional open-redirect policy enforcement is implemented at controller level.
    return v;
  }

  private safeParseCsrfRecord(raw: string): { provider: string; createdAt: number } {
    const obj = this.safeParseJsonObject(raw, 'state');
    const provider = obj.provider;
    const createdAt = obj.createdAt;

    if (typeof provider !== 'string' || !provider.trim()) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' });
    }
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' });
    }
    return { provider: provider.trim().toLowerCase(), createdAt };
  }

  private safeParseRedirectRecord(raw: string): {
    returnTo: string;
    appState?: string;
    delivery?: 'cookies' | 'json';
    action: 'login' | 'link';
    createdAt: number;
  } {
    const obj = this.safeParseJsonObject(raw, 'state');
    const returnTo = obj.returnTo;
    const appState = obj.appState;
    const delivery = obj.delivery;
    const action = obj.action;
    const createdAt = obj.createdAt;

    if (typeof returnTo !== 'string' || !returnTo.trim()) {
      return { returnTo: '/', action: 'login', createdAt: 0 };
    }
    if (action !== 'login' && action !== 'link') {
      return { returnTo: returnTo.trim(), action: 'login', createdAt: 0 };
    }
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) {
      return { returnTo: returnTo.trim(), action, createdAt: 0 };
    }
    if (appState !== undefined && typeof appState !== 'string') {
      return { returnTo: returnTo.trim(), action, createdAt };
    }
    if (delivery !== undefined && delivery !== 'cookies' && delivery !== 'json') {
      return { returnTo: returnTo.trim(), appState, action, createdAt };
    }
    return { returnTo: returnTo.trim(), appState, delivery, action, createdAt };
  }

  private safeParseJsonObject(raw: string, field: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field });
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      // Don't leak raw payload; only log in debug.
      this.logger?.debug?.(`[SocialAuthStateStore] Failed to parse ${field} record`, { error });
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field });
    }
  }
}
