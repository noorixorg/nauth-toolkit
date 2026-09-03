import type { Adapter, AdapterPayload } from 'oidc-provider';
import type { StorageAdapter } from '@nauth-toolkit/core';

/** Prefix for every key this adapter owns, so it never collides with other storage users. */
const NS = 'oidc';

/**
 * Models whose payload carries a `grantId`. Only these need the grant marker that
 * backs `revokeByGrantId`.
 */
const GRANTABLE = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

/** Models looked up by `uid` rather than by id. */
const UID_INDEXED = new Set(['Session', 'Interaction']);

/**
 * Build an `oidc-provider` storage adapter over nauth's {@link StorageAdapter}.
 *
 * **This needs no database tables.** Every model `oidc-provider` persists is
 * TTL-bounded, which is exactly what `StorageAdapter` is for — the same reasoning
 * that put authorization codes there rather than in a table.
 *
 * Secondary lookups (`findByUid`, `findByUserCode`) and grant revocation are built
 * from **marker keys carrying their own TTL**, not from the adapter's `hset`/`lpush`
 * operations. Those are deliberately avoided: `DatabaseStorageAdapter` writes them to
 * internally re-prefixed keys (`hash:`/`list:`) with **no expiry**, and `del`/`expire`
 * operate on the un-prefixed key — so an index built on them would leak forever and
 * could not be reaped through the interface.
 *
 * Key scheme:
 * ```
 * oidc:{model}:{id}                 → JSON payload
 * oidc:{model}:uid:{uid}            → id            (Session, Interaction)
 * oidc:DeviceCode:uc:{userCode}     → id
 * oidc:g:{grantId}:{model}:{id}     → '1'           (swept by revokeByGrantId)
 * oidc:acct:{accountId}:{model}:{id} → '1'          (swept when a user logs out)
 * ```
 *
 * @param storage - The nauth storage adapter (Redis in production, Database or Memory otherwise)
 * @returns A factory `oidc-provider` calls once per model name
 *
 * @example
 * ```typescript
 * new Provider(issuer, { adapter: createOIDCStorageAdapter(nauth.storage) });
 * ```
 */
export function createOIDCStorageAdapter(storage: StorageAdapter): (name: string) => Adapter {
  return (name: string): Adapter => new NAuthOIDCAdapter(name, storage);
}

/**
 * `oidc-provider` adapter for one model, backed by nauth's storage abstraction.
 */
export class NAuthOIDCAdapter implements Adapter {
  constructor(
    private readonly name: string,
    private readonly storage: StorageAdapter,
  ) {}

  /**
   * Create or replace a model instance, plus whatever secondary markers it needs.
   *
   * Every marker is written with the *same* TTL as the payload, so the index can
   * never outlive what it points at.
   */
  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const ttl = expiresIn > 0 ? expiresIn : undefined;
    await this.storage.set(this.key(id), JSON.stringify(payload), ttl);

    if (UID_INDEXED.has(this.name) && payload.uid) {
      await this.storage.set(`${NS}:${this.name}:uid:${payload.uid}`, id, ttl);
    }
    if (this.name === 'DeviceCode' && payload.userCode) {
      await this.storage.set(`${NS}:DeviceCode:uc:${payload.userCode}`, id, ttl);
    }
    if (GRANTABLE.has(this.name) && payload.grantId) {
      await this.storage.set(`${NS}:g:${payload.grantId}:${this.name}:${id}`, '1', ttl);
    }
    if (payload.accountId) {
      await this.storage.set(`${NS}:acct:${payload.accountId}:${this.name}:${id}`, '1', ttl);
    }
  }

  /**
   * Load a model instance by id, or undefined once it has expired or been destroyed.
   */
  async find(id: string): Promise<AdapterPayload | undefined> {
    return this.read(this.key(id));
  }

  /**
   * Load a Session or Interaction by its `uid`.
   */
  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const id = await this.storage.get(`${NS}:${this.name}:uid:${uid}`);
    return id ? this.read(this.key(id)) : undefined;
  }

  /**
   * Load a DeviceCode by the code the end user typed in.
   */
  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const id = await this.storage.get(`${NS}:DeviceCode:uc:${userCode}`);
    return id ? this.read(this.key(id)) : undefined;
  }

  /**
   * Mark a single-use artifact as spent, preserving its remaining lifetime.
   *
   * Read-modify-write is safe here: `consumed` is a monotonic marker, so a lost
   * update cannot un-consume anything. `oidc-provider`'s actual replay defence is its
   * separate `ReplayDetection` model, not this flag.
   */
  async consume(id: string): Promise<void> {
    const key = this.key(id);
    const payload = await this.read(key);
    if (!payload) {
      return;
    }
    const remaining = await this.storage.ttl(key);
    payload.consumed = Math.floor(Date.now() / 1000);
    await this.storage.set(key, JSON.stringify(payload), remaining > 0 ? remaining : undefined);
  }

  /**
   * Delete a model instance.
   */
  async destroy(id: string): Promise<void> {
    await this.storage.del(this.key(id));
  }

  /**
   * Revoke every artifact issued under a grant.
   *
   * Sweeps the grant's marker keys and deletes both the marker and the payload it
   * points at. This is how a consent withdrawal, or `oidc-provider`'s own refresh
   * replay detection, cascades across access tokens, refresh tokens and codes.
   */
  async revokeByGrantId(grantId: string): Promise<void> {
    await this.sweep(`${NS}:g:${grantId}:*`);
  }

  /**
   * Delete every artifact of this model belonging to an account.
   *
   * Not part of `oidc-provider`'s Adapter contract — used by the single-logout helper
   * so that ending a nauth session can also end the provider's own SSO session.
   *
   * @internal
   */
  async revokeByAccountId(accountId: string): Promise<number> {
    return this.sweep(`${NS}:acct:${accountId}:*`);
  }

  /**
   * Delete the payloads named by a set of marker keys, then the markers.
   *
   * A marker is `{prefix}:{model}:{id}`, and ids may themselves contain colons, so the
   * model and id are recovered by splitting off the fixed leading segments rather than
   * by splitting the whole key.
   */
  private async sweep(pattern: string): Promise<number> {
    const markers = await this.storage.keys(pattern);
    const leading = pattern.replace(/\*$/, '').split(':').length - 1;

    let removed = 0;
    for (const marker of markers) {
      const parts = marker.split(':');
      const model = parts[leading];
      const id = parts.slice(leading + 1).join(':');
      if (model && id) {
        await this.storage.del(`${NS}:${model}:${id}`);
        removed += 1;
      }
      await this.storage.del(marker);
    }
    return removed;
  }

  /**
   * Read and parse a payload, treating unparseable data as absent.
   */
  private async read(key: string): Promise<AdapterPayload | undefined> {
    const raw = await this.storage.get(key);
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as AdapterPayload;
    } catch {
      return undefined;
    }
  }

  /**
   * Storage key for a model instance.
   */
  private key(id: string): string {
    return `${NS}:${this.name}:${id}`;
  }
}
