import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from '../services/csrf.service';
import { AuthErrorCode, NAuthConfig, NAuthException } from '@nauth-toolkit/core';

// Minimal mock implementations
const mockReflector = {
  getAllAndOverride: jest.fn().mockReturnValue(false),
  get: jest.fn().mockReturnValue(undefined),
} as unknown as Reflector;

async function createGuard(config: Partial<NAuthConfig> = {}): Promise<CsrfGuard> {
  const baseConfig: NAuthConfig = {
    tokenDelivery: { method: 'cookies' },
    security: {
      csrf: {
        cookieName: 'nauth_csrf_token',
        headerName: 'x-csrf-token',
      },
    },
    ...config,
  } as unknown as NAuthConfig;

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CsrfGuard,
      CsrfService,
      { provide: Reflector, useValue: mockReflector },
      { provide: 'NAUTH_CONFIG', useValue: baseConfig },
    ],
  }).compile();

  return module.get(CsrfGuard);
}

function createHttpContext({
  method = 'POST',
  url = '/guest/xx',
  headers = {},
  cookies = {},
}: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}) {
  const request: unknown = { method, url, headers, cookies };

  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('CsrfGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows state-changing requests when no auth cookies are present (cookie-effective mode)', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'cookies' } });
    const ctx = createHttpContext({
      method: 'POST',
      url: '/guest/xx',
      headers: {},
      cookies: {},
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('requires CSRF when access token cookie is present', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'cookies', cookieNamePrefix: 'nauth_' } });
    const ctx = createHttpContext({
      method: 'POST',
      url: '/protected',
      headers: {},
      cookies: {
        nauth_access_token: 'access',
      },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NAuthException);
      expect((error as NAuthException).code).toBe(AuthErrorCode.CSRF_TOKEN_MISSING);
    }
  });

  it('requires CSRF when refresh token cookie is present', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'cookies', cookieNamePrefix: 'nauth_' } });
    const ctx = createHttpContext({
      method: 'POST',
      url: '/protected',
      headers: {},
      cookies: {
        nauth_refresh_token: 'refresh',
      },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NAuthException);
      expect((error as NAuthException).code).toBe(AuthErrorCode.CSRF_TOKEN_MISSING);
    }
  });

  it('passes when CSRF header matches CSRF cookie and auth cookie is present', async () => {
    const guard = await createGuard({ tokenDelivery: { method: 'cookies', cookieNamePrefix: 'nauth_' } });
    const ctx = createHttpContext({
      method: 'POST',
      url: '/protected',
      headers: {
        'x-csrf-token': 'csrf',
      },
      cookies: {
        nauth_access_token: 'access',
        nauth_csrf_token: 'csrf',
      },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
