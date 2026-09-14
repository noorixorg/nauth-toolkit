import 'reflect-metadata';
import { MicrosoftSocialAuthService } from './microsoft-social-auth.service';
import { MicrosoftOAuthClient } from './microsoft-oauth.client';
import {
  AuthService,
  SocialAuthService,
  ClientInfoService,
  NAuthConfig,
  NAuthLogger,
  OAuthUserProfile,
  AuthErrorCode,
  ITokenVerifierService,
  PhoneVerificationService,
  ISocialAuthStateStore,
  MicrosoftSocialProviderConfig,
  BaseUser,
} from '@nauth-toolkit/core';
import { JwtService, SessionService, AuthChallengeHelperService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { VerifiedMicrosoftTokenProfile } from './verified-token-profile.interface';
import { MSA_TENANT_ID } from './entra-tenant';

jest.mock('./microsoft-oauth.client');
jest.mock('./token-verifier.service');

const TENANT_GUID = '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f';

/**
 * Build a verified profile as the token verifier would return it.
 */
function verifiedProfile(overrides: Partial<VerifiedMicrosoftTokenProfile> = {}): VerifiedMicrosoftTokenProfile {
  return {
    sub: 'pairwise-subject',
    oid: 'object-id-123',
    tid: TENANT_GUID,
    email: 'ada@contoso.com',
    emailDomainOwnerVerified: false,
    isPersonalAccount: false,
    roles: [],
    groups: [],
    hasGroupsOverage: false,
    raw: {},
    ...overrides,
  };
}

/**
 * Microsoft Social Auth Service unit tests
 *
 * Covers the two things that make this provider more than a copy of the Google one:
 * the email-trust rule that gates auto-linking, and the access gate that runs on every
 * authentication rather than only at signup.
 */
describe('MicrosoftSocialAuthService', () => {
  let service: MicrosoftSocialAuthService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockTokenVerifier: jest.Mocked<ITokenVerifierService>;
  let mockOAuthClient: jest.Mocked<MicrosoftOAuthClient>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let verifyMicrosoftToken: jest.Mock;

  /**
   * Instantiate the service against a given Microsoft provider config.
   */
  function buildService(microsoft: Partial<MicrosoftSocialProviderConfig> = {}): MicrosoftSocialAuthService {
    mockConfig = {
      social: {
        microsoft: {
          enabled: true,
          clientId: 'microsoft-client-id',
          clientSecret: 'microsoft-client-secret',
          callbackUrl: 'https://example.com/auth/social/microsoft/callback',
          tenant: TENANT_GUID,
          ...microsoft,
        },
      },
    } as NAuthConfig;

    return new MicrosoftSocialAuthService(
      mockConfig,
      mockLogger,
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockStateStore,
      mockUserRepository,
      mockPhoneVerificationService,
      mockAuditService,
      undefined, // trustedDeviceService
      undefined, // hookRegistry
      mockTokenVerifier,
    );
  }

  /**
   * Run the web redirect path, which is where the gate is enforced.
   */
  async function runCallback(svc: MicrosoftSocialAuthService): Promise<OAuthUserProfile> {
    return await (
      svc as unknown as {
        getOAuthProfile(code: string, state: string): Promise<OAuthUserProfile>;
      }
    ).getOAuthProfile('auth-code', 'state');
  }

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as NAuthLogger;

    mockAuthService = {} as jest.Mocked<AuthService>;
    mockSocialAuthService = {} as jest.Mocked<SocialAuthService>;
    mockJwtService = {} as jest.Mocked<JwtService>;
    mockSessionService = {} as jest.Mocked<SessionService>;
    mockChallengeHelper = {} as jest.Mocked<AuthChallengeHelperService>;
    mockClientInfoService = {} as jest.Mocked<ClientInfoService>;
    mockAuditService = {} as jest.Mocked<AuthAuditService>;
    mockPhoneVerificationService = {} as jest.Mocked<PhoneVerificationService>;
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseUser>>;

    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('generated-state'),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(undefined),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue(null),
    };

    verifyMicrosoftToken = jest.fn().mockResolvedValue(verifiedProfile());
    mockTokenVerifier = { verifyMicrosoftToken } as unknown as jest.Mocked<ITokenVerifierService>;

    mockOAuthClient = {
      getAuthorizationUrl: jest.fn().mockReturnValue('https://login.microsoftonline.com/authorize'),
      exchangeCodeForToken: jest.fn().mockResolvedValue({ accessToken: 'access', idToken: 'id-token' }),
      getUserProfile: jest.fn(),
    } as unknown as jest.Mocked<MicrosoftOAuthClient>;

    (MicrosoftOAuthClient as unknown as jest.Mock).mockImplementation(() => mockOAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('constructor', () => {
    it('initializes with a valid config', () => {
      service = buildService();

      expect(service).toBeDefined();
      expect(service.providerName).toBe('microsoft');
    });

    it('stays inert when the provider is disabled', async () => {
      service = buildService({ enabled: false });

      await expect(service.getAuthUrl('state')).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_CONFIG_MISSING,
      });
    });

    it('defaults the tenant to common', () => {
      buildService({ tenant: undefined });

      expect((MicrosoftOAuthClient as unknown as jest.Mock).mock.calls[0][0].tenant).toBe('common');
    });
  });

  // ==========================================================================
  // Authorization URL
  // ==========================================================================

  describe('getAuthUrl', () => {
    it('passes the state through to the OAuth client', async () => {
      service = buildService();

      await service.getAuthUrl('state-123');

      expect(mockOAuthClient.getAuthorizationUrl).toHaveBeenCalledWith('state-123', undefined);
    });

    it('lets a per-request param override the configured one', async () => {
      service = buildService({ oauthParams: { prompt: 'none' } });

      await service.getAuthUrl('state-123', { prompt: 'select_account' });

      expect(mockOAuthClient.getAuthorizationUrl).toHaveBeenCalledWith('state-123', { prompt: 'select_account' });
    });
  });

  // ==========================================================================
  // Identity mapping
  // ==========================================================================

  describe('identity mapping', () => {
    it('joins on the immutable object id, not the pairwise subject', async () => {
      service = buildService();

      const profile = await runCallback(service);

      expect(profile.id).toBe('object-id-123');
      expect(profile.id).not.toBe('pairwise-subject');
    });

    it('falls back to preferred_username when the email claim is absent', async () => {
      verifyMicrosoftToken.mockResolvedValue(
        verifiedProfile({ email: undefined, preferredUsername: 'ada@contoso.com' }),
      );
      service = buildService();

      const profile = await runCallback(service);

      expect(profile.email).toBe('ada@contoso.com');
    });

    it('ignores a preferred_username that is not an email address', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ email: undefined, preferredUsername: 'ada' }));
      service = buildService();

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_EMAIL_REQUIRED,
      });
    });

    it('splits the display name when given_name and family_name are absent', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ name: 'Ada Lovelace' }));
      service = buildService();

      const profile = await runCallback(service);

      expect(profile.firstName).toBe('Ada');
      expect(profile.lastName).toBe('Lovelace');
    });

    it('prefers the explicit name claims', async () => {
      verifyMicrosoftToken.mockResolvedValue(
        verifiedProfile({ name: 'Ignored Entirely', givenName: 'Ada', familyName: 'Lovelace' }),
      );
      service = buildService();

      const profile = await runCallback(service);

      expect(profile.firstName).toBe('Ada');
      expect(profile.lastName).toBe('Lovelace');
    });

    it('rejects a callback with no ID token', async () => {
      mockOAuthClient.exchangeCodeForToken.mockResolvedValue({ accessToken: 'access' });
      service = buildService();

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_TOKEN_INVALID,
      });
    });
  });

  // ==========================================================================
  // Email trust — what gates auto-linking in the base class
  // ==========================================================================

  describe('email trust', () => {
    it('trusts a work account email only when the tenant owns the domain', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ emailDomainOwnerVerified: true }));
      service = buildService();

      const profile = await runCallback(service);

      expect(profile.verified).toBe(true);
    });

    it('trusts a work account from a pinned tenant even without xms_edov', async () => {
      // Pinning a tenant GUID is itself a statement of trust, and the verifier rejects
      // every other directory. nOAuth needs an attacker-controlled tenant, which a pinned
      // deployment does not accept — so requiring xms_edov here would only mark real
      // employees unverified.
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ emailDomainOwnerVerified: false }));
      service = buildService({ tenant: TENANT_GUID });

      const profile = await runCallback(service);

      expect(profile.verified).toBe(true);
    });

    it('does not trust a work account from an unpinned directory without xms_edov', async () => {
      // The nOAuth shape: multi-tenant, and the admin of some directory controls the
      // email claim for their own users.
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ emailDomainOwnerVerified: false }));
      service = buildService({ tenant: 'common' });

      const profile = await runCallback(service);

      expect(profile.verified).toBe(false);
    });

    it('trusts a directory named in allowedTenants', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ emailDomainOwnerVerified: false }));
      service = buildService({ tenant: 'organizations', allowedTenants: [TENANT_GUID] });

      const profile = await runCallback(service);

      expect(profile.verified).toBe(true);
    });

    it('trusts a personal account email', async () => {
      // Microsoft proves ownership before an address can become an account alias, so
      // this behaves like Google rather than creating a duplicate account.
      verifyMicrosoftToken.mockResolvedValue(
        verifiedProfile({ tid: MSA_TENANT_ID, isPersonalAccount: true, emailDomainOwnerVerified: false }),
      );
      service = buildService({ tenant: 'common' });

      const profile = await runCallback(service);

      expect(profile.verified).toBe(true);
    });
  });

  // ==========================================================================
  // Access gate
  // ==========================================================================

  describe('access gate — app roles', () => {
    it('admits a user holding a required role', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: ['nauth.access'] }));
      service = buildService({ requiredRoles: ['nauth.access'] });

      await expect(runCallback(service)).resolves.toBeDefined();
    });

    it('denies a user holding none of the required roles', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: ['some.other.role'] }));
      service = buildService({ requiredRoles: ['nauth.access'] });

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCESS_DENIED,
      });
    });

    it('denies a user with no roles at all', async () => {
      service = buildService({ requiredRoles: ['nauth.access'] });

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCESS_DENIED,
      });
    });

    it('matches roles case-insensitively', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: ['NAuth.Access'] }));
      service = buildService({ requiredRoles: ['nauth.access'] });

      await expect(runCallback(service)).resolves.toBeDefined();
    });

    it('admits when any one of several required roles is held', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: ['nauth.admin'] }));
      service = buildService({ requiredRoles: ['nauth.access', 'nauth.admin'] });

      await expect(runCallback(service)).resolves.toBeDefined();
    });

    it('admits everyone when no roles are required', async () => {
      service = buildService();

      await expect(runCallback(service)).resolves.toBeDefined();
    });
  });

  describe('access gate — security groups', () => {
    it('admits a member of a required group', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ groups: ['group-guid-1'] }));
      service = buildService({ requiredGroups: ['group-guid-1'] });

      await expect(runCallback(service)).resolves.toBeDefined();
    });

    it('denies a non-member', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ groups: ['group-guid-2'] }));
      service = buildService({ requiredGroups: ['group-guid-1'] });

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCESS_DENIED,
      });
    });

    it('fails closed when Entra omitted the groups claim through overage', async () => {
      // An empty groups array here means "unknown", not "member of nothing" — admitting
      // would let the most heavily group-assigned users bypass the gate entirely.
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ groups: [], hasGroupsOverage: true }));
      service = buildService({ requiredGroups: ['group-guid-1'] });

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCESS_DENIED,
      });
    });

    it('ignores overage when no groups are required', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ hasGroupsOverage: true }));
      service = buildService();

      await expect(runCallback(service)).resolves.toBeDefined();
    });
  });

  describe('access gate coverage', () => {
    it('runs on every authentication, not only the first', async () => {
      // findOrCreateUser short-circuits for a returning user, so a gate placed there
      // would let someone who lost their role keep signing in indefinitely.
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: ['nauth.access'] }));
      service = buildService({ requiredRoles: ['nauth.access'] });

      await expect(runCallback(service)).resolves.toBeDefined();

      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: [] }));

      await expect(runCallback(service)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCESS_DENIED,
      });
    });

    it('applies to the native mobile path too', async () => {
      verifyMicrosoftToken.mockResolvedValue(verifiedProfile({ roles: [] }));
      service = buildService({ requiredRoles: ['nauth.access'] });

      const verifyNative = (
        service as unknown as {
          verifyNativeToken(idToken: string): Promise<OAuthUserProfile>;
        }
      ).verifyNativeToken.bind(service);

      await expect(verifyNative('native-id-token')).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCESS_DENIED,
      });
    });
  });

  // ==========================================================================
  // Tenant constraints reach the verifier
  // ==========================================================================

  describe('tenant constraints', () => {
    it('forwards the pinned tenant and allowlist to the verifier', async () => {
      service = buildService({ tenant: 'organizations', allowedTenants: [TENANT_GUID] });

      await runCallback(service);

      expect(verifyMicrosoftToken).toHaveBeenCalledWith('id-token', 'microsoft-client-id', {
        tenant: 'organizations',
        allowedTenants: [TENANT_GUID],
      });
    });
  });

  // ==========================================================================
  // Auto-link suppression (nOAuth)
  // ==========================================================================

  describe('auto-link suppression', () => {
    /**
     * Reporting `verified: false` is not sufficient on its own: the base class links on
     * `existingUser.isEmailVerified || profile.verified`, so an already-verified local
     * account is matched by email regardless. These pin the provider-side override that
     * actually closes it.
     */
    const callFindOrCreate = async (
      svc: MicrosoftSocialAuthService,
      profile: Partial<OAuthUserProfile>,
      cfg: Partial<MicrosoftSocialProviderConfig>,
    ): Promise<MicrosoftSocialProviderConfig> => {
      const seen: MicrosoftSocialProviderConfig[] = [];
      const proto = Object.getPrototypeOf(Object.getPrototypeOf(svc)) as {
        findOrCreateUser: (p: unknown, c: MicrosoftSocialProviderConfig) => Promise<unknown>;
      };
      const original = proto.findOrCreateUser;
      proto.findOrCreateUser = async (_p: unknown, c: MicrosoftSocialProviderConfig) => {
        seen.push(c);
        return {} as unknown;
      };
      try {
        await (
          svc as unknown as {
            findOrCreateUser(p: unknown, c: unknown): Promise<unknown>;
          }
        ).findOrCreateUser(profile, cfg);
      } finally {
        proto.findOrCreateUser = original;
      }
      return seen[0];
    };

    it('disables auto-link when the email is unproven', async () => {
      service = buildService();

      const passed = await callFindOrCreate(service, { id: 'oid-1', verified: false }, { autoLink: true });

      expect(passed.autoLink).toBe(false);
    });

    it('keeps auto-link when the email is proven', async () => {
      service = buildService();

      const passed = await callFindOrCreate(service, { id: 'oid-1', verified: true }, { autoLink: true });

      expect(passed.autoLink).toBe(true);
    });

    it('leaves an explicit autoLink:false alone', async () => {
      service = buildService();

      const passed = await callFindOrCreate(service, { id: 'oid-1', verified: true }, { autoLink: false });

      expect(passed.autoLink).toBe(false);
    });
  });
});
