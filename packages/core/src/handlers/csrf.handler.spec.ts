import { CsrfHandler } from './csrf.handler';
import { CsrfService } from '../services/csrf.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

/**
 * Unit tests for CsrfHandler
 *
 * Ensures CSRF cookies are NOT generated on CORS preflight (OPTIONS),
 * which would otherwise rotate tokens between header-read and request-send.
 */
describe('CsrfHandler', () => {
  const createConfig = (): NAuthConfig =>
    ({
      tokenDelivery: {
        method: 'cookies',
        cookieOptions: {
          secure: true,
          sameSite: 'strict',
          domain: '.example.com',
        },
      },
      security: {
        csrf: {
          cookieName: 'nauth_csrf_token',
          headerName: 'x-csrf-token',
        },
      },
    }) as unknown as NAuthConfig;

  const createReq = (method: string, cookies?: Record<string, string>): NAuthRequest =>
    ({
      method,
      path: '/auth/profile',
      url: '/auth/profile',
      body: undefined,
      query: {},
      params: {},
      headers: {},
      cookies: cookies ?? {},
      ip: '127.0.0.1',
      raw: {},
      attributes: {},
      getHeader: (name: string): string | undefined => {
        const key = name.toLowerCase();
        const val = (Object.create(null) as Record<string, unknown>)[key];
        return typeof val === 'string' ? val : undefined;
      },
    }) as unknown as NAuthRequest;

  it('does not generate CSRF cookie on OPTIONS (preflight)', async () => {
    const csrfService = {
      getCookieName: () => 'nauth_csrf_token',
      getHeaderName: () => 'x-csrf-token',
      getCookieOptions: () => ({}),
      generateToken: jest.fn(() => 'token-abc'),
      validateToken: jest.fn(() => true),
    } as unknown as CsrfService;

    const config = createConfig();
    const handler = new CsrfHandler(csrfService, config);

    const req = createReq('OPTIONS', {}); // preflight generally has no cookies
    const res: NAuthResponse = {
      setCookie: jest.fn(),
      header: jest.fn(),
    } as unknown as NAuthResponse;

    const next = jest.fn(async () => undefined);
    await handler.handle(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res.setCookie as unknown as jest.Mock).mock.calls.length).toBe(0);
    expect((res.header as unknown as jest.Mock).mock.calls.length).toBe(0);
    expect((csrfService.generateToken as unknown as jest.Mock).mock.calls.length).toBe(0);
  });

  it('generates CSRF cookie on GET when missing', async () => {
    const csrfService = {
      getCookieName: () => 'nauth_csrf_token',
      getHeaderName: () => 'x-csrf-token',
      getCookieOptions: () => ({}),
      generateToken: jest.fn(() => 'token-abc'),
      validateToken: jest.fn(() => true),
    } as unknown as CsrfService;

    const config = createConfig();
    const handler = new CsrfHandler(csrfService, config);

    const req = createReq('GET', {});
    const res: NAuthResponse = {
      setCookie: jest.fn(),
      header: jest.fn(),
    } as unknown as NAuthResponse;

    const next = jest.fn(async () => undefined);
    await handler.handle(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(csrfService.generateToken).toHaveBeenCalledTimes(1);
    expect((res.setCookie as unknown as jest.Mock).mock.calls.length).toBe(1);
    expect((res.header as unknown as jest.Mock).mock.calls.length).toBe(1);
  });

  it('passes cookie priority from getCookieOptions to setCookie', async () => {
    const csrfService = {
      getCookieName: () => 'nauth_csrf_token',
      getHeaderName: () => 'x-csrf-token',
      getCookieOptions: () => ({ priority: 'low' as const }),
      generateToken: jest.fn(() => 'token-abc'),
      validateToken: jest.fn(() => true),
    } as unknown as CsrfService;

    const config = createConfig();
    const handler = new CsrfHandler(csrfService, config);

    const req = createReq('GET', {});
    const res: NAuthResponse = {
      setCookie: jest.fn(),
      header: jest.fn(),
    } as unknown as NAuthResponse;

    const next = jest.fn(async () => undefined);
    await handler.handle(req, res, next);

    expect((res.setCookie as unknown as jest.Mock).mock.calls[0][2]).toMatchObject({ priority: 'low' });
  });
});
