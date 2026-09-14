import 'reflect-metadata';
import { NAuthLogger, NAuthException, NAuthConfig, AuthErrorCode } from '@nauth-toolkit/core';
import { TokenVerifierService } from './token-verifier.service';
import { MSA_TENANT_ID } from './entra-tenant';

type JoseModule = typeof import('jose');

const TENANT_GUID = '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f';
const OTHER_TENANT = 'aaaabbbb-cccc-dddd-eeee-ffff00001111';

/**
 * Build a verified-JWT payload as jose would return it.
 */
function payloadFor(overrides: Record<string, unknown> = {}): { payload: Record<string, unknown> } {
  const tid = (overrides.tid as string) ?? TENANT_GUID;
  return {
    payload: {
      sub: 'pairwise-subject',
      oid: 'object-id-123',
      tid,
      iss: `https://login.microsoftonline.com/${tid}/v2.0`,
      aud: 'test-client-id',
      email: 'ada@contoso.com',
      ...overrides,
    },
  };
}

/**
 * Microsoft Token Verifier unit tests
 *
 * The verifier is the security boundary for this provider: it is what turns "some
 * Microsoft directory signed this" into "this specific directory vouches for this user",
 * so the issuer binding and tenant allowlist are covered directly rather than inferred.
 */
describe('TokenVerifierService (Microsoft)', () => {
  let service: TokenVerifierService;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;
  let jwtVerify: jest.Mock;
  let createRemoteJWKSet: jest.Mock;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      verbose: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
      isPiiRedactionEnabled: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<NAuthLogger>;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      logger: mockLogger,
    } as NAuthConfig;

    jwtVerify = jest.fn().mockResolvedValue(payloadFor());
    createRemoteJWKSet = jest.fn().mockReturnValue('jwks-handle');

    const fakeJose = { jwtVerify, createRemoteJWKSet } as unknown as JoseModule;
    service = new TokenVerifierService(mockConfig, async () => fakeJose);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('returns the claims the provider depends on', async () => {
      const profile = await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID });

      expect(profile.oid).toBe('object-id-123');
      expect(profile.tid).toBe(TENANT_GUID);
      expect(profile.sub).toBe('pairwise-subject');
      expect(profile.email).toBe('ada@contoso.com');
    });

    it('tries each configured audience until one verifies', async () => {
      jwtVerify.mockRejectedValueOnce(new Error('bad audience')).mockResolvedValueOnce(payloadFor());

      const profile = await service.verifyMicrosoftToken('token', ['web-id', 'native-id'], { tenant: TENANT_GUID });

      expect(profile.oid).toBe('object-id-123');
      expect(jwtVerify).toHaveBeenCalledTimes(2);
    });

    it('caches the JWKS handle across calls', async () => {
      await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID });
      await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID });

      expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
    });

    it('uses the pinned directory key set', async () => {
      await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID });

      expect(createRemoteJWKSet.mock.calls[0][0].toString()).toBe(
        `https://login.microsoftonline.com/${TENANT_GUID}/discovery/v2.0/keys`,
      );
    });
  });

  describe('issuer binding', () => {
    it('rejects a token whose issuer does not match its own tenant claim', async () => {
      // The nOAuth shape: a validly-signed token from an attacker-controlled directory,
      // relabelled with a tid it did not come from.
      jwtVerify.mockResolvedValue(
        payloadFor({ tid: TENANT_GUID, iss: `https://login.microsoftonline.com/${OTHER_TENANT}/v2.0` }),
      );

      await expect(service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID })).rejects.toThrow(
        NAuthException,
      );
    });

    it('rejects a token with no issuer at all', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ iss: undefined }));

      await expect(service.verifyMicrosoftToken('token', 'test-client-id')).rejects.toThrow(NAuthException);
    });
  });

  describe('tenant restriction', () => {
    it('denies a directory that is not the pinned tenant', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ tid: OTHER_TENANT }));

      await expect(
        service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID }),
      ).rejects.toMatchObject({ code: AuthErrorCode.SOCIAL_ACCESS_DENIED });
    });

    it('admits a directory named in allowedTenants', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ tid: OTHER_TENANT }));

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id', {
        tenant: 'organizations',
        allowedTenants: [OTHER_TENANT],
      });

      expect(profile.tid).toBe(OTHER_TENANT);
    });

    it('denies a directory absent from allowedTenants', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ tid: OTHER_TENANT }));

      await expect(
        service.verifyMicrosoftToken('token', 'test-client-id', {
          tenant: 'organizations',
          allowedTenants: [TENANT_GUID],
        }),
      ).rejects.toMatchObject({ code: AuthErrorCode.SOCIAL_ACCESS_DENIED });
    });

    it('admits any directory when neither a pinned tenant nor an allowlist is set', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ tid: OTHER_TENANT }));

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: 'common' });

      expect(profile.tid).toBe(OTHER_TENANT);
    });
  });

  describe('email domain ownership', () => {
    it('reports xms_edov true as verified', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ xms_edov: true }));

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.emailDomainOwnerVerified).toBe(true);
    });

    it('accepts a stringified xms_edov', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ xms_edov: 'true' }));

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.emailDomainOwnerVerified).toBe(true);
    });

    it('treats an absent xms_edov as unproven', async () => {
      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.emailDomainOwnerVerified).toBe(false);
    });
  });

  describe('account population', () => {
    it('flags a personal Microsoft account', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ tid: MSA_TENANT_ID }));

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.isPersonalAccount).toBe(true);
    });

    it('does not flag a work account', async () => {
      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.isPersonalAccount).toBe(false);
    });
  });

  describe('roles and groups', () => {
    it('surfaces roles and groups', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ roles: ['nauth.access'], groups: ['group-guid'] }));

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.roles).toEqual(['nauth.access']);
      expect(profile.groups).toEqual(['group-guid']);
    });

    it('defaults to empty arrays when the claims are absent', async () => {
      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.roles).toEqual([]);
      expect(profile.groups).toEqual([]);
    });

    it('detects the groups overage indicator', async () => {
      jwtVerify.mockResolvedValue(
        payloadFor({
          _claim_names: { groups: 'src1' },
          _claim_sources: { src1: { endpoint: 'https://graph.microsoft.com/...' } },
        }),
      );

      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.hasGroupsOverage).toBe(true);
      expect(profile.groups).toEqual([]);
    });

    it('reports no overage for an ordinary token', async () => {
      const profile = await service.verifyMicrosoftToken('token', 'test-client-id');

      expect(profile.hasGroupsOverage).toBe(false);
    });
  });

  describe('malformed tokens', () => {
    it('rejects a token missing the oid claim', async () => {
      jwtVerify.mockResolvedValue(payloadFor({ oid: undefined }));

      await expect(service.verifyMicrosoftToken('token', 'test-client-id')).rejects.toThrow(NAuthException);
    });

    it('rejects a token missing the tid claim', async () => {
      jwtVerify.mockResolvedValue({ payload: { sub: 'x', oid: 'y' } });

      await expect(service.verifyMicrosoftToken('token', 'test-client-id')).rejects.toThrow(NAuthException);
    });

    it('rejects a token that fails signature verification', async () => {
      jwtVerify.mockRejectedValue(new Error('signature verification failed'));

      await expect(service.verifyMicrosoftToken('token', 'test-client-id')).rejects.toThrow(NAuthException);
    });
  });

  describe('clearCache', () => {
    it('drops cached JWKS handles', async () => {
      await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID });
      service.clearCache();
      await service.verifyMicrosoftToken('token', 'test-client-id', { tenant: TENANT_GUID });

      expect(createRemoteJWKSet).toHaveBeenCalledTimes(2);
    });
  });
});
