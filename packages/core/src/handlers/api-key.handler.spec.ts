import { ApiKeyHandler } from './api-key.handler';
import { ApiKeyService } from '../services/api-key.service';
import { AuthService } from '../services/auth.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ContextStorage } from '../utils/context-storage';

/**
 * ApiKeyHandler Unit Tests
 *
 * Focus: the strict-vs-optional behavior that mirrors the JWT path. A key on a protected route is
 * strict (invalid ⇒ throw). A key on a `@Public()` route is best-effort identification (valid ⇒
 * attach user; invalid/absent ⇒ proceed unauthenticated, never throw).
 */
describe('ApiKeyHandler', () => {
  const SUB = '550e8400-e29b-41d4-a716-446655440000';
  const KEY_ID = '660e8400-e29b-41d4-a716-446655440001';

  let apiKeyService: jest.Mocked<Pick<ApiKeyService, 'validateKey'>>;
  let authService: jest.Mocked<Pick<AuthService, 'getUserForAuthContext'>>;
  let logger: jest.Mocked<NAuthLogger>;
  let next: jest.Mock;

  const config: Partial<NAuthConfig> = { apiKeys: { enabled: true, header: 'X-API-Key' } };

  const build = (): ApiKeyHandler =>
    new ApiKeyHandler(
      apiKeyService as unknown as ApiKeyService,
      authService as unknown as AuthService,
      config as NAuthConfig,
      logger,
    );

  const makeReq = (opts: { key?: string; nauthPublic?: boolean } = {}): NAuthRequest => {
    const headers: Record<string, string> = {};
    if (opts.key !== undefined) headers['x-api-key'] = opts.key;
    return {
      attributes: opts.nauthPublic ? { nauthPublic: true } : {},
      getHeader: (name: string): string | undefined => headers[name.toLowerCase()],
    } as unknown as NAuthRequest;
  };

  const run = (handler: ApiKeyHandler, req: NAuthRequest): Promise<void> =>
    ContextStorage.run(() => handler.handle(req, {} as NAuthResponse, next));

  beforeEach(() => {
    apiKeyService = { validateKey: jest.fn() } as unknown as jest.Mocked<Pick<ApiKeyService, 'validateKey'>>;
    authService = {
      getUserForAuthContext: jest.fn().mockResolvedValue({ id: 1, sub: SUB }),
    } as unknown as jest.Mocked<Pick<AuthService, 'getUserForAuthContext'>>;
    logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as unknown as jest.Mocked<
      NAuthLogger
    >;
    next = jest.fn().mockResolvedValue(undefined);
  });

  it('is a no-op when the feature is disabled', async () => {
    const handler = new ApiKeyHandler(
      apiKeyService as unknown as ApiKeyService,
      authService as unknown as AuthService,
      { apiKeys: { enabled: false } } as NAuthConfig,
      logger,
    );
    await run(handler, makeReq({ key: 'anything' }));
    expect(apiKeyService.validateKey).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls through when no key header is present', async () => {
    await run(build(), makeReq());
    expect(apiKeyService.validateKey).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  describe('protected route (strict)', () => {
    it('attaches the user for a valid key', async () => {
      apiKeyService.validateKey.mockResolvedValue({ keyId: KEY_ID, sub: SUB });
      const req = makeReq({ key: 'good' });
      await run(build(), req);
      expect(req.attributes.user).toMatchObject({ sub: SUB });
      expect(req.attributes.nauthApiKeyAuth).toBe(true);
      expect(req.attributes.nauthApiKeyId).toBe(KEY_ID);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('throws on an invalid key (no fallback)', async () => {
      apiKeyService.validateKey.mockRejectedValue(new NAuthException(AuthErrorCode.API_KEY_INVALID, 'bad'));
      await expect(run(build(), makeReq({ key: 'bad' }))).rejects.toMatchObject({
        code: AuthErrorCode.API_KEY_INVALID,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('public route (optional identification)', () => {
    it('identifies the user when the key is valid', async () => {
      apiKeyService.validateKey.mockResolvedValue({ keyId: KEY_ID, sub: SUB });
      const req = makeReq({ key: 'good', nauthPublic: true });
      await run(build(), req);
      expect(req.attributes.user).toMatchObject({ sub: SUB });
      expect(req.attributes.nauthApiKeyAuth).toBe(true);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('tolerates an invalid key without throwing', async () => {
      apiKeyService.validateKey.mockRejectedValue(new NAuthException(AuthErrorCode.API_KEY_INVALID, 'bad'));
      const req = makeReq({ key: 'bad', nauthPublic: true });
      await expect(run(build(), req)).resolves.toBeUndefined();
      expect(req.attributes.user).toBeUndefined();
      expect(req.attributes.nauthApiKeyAuth).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
