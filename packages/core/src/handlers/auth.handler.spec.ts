import { ContextStorage } from '../utils/context-storage';
import { AuthHandler } from './auth.handler';
import { AuthService } from '../services/auth.service';
import { JwtService, SessionService } from '../internal';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

/**
 * Unit tests for AuthHandler
 *
 * Verifies session-scoped auth method propagation onto the current user object.
 */
describe('AuthHandler', () => {
  it('attaches sessionAuthMethod to authenticated user from session.authMethod', async () => {
    const jwtService = {
      validateAccessToken: jest.fn().mockResolvedValue({
        valid: true,
        payload: { sessionId: '1', sub: 'sub-1' },
      }),
    } as unknown as JwtService;

    const sessionService = {
      findAuthContextBySessionId: jest.fn().mockResolvedValue({
        session: {
          id: 1,
          version: 1,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 60_000),
          authMethod: 'google',
          userId: 1,
        },
        user: {
          id: 1,
          sub: 'sub-1',
          email: 'test@example.com',
          isActive: true,
          hasPasswordHash: false,
          socialProviders: ['google'],
        },
      }),
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        version: 1,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        authMethod: 'google',
      }),
    } as unknown as SessionService;

    const authService = {
      getUserForAuthContext: jest.fn(),
    } as unknown as AuthService;

    const config: NAuthConfig = {
      jwt: {
        accessToken: { secret: 'x'.repeat(32), expiresIn: '15m' },
        refreshToken: { secret: 'x'.repeat(32), expiresIn: '30d' },
      },
      tokenDelivery: { method: 'json' },
    } as unknown as NAuthConfig;

    const handler = new AuthHandler(jwtService, sessionService, authService, config);

    const req: NAuthRequest = {
      method: 'GET',
      path: '/profile',
      url: '/profile',
      body: {},
      query: {},
      params: {},
      headers: { authorization: 'Bearer token' },
      cookies: {},
      ip: '127.0.0.1',
      raw: {},
      attributes: {},
      getHeader: (name: string): string | undefined => {
        const key = name.toLowerCase();
        const val = req.headers[key];
        return typeof val === 'string' ? val : undefined;
      },
    };

    await ContextStorage.run(async () => {
      await handler.handle(req, {} as NAuthResponse, async () => undefined);
    });

    const user = req.attributes.user as { sessionAuthMethod?: string | null };
    expect(user.sessionAuthMethod).toBe('google');
  });
});
