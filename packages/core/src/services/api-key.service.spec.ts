import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ApiKeyService } from './api-key.service';
import { BaseApiKey } from '../entities/api-key.entity';
import { BaseUser } from '../entities/user.entity';
import { NAuthConfig } from '../interfaces/config.interface';
import { IUser } from '../interfaces/entities.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ContextStorage } from '../utils/context-storage';

/**
 * ApiKeyService Unit Tests
 *
 * Covers self-service (context identity) + admin (sub) methods, mandatory/config-bounded expiry,
 * IP allowlist enforcement, and hash-based validation. Direct instantiation with mocked repos.
 */
describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockApiKeyRepo: jest.Mocked<Repository<BaseApiKey>>;
  let mockUserRepo: jest.Mocked<Repository<BaseUser>>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let savedEntity: BaseApiKey | undefined;

  const VALID_SUB = '550e8400-e29b-41d4-a716-446655440000';
  const VALID_KEY_ID = '660e8400-e29b-41d4-a716-446655440001';
  const CTX_USER = { id: 1, sub: VALID_SUB } as unknown as IUser;
  const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

  const baseConfig: Partial<NAuthConfig> = {
    apiKeys: { enabled: true, allowUserCreation: true, maxKeysPerUser: 10, allowIndefinite: true },
  };

  const build = (config: Partial<NAuthConfig>): ApiKeyService =>
    new ApiKeyService(mockApiKeyRepo, mockUserRepo, config as NAuthConfig, mockLogger);

  /** Run a self-service call with an authenticated user in context. */
  const asUser = <T>(fn: () => Promise<T>, user: IUser = CTX_USER): Promise<T> =>
    ContextStorage.run(async () => {
      ContextStorage.set('CURRENT_USER', user);
      return fn();
    });

  beforeEach(() => {
    savedEntity = undefined;
    mockApiKeyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((obj: Partial<BaseApiKey>) => Object.assign(new BaseApiKey(), obj)),
      save: jest.fn((entity: BaseApiKey) => {
        savedEntity = Object.assign(new BaseApiKey(), entity, { id: 1, createdAt: new Date(), updatedAt: new Date() });
        return Promise.resolve(savedEntity);
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn((e) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<BaseApiKey>>;

    mockUserRepo = {
      findOne: jest.fn((opts) => {
        const where = (opts as unknown as { where?: { sub?: string; id?: number } })?.where ?? {};
        if (where.sub) return Promise.resolve({ id: 1 } as unknown as BaseUser);
        if (where.id) return Promise.resolve({ id: 1, sub: '550e8400-e29b-41d4-a716-446655440000', isActive: true } as unknown as BaseUser);
        return Promise.resolve(null);
      }),
    } as unknown as jest.Mocked<Repository<BaseUser>>;

    mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as unknown as jest.Mocked<
      NAuthLogger
    >;

    service = build(baseConfig);
  });

  describe('self-service createKey (identity from context)', () => {
    it('throws FORBIDDEN when there is no authenticated user', async () => {
      await expect(service.createKey({ expiresInDays: 30 })).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN });
    });

    it('returns a plain key (no prefix) and stores only its SHA-256 hash', async () => {
      const result = await asUser(() => service.createKey({ name: 'CI', expiresInDays: 30 }));
      expect(result.key).toMatch(/^[A-Za-z0-9_-]+$/); // a single base64url token
      expect(result.key.startsWith('nauth_')).toBe(false); // no prefix
      expect(result.key).not.toContain('.'); // no dotted lookupId.secret structure
      expect(savedEntity?.keyHash).toBe(sha256(result.key)); // only the hash is stored
      expect(result.apiKey.name).toBe('CI');
    });

    it('rejects creation when allowUserCreation is false', async () => {
      service = build({ apiKeys: { enabled: true, allowUserCreation: false } });
      await expect(asUser(() => service.createKey({ expiresInDays: 30 }))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_CREATION_DISABLED,
      });
    });

    it('requires an explicit expiry', async () => {
      await expect(asUser(() => service.createKey({}))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_EXPIRY_REQUIRED,
      });
    });

    it('rejects never-expiry when allowIndefinite is false', async () => {
      service = build({ apiKeys: { enabled: true, allowUserCreation: true, allowIndefinite: false } });
      await expect(asUser(() => service.createKey({ expiresInDays: null }))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_INDEFINITE_NOT_ALLOWED,
      });
    });

    it('enforces maxExpiryDays', async () => {
      service = build({ apiKeys: { enabled: true, allowUserCreation: true, maxExpiryDays: 90 } });
      await expect(asUser(() => service.createKey({ expiresInDays: 365 }))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_EXPIRY_TOO_LONG,
      });
    });

    it('enforces maxKeysPerUser', async () => {
      mockApiKeyRepo.count.mockResolvedValue(10);
      await expect(asUser(() => service.createKey({ expiresInDays: 30 }))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_LIMIT_REACHED,
      });
    });

    it('rejects invalid IP allowlist entries', async () => {
      await expect(asUser(() => service.createKey({ expiresInDays: 30, allowedIps: ['nope'] }))).rejects.toMatchObject({
        code: AuthErrorCode.VALIDATION_FAILED,
      });
    });
  });

  describe('admin methods (identity by sub)', () => {
    it('adminCreateKey resolves the sub and bypasses allowUserCreation', async () => {
      service = build({ apiKeys: { enabled: true, allowUserCreation: false } });
      const result = await service.adminCreateKey({ sub: VALID_SUB, expiresInDays: 30 });
      expect(result.key).toBeTruthy();
      expect(result.apiKey.createdByAdmin).toBe(true);
    });

    it('adminCreateKey throws USER_NOT_FOUND for an unknown sub', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.adminCreateKey({ sub: VALID_SUB, expiresInDays: 30 })).rejects.toMatchObject({
        code: AuthErrorCode.USER_NOT_FOUND,
      });
    });

    it('adminRevokeKey requires a keyId', async () => {
      await expect(service.adminRevokeKey({ sub: VALID_SUB })).rejects.toMatchObject({
        code: AuthErrorCode.VALIDATION_FAILED,
      });
    });
  });

  describe('validateKey (hash lookup)', () => {
    const createAndWire = async (overrides?: Partial<BaseApiKey>, allowedIps?: string[]): Promise<string> => {
      const result = await asUser(() => service.createKey({ expiresInDays: 30, allowedIps }));
      const entity = Object.assign(savedEntity as BaseApiKey, overrides ?? {});
      mockApiKeyRepo.findOne.mockImplementation((opts) => {
        const where = (opts as unknown as { where?: { keyHash?: string; keyId?: string } })?.where ?? {};
        if (where.keyHash && where.keyHash === entity.keyHash) return Promise.resolve(entity);
        if (where.keyId && where.keyId === entity.keyId) return Promise.resolve(entity);
        return Promise.resolve(null);
      });
      return result.key;
    };

    it('resolves the owner for a valid key', async () => {
      const key = await createAndWire();
      const res = await service.validateKey(key, '203.0.113.9');
      expect(res.keyId).toBeTruthy();
      expect(res.sub).toBe(VALID_SUB);
    });

    it('rejects an unknown key with API_KEY_INVALID', async () => {
      await createAndWire();
      await expect(service.validateKey('totally-unknown-key', '1.2.3.4')).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_INVALID,
      });
    });

    it('rejects an expired key', async () => {
      const key = await createAndWire({ expiresAt: new Date(Date.now() - 1000) });
      await expect(service.validateKey(key, '1.2.3.4')).rejects.toMatchObject({ code: AuthErrorCode.API_KEY_EXPIRED });
    });

    it('rejects a revoked/inactive key', async () => {
      const key = await createAndWire({ isActive: false });
      await expect(service.validateKey(key, '1.2.3.4')).rejects.toMatchObject({ code: AuthErrorCode.API_KEY_INVALID });
    });

    it('enforces the IP allowlist', async () => {
      const key = await createAndWire(undefined, ['10.0.0.0/8']);
      await expect(service.validateKey(key, '10.1.2.3')).resolves.toMatchObject({ sub: VALID_SUB });
      await expect(service.validateKey(key, '203.0.113.4')).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_IP_NOT_ALLOWED,
      });
    });
  });

  describe('listKeys / updateKey', () => {
    it('listKeys returns a response DTO wrapping the array', async () => {
      mockApiKeyRepo.find.mockResolvedValue([
        Object.assign(new BaseApiKey(), { keyId: 'k', isActive: true, createdByAdmin: false, usageCount: 0, createdAt: new Date() }),
      ]);
      const res = await asUser(() => service.listKeys());
      expect(Array.isArray(res.apiKeys)).toBe(true);
      expect(res.apiKeys).toHaveLength(1);
    });

    it('updateKey replaces the IP allowlist', async () => {
      const entity = Object.assign(new BaseApiKey(), {
        id: 1,
        keyId: VALID_KEY_ID,
        userId: 1,
        isActive: true,
        createdByAdmin: false,
        usageCount: 0,
        createdAt: new Date(),
      });
      mockApiKeyRepo.findOne.mockResolvedValue(entity);
      const res = await asUser(() => service.updateKey({ keyId: VALID_KEY_ID, allowedIps: ['203.0.113.5'] }));
      expect(res.allowedIps).toEqual(['203.0.113.5']);
    });

    it('updateKey throws API_KEY_NOT_FOUND when missing', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue(null);
      await expect(asUser(() => service.updateKey({ keyId: VALID_KEY_ID }))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_NOT_FOUND,
      });
    });
  });

  it('is defined', () => {
    expect(service).toBeInstanceOf(ApiKeyService);
  });
});
