import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { AuthGuard } from './auth.guard';
import {
  NAuthConfig,
  NAuthException,
  AuthErrorCode,
  IUser,
  ISession,
  AuthService,
  ContextStorage,
} from '@nauth-toolkit/core';
import { JwtService, SessionService } from '@nauth-toolkit/core/internal';
import { getNAuthContextStore } from './nauth-context.guard';

// Minimal mock implementations
const mockReflector = {
  getAllAndOverride: jest.fn().mockReturnValue(false),
  get: jest.fn().mockReturnValue(undefined),
} as unknown as Reflector;

const mockJwtService = {
  validateAccessToken: jest.fn().mockResolvedValue({ valid: true, payload: { sessionId: '1', sub: 'sub-1' } }),
} as unknown as JwtService;

const mockSessionService = {
  findById: jest
    .fn()
    .mockResolvedValue({ id: 1, version: 1, isRevoked: false, expiresAt: new Date(Date.now() + 60_000) }),
  findByIdLight: jest
    .fn()
    .mockResolvedValue({ id: 1, version: 1, isRevoked: false, expiresAt: new Date(Date.now() + 60_000) }),
} as unknown as SessionService;

const mockUserRepository = {
  findOne: jest.fn().mockResolvedValue({ sub: 'sub-1', isActive: true }),
} as any;

const mockAuthService = {
  getUserById: jest.fn().mockResolvedValue({ sub: 'sub-1', isActive: true }),
  getUserForAuthContext: jest.fn().mockResolvedValue({ sub: 'sub-1', isActive: true }),
} as unknown as AuthService;

async function createGuard(config: Partial<NAuthConfig> = {}): Promise<AuthGuard> {
  const baseConfig: NAuthConfig = {
    jwt: {
      accessToken: { expiresIn: '15m' },
      refreshToken: { secret: 'x'.repeat(32), expiresIn: '30d' },
    },
    ...config,
  } as unknown as NAuthConfig;

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthGuard,
      { provide: Reflector, useValue: mockReflector },
      { provide: JwtService, useValue: mockJwtService },
      { provide: SessionService, useValue: mockSessionService },
      { provide: AuthService, useValue: mockAuthService },
      { provide: 'NAUTH_CONFIG', useValue: baseConfig },
    ],
  }).compile();

  return module.get(AuthGuard);
}

function createHttpContext({
  headers = {},
  cookies = {},
}: {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}) {
  // Create a context store and attach it to the request
  const request: any = { headers, cookies };
  const NAUTH_CONTEXT_STORE = Symbol.for('nauth.contextStore');

  // Create a store and attach it to the request
  const store = new Map<string, unknown>();
  (request as Record<symbol, unknown>)[NAUTH_CONTEXT_STORE] = store;

  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('AuthGuard token source enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects cookies in JSON mode', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'json' } });
    const ctx = createHttpContext({ cookies: { nauth_access_token: 'abc' } });
    try {
      await guard.canActivate(ctx as any);
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NAuthException);
      expect((error as NAuthException).code).toBe(AuthErrorCode.COOKIES_NOT_ALLOWED);
    }
  });

  it('rejects bearer tokens in cookies mode', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'cookies' } });
    const ctx = createHttpContext({ headers: { authorization: 'Bearer abc' } });
    try {
      await guard.canActivate(ctx as any);
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NAuthException);
      expect((error as NAuthException).code).toBe(AuthErrorCode.BEARER_NOT_ALLOWED);
    }
  });

  it('accepts cookies in cookies mode', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'cookies' } });
    const ctx = createHttpContext({ cookies: { nauth_access_token: 'abc' } });
    // jwtService.validateAccessToken is mocked to succeed
    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
  });

  it('prefers cookies over bearer in hybrid mode', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'hybrid' } });
    const ctx = createHttpContext({
      headers: { authorization: 'Bearer headerToken' },
      cookies: { nauth_access_token: 'cookieToken' },
    });
    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(mockJwtService.validateAccessToken).toHaveBeenCalledWith('cookieToken');
  });

  it('accepts bearer tokens in hybrid mode when only Authorization is present', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'hybrid' } });
    const ctx = createHttpContext({
      headers: { authorization: 'Bearer headerToken' },
      cookies: {},
    });
    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(mockJwtService.validateAccessToken).toHaveBeenCalledWith('headerToken');
  });

  it('accepts cookies in hybrid mode when only cookie is present', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'hybrid' } });
    const ctx = createHttpContext({
      headers: {},
      cookies: { nauth_access_token: 'cookieToken' },
    });
    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(mockJwtService.validateAccessToken).toHaveBeenCalledWith('cookieToken');
  });

  it('allows public routes to proceed even when token source is not allowed by delivery mode', async () => {
    // Public route should never throw; it should just skip auth context attachment.
    (mockReflector.getAllAndOverride as unknown as jest.Mock).mockReturnValue(true);

    const guardJson = await createGuard({ tokenDelivery: { method: 'json' } });
    const ctxCookiesInJson = createHttpContext({ cookies: { nauth_access_token: 'abc' } });
    await expect(guardJson.canActivate(ctxCookiesInJson as any)).resolves.toBe(true);
    expect(ctxCookiesInJson.switchToHttp().getRequest().user).toBeUndefined();

    const guardCookies = await createGuard({ tokenDelivery: { method: 'cookies' } });
    const ctxBearerInCookies = createHttpContext({ headers: { authorization: 'Bearer abc' } });
    await expect(guardCookies.canActivate(ctxBearerInCookies as any)).resolves.toBe(true);
    expect(ctxBearerInCookies.switchToHttp().getRequest().user).toBeUndefined();
  });

  it('attaches request.user on public routes when a valid token is provided', async () => {
    (mockReflector.getAllAndOverride as unknown as jest.Mock).mockReturnValue(true);
    const guard = await createGuard({ tokenDelivery: { method: 'json' } });
    const ctx = createHttpContext({ headers: { authorization: 'Bearer valid' } });

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toBeDefined();
    expect(req.token).toBeDefined();
  });

  it('does not throw and does not attach user on public routes when token is invalid/expired', async () => {
    (mockReflector.getAllAndOverride as unknown as jest.Mock).mockReturnValue(true);
    (mockJwtService.validateAccessToken as unknown as jest.Mock).mockResolvedValueOnce({
      valid: false,
      error: 'Token has expired',
      errorType: 'expired',
    });

    const guard = await createGuard({ tokenDelivery: { method: 'json' } });
    const ctx = createHttpContext({ headers: { authorization: 'Bearer expired' } });

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toBeUndefined();
    expect(req.token).toBeUndefined();
  });
});

/**
 * Unit tests for AuthGuard
 *
 * Tests JWT token validation, session checking, and user loading.
 */
describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;
  let sessionService: SessionService;
  let userRepository: Repository<Record<string, unknown>>;
  let mockConfig: NAuthConfig;

  const mockUser = {
    id: 1,
    sub: 'user-123',
    email: 'test@example.com',
    isActive: true,
  } as IUser;

  const mockSession: ISession = {
    id: 123,
    userId: 1,
    accessTokenHash: 'access-hash',
    refreshTokenHash: 'refresh-hash',
    tokenFamily: 'family-123',
    deviceId: 'device-123',
    deviceName: 'Test Device',
    deviceType: 'mobile',
    deviceFingerprint: 'fingerprint',
    ipAddress: '192.168.1.1',
    ipCountry: 'US',
    ipCity: 'New York',
    ipIsp: 'ISP Inc',
    userAgent: 'Mozilla/5.0',
    platform: 'iOS',
    browser: 'Safari',
    isRemembered: false,
    isTrustedDevice: false,
    expiresAt: new Date(Date.now() + 3600000),
    lastActivityAt: new Date(),
    isRevoked: false,
    revokedAt: null,
    revokeReason: null,
    version: 1,
    metadata: null,
    authMethod: 'password',
    createdAt: new Date(),
  };

  // Create a request object with context store
  const createMockRequest = (overrides: any = {}) => {
    const request: any = {
      headers: {},
      cookies: {},
      user: undefined,
      token: undefined,
      ...overrides,
    };
    // Attach context store to request
    const NAUTH_CONTEXT_STORE = Symbol.for('nauth.contextStore');
    const store = new Map<string, unknown>();
    (request as Record<symbol, unknown>)[NAUTH_CONTEXT_STORE] = store;
    return request;
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(createMockRequest()),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as any;

  beforeEach(async () => {
    // Mock JWT service
    const mockJwtService = {
      extractTokenFromHeader: jest.fn(),
      validateAccessToken: jest.fn(),
    };

    // Mock session service
    const mockSessionService = {
      findById: jest.fn(),
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        version: 1,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        authMethod: 'password',
      }),
    };

    // Mock user repository
    const mockUserRepository = {
      findOne: jest.fn(),
    };

    // Mock reflector
    const mockReflector = {
      getAllAndOverride: jest.fn(),
      get: jest.fn().mockReturnValue(undefined),
    };

    // Default config
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: 3600 },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: 86400 },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: 'NAUTH_CONFIG',
          useValue: mockConfig,
        },
        {
          provide: 'UserRepository',
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    sessionService = module.get<SessionService>(SessionService);
    userRepository = module.get<Repository<Record<string, unknown>>>('UserRepository');
  });

  describe('canActivate', () => {
    beforeEach(() => {
      // Setup default mocks
      jest.spyOn(guard['_reflector'], 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'extractTokenFromHeader').mockReturnValue('valid-token');
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sub: 'user-123',
          sessionId: '123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findById').mockResolvedValue(mockSession);
      jest.spyOn(mockAuthService, 'getUserForAuthContext').mockResolvedValue(mockUser as any);
    });

    it('should return true for public routes', async () => {
      // Arrange
      jest.spyOn(guard['_reflector'], 'getAllAndOverride').mockReturnValue(true);

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should extract token from Authorization header', async () => {
      // Arrange
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(mockSession);
      jest.spyOn(mockAuthService, 'getUserForAuthContext').mockResolvedValue(mockUser as any);
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      await guard.canActivate(mockExecutionContext);

      // Assert
      expect(jwtService.validateAccessToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw NAuthException when no token is provided', async () => {
      // Arrange
      jest.spyOn(jwtService, 'extractTokenFromHeader').mockReturnValue(null);
      const request = createMockRequest({
        headers: {},
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('No token provided');
      }
    });

    it('should throw NAuthException for invalid token', async () => {
      // Arrange
      const request = {
        headers: { authorization: 'Bearer invalid-token' },
      };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: false,
        error: 'Token expired',
      });

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Token expired');
      }
    });

    it('should throw NAuthException when session is not found', async () => {
      // Arrange
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(null);

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Session not found');
      }
    });

    it('should throw NAuthException when session is revoked', async () => {
      // Arrange
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const revokedSession = { ...mockSession, isRevoked: true };
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(revokedSession);

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Session has been revoked');
      }
    });

    it('should throw NAuthException when session is expired', async () => {
      // Arrange
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const expiredSession = { ...mockSession, expiresAt: new Date(Date.now() - 3600000) }; // 1 hour ago
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(expiredSession);

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Session has expired');
      }
    });

    it('should throw NAuthException when user is not found', async () => {
      // Arrange
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(mockSession);
      jest.spyOn(mockAuthService, 'getUserForAuthContext').mockRejectedValue(
        new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found'),
      );

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('User not found');
      }
    });

    it('should throw NAuthException when user is inactive', async () => {
      // Arrange
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(mockSession);
      jest.spyOn(mockAuthService, 'getUserForAuthContext').mockRejectedValue(
        new NAuthException(AuthErrorCode.ACCOUNT_INACTIVE, 'Account is not active'),
      );

      // Act & Assert
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Account is not active');
      }
    });

    it('should attach user and token to request on successful authentication', async () => {
      // Arrange
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
        token: undefined,
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sessionId: '1',
          sub: 'user-123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(mockSession);
      jest.spyOn(mockAuthService, 'getUserForAuthContext').mockResolvedValue(mockUser as any);

      // Act
      await guard.canActivate(mockExecutionContext);

      // Assert
      expect(request.user).toBeDefined();
      expect(request.user.sub).toBe(mockUser.sub);
      expect(request.user.sessionAuthMethod).toBe(mockSession.authMethod);
      expect(request.token).toBeDefined();
      expect(request.token.sub).toBe('user-123');
      expect(request.token.sessionId).toBe('1');
      expect(request.token.email).toBe('test@example.com');
      expect(request.token.type).toBe('access');
      expect(typeof request.token.iat).toBe('number');
      expect(typeof request.token.exp).toBe('number');
    });

    it('should return true on successful authentication', async () => {
      // Arrange - ensure all mocks are set up
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);
      jest.spyOn(jwtService, 'validateAccessToken').mockResolvedValue({
        valid: true,
        payload: {
          sub: 'user-123',
          sessionId: '123',
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      jest.spyOn(sessionService, 'findByIdLight').mockResolvedValue(mockSession);
      jest.spyOn(mockAuthService, 'getUserForAuthContext').mockResolvedValue(mockUser as any);

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });
  });
});
