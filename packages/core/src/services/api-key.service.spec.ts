import { Repository } from 'typeorm';
import { ApiKeyService } from './api-key.service';
import { BaseApiKey } from '../entities/api-key.entity';
import { BaseUser } from '../entities/user.entity';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * ApiKeyService Unit Tests
 *
 * Covers key creation (rights, limits, mandatory expiry), IP allowlist enforcement,
 * validation (valid/invalid/expired/IP-blocked), and update. Platform-agnostic:
 * direct instantiation with mocked repositories.
 */
describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockApiKeyRepo: jest.Mocked<Repository<BaseApiKey>>;
  let mockUserRepo: jest.Mocked<Repository<BaseUser>>;
  let mockLogger: jest.Mocked<NAuthLogger>;

  // Captures the entity handed to create()/save() so tests can reconstruct hashes.
  let savedEntity: BaseApiKey | undefined;

  const baseConfig: Partial<NAuthConfig> = {
    apiKeys: {
      enabled: true,
      allowUserCreation: true,
      maxKeysPerUser: 10,
      allowIndefinite: true,
    },
  };

  const buildService = (config: Partial<NAuthConfig>): ApiKeyService =>
    new ApiKeyService(mockApiKeyRepo, mockUserRepo, config as NAuthConfig, mockLogger);

  beforeEach(() => {
    savedEntity = undefined;
    mockApiKeyRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((obj: Partial<BaseApiKey>) => {
        const entity = Object.assign(new BaseApiKey(), obj);
        return entity;
      }),
      save: jest.fn((entity: BaseApiKey) => {
        savedEntity = Object.assign(new BaseApiKey(), entity, {
          id: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return Promise.resolve(savedEntity);
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn((e) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<BaseApiKey>>;

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
    } as unknown as jest.Mocked<Repository<BaseUser>>;

    mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as unknown as jest.Mocked<
      NAuthLogger
    >;

    service = buildService(baseConfig);
  });

  describe('createKey - rights & limits', () => {
    it('rejects user creation when allowUserCreation is false', async () => {
      service = buildService({ apiKeys: { enabled: true, allowUserCreation: false } });
      await expect(service.createKey({ userId: 1, expiresInDays: 30 })).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_CREATION_DISABLED,
      });
    });

    it('allows admin creation even when allowUserCreation is false', async () => {
      service = buildService({ apiKeys: { enabled: true, allowUserCreation: false } });
      const result = await service.createKey({ userId: 1, expiresInDays: 30, createdByAdmin: true });
      expect(result.key).toBeTruthy();
      expect(result.apiKey.createdByAdmin).toBe(true);
    });

    it('enforces maxKeysPerUser', async () => {
      mockApiKeyRepo.count.mockResolvedValue(10);
      await expect(service.createKey({ userId: 1, expiresInDays: 30 })).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_LIMIT_REACHED,
      });
    });

    it('returns a plaintext key and never persists it', async () => {
      const result = await service.createKey({ userId: 1, name: 'CI', expiresInDays: 30 });
      expect(result.key).toContain('nauth_');
      expect(result.apiKey.name).toBe('CI');
      // The persisted entity holds only the hash, not the plaintext.
      expect(savedEntity?.keyHash).toBeTruthy();
      expect(result.key).not.toEqual(savedEntity?.keyHash);
    });
  });

  describe('createKey - mandatory expiry', () => {
    it('rejects when expiresInDays is omitted', async () => {
      await expect(service.createKey({ userId: 1 })).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_EXPIRY_REQUIRED,
      });
    });

    it('allows a never-expiring key when allowIndefinite is true', async () => {
      const result = await service.createKey({ userId: 1, expiresInDays: null });
      expect(result.apiKey.expiresAt).toBeNull();
    });

    it('rejects a never-expiring key when allowIndefinite is false', async () => {
      service = buildService({ apiKeys: { enabled: true, allowUserCreation: true, allowIndefinite: false } });
      await expect(service.createKey({ userId: 1, expiresInDays: null })).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_INDEFINITE_NOT_ALLOWED,
      });
    });

    it('rejects expiry exceeding maxExpiryDays', async () => {
      service = buildService({ apiKeys: { enabled: true, allowUserCreation: true, maxExpiryDays: 90 } });
      await expect(service.createKey({ userId: 1, expiresInDays: 365 })).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_EXPIRY_TOO_LONG,
      });
    });

    it('sets a finite expiry within the cap', async () => {
      const result = await service.createKey({ userId: 1, expiresInDays: 30 });
      expect(result.apiKey.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('createKey - IP restrictions', () => {
    it('rejects invalid IP/CIDR entries', async () => {
      await expect(
        service.createKey({ userId: 1, expiresInDays: 30, allowedIps: ['not-an-ip'] }),
      ).rejects.toMatchObject({ code: AuthErrorCode.VALIDATION_FAILED });
    });

    it('accepts valid IPs and CIDR ranges', async () => {
      const result = await service.createKey({
        userId: 1,
        expiresInDays: 30,
        allowedIps: ['203.0.113.4', '10.0.0.0/8'],
      });
      expect(result.apiKey.allowedIps).toEqual(['203.0.113.4', '10.0.0.0/8']);
    });

    it('requires an allowlist when requireForNewKeys is true', async () => {
      service = buildService({
        apiKeys: { enabled: true, allowUserCreation: true, ipRestrictions: { requireForNewKeys: true } },
      });
      await expect(service.createKey({ userId: 1, expiresInDays: 30 })).rejects.toMatchObject({
        code: AuthErrorCode.VALIDATION_FAILED,
      });
    });

    it('ignores allowlist when IP restrictions are disabled', async () => {
      service = buildService({
        apiKeys: { enabled: true, allowUserCreation: true, ipRestrictions: { enabled: false } },
      });
      const result = await service.createKey({ userId: 1, expiresInDays: 30, allowedIps: ['203.0.113.4'] });
      expect(result.apiKey.allowedIps).toBeNull();
    });
  });

  describe('validateKey', () => {
    /** Create a key, then wire the repo to return the persisted entity by lookupId. */
    const createAndWire = async (overrides?: Partial<BaseApiKey>, allowedIps?: string[]): Promise<string> => {
      const result = await service.createKey({ userId: 1, expiresInDays: 30, allowedIps });
      const entity = Object.assign(savedEntity as BaseApiKey, overrides ?? {});
      mockApiKeyRepo.findOne.mockImplementation((opts) => {
        const where = (opts as { where?: { lookupId?: string } })?.where;
        if (where?.lookupId && where.lookupId === entity.lookupId) {
          return Promise.resolve(entity);
        }
        return Promise.resolve(null);
      });
      mockUserRepo.findOne.mockResolvedValue({ id: 1, sub: 'user-sub-uuid', isActive: true } as unknown as BaseUser);
      return result.key;
    };

    it('resolves the owner for a valid key', async () => {
      const key = await createAndWire();
      const res = await service.validateKey(key, '203.0.113.9');
      expect(res.userId).toBe(1);
      expect(res.sub).toBe('user-sub-uuid');
    });

    it('rejects an invalid key with API_KEY_INVALID', async () => {
      await createAndWire();
      await expect(service.validateKey('nauth_deadbeef.invalidsecret', '1.2.3.4')).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_INVALID,
      });
    });

    it('rejects an expired key with API_KEY_EXPIRED', async () => {
      const key = await createAndWire({ expiresAt: new Date(Date.now() - 1000) });
      await expect(service.validateKey(key, '1.2.3.4')).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_EXPIRED,
      });
    });

    it('rejects a revoked/inactive key', async () => {
      const key = await createAndWire({ isActive: false });
      await expect(service.validateKey(key, '1.2.3.4')).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_INVALID,
      });
    });

    it('enforces the IP allowlist', async () => {
      const key = await createAndWire(undefined, ['10.0.0.0/8']);
      // Allowed
      await expect(service.validateKey(key, '10.1.2.3')).resolves.toMatchObject({ userId: 1 });
      // Blocked
      await expect(service.validateKey(key, '203.0.113.4')).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_IP_NOT_ALLOWED,
      });
    });
  });

  describe('updateKey', () => {
    it('updates the IP allowlist', async () => {
      const entity = Object.assign(new BaseApiKey(), {
        id: 1,
        keyId: 'key-uuid',
        userId: 1,
        isActive: true,
        createdByAdmin: false,
        usageCount: 0,
        createdAt: new Date(),
      });
      mockApiKeyRepo.findOne.mockResolvedValue(entity);
      const res = await service.updateKey({ userId: 1, keyId: 'key-uuid', allowedIps: ['203.0.113.5'] });
      expect(res.allowedIps).toEqual(['203.0.113.5']);
    });

    it('throws API_KEY_NOT_FOUND when the key is missing', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue(null);
      await expect(service.updateKey({ userId: 1, keyId: 'missing', allowedIps: [] })).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_NOT_FOUND,
      });
    });
  });

  it('is defined', () => {
    expect(service).toBeInstanceOf(ApiKeyService);
    expect(NAuthException).toBeDefined();
  });
});
