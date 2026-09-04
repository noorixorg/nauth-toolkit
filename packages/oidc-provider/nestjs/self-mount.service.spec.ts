/**
 * Self-mount tests
 *
 * The provider's placement depends on Nest's `init()` ordering, which is not a public
 * contract. These tests pin the behaviour that matters so a future Nest release
 * reordering its lifecycle fails here rather than in production.
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import { OIDCSelfMountService, type OIDCSelfMountOptions } from './self-mount.service';

/** Captures what the service registers on an Express-like instance. */
const createInstance = (): {
  instance: { use: jest.Mock };
  dispatch: (url: string) => { handled: boolean; body?: string };
} => {
  const layers: Array<(req: unknown, res: unknown, next: () => void) => void> = [];
  const instance = { use: jest.fn((h: (req: unknown, res: unknown, next: () => void) => void) => layers.push(h)) };

  return {
    instance,
    dispatch: (url) => {
      let handled = false;
      let body: string | undefined;
      const res = {
        statusCode: 0,
        setHeader: (): void => undefined,
        end: (chunk?: string): void => {
          handled = true;
          body = chunk;
        },
      };
      for (const layer of layers) {
        let advanced = false;
        layer({ url, path: url }, res, () => {
          advanced = true;
        });
        if (!advanced) break;
      }
      return { handled, body };
    },
  };
};

const providerOf = (): { callback: () => (req: unknown, res: unknown) => void } => ({
  callback: () => (req, res): void => {
    const request = req as { url: string; readableEnded?: boolean };
    const response = res as { statusCode?: number; setHeader?: (k: string, v: string) => void; end(c: string): void };
    response.statusCode = 200;
    response.setHeader?.('content-type', 'application/json');
    response.end(JSON.stringify({ url: request.url, bodyConsumed: request.readableEnded === true }));
  },
});

const hostOf = (instance: unknown): never => ({ httpAdapter: { getInstance: () => instance } }) as never;

const options = (over: Partial<OIDCSelfMountOptions> = {}): OIDCSelfMountOptions => ({
  pathPrefix: '/oidc',
  ...over,
});

describe('OIDCSelfMountService', () => {
  it('claims provider paths and discovery, and lets everything else through', () => {
    const { instance, dispatch } = createInstance();
    new OIDCSelfMountService(hostOf(instance), providerOf() as never, options()).onModuleInit();

    expect(dispatch('/oidc/auth').handled).toBe(true);
    // Discovery must stay at the origin root, whatever prefix the app uses.
    expect(dispatch('/.well-known/openid-configuration').handled).toBe(true);
    expect(dispatch('/api/auth/login').handled).toBe(false);
  });

  it('registers the rate limiter ahead of the provider', () => {
    const { instance, dispatch } = createInstance();
    const rateLimiter = jest.fn((_req: unknown, _res: unknown, next: () => void) => next());

    new OIDCSelfMountService(hostOf(instance), providerOf() as never, options({ rateLimiter })).onModuleInit();

    // The limiter runs inside the claimed request rather than as a separate layer, so
    // it covers provider paths on both drivers - on Fastify the socket is already
    // hijacked by the time the handler runs, and a second hook could not intervene.
    // /token is otherwise an unauthenticated brute-force surface.
    expect(dispatch('/oidc/token').handled).toBe(true);
    expect(rateLimiter).toHaveBeenCalledTimes(1);

    // And it does not run for traffic the provider does not own.
    expect(dispatch('/api/auth/login').handled).toBe(false);
    expect(rateLimiter).toHaveBeenCalledTimes(1);
  });

  it('selects the Fastify adapter by capability, not by an injected token', async () => {
    // The previous implementation only took this path when a 'NAUTH_ADAPTER' token was
    // injected - and nothing ever provided one, so Fastify was unreachable while the
    // test passed on a hand-supplied fake. Drive a real Fastify instance instead.
    const fastify = Fastify({ logger: false });
    fastify.get('/app/thing', async () => ({ ok: true }));

    new OIDCSelfMountService(hostOf(fastify), providerOf() as never, options()).onModuleInit();
    await fastify.ready();

    const claimed = await fastify.inject({ method: 'GET', url: '/oidc/auth' });
    expect(claimed.statusCode).toBe(200);
    expect(JSON.parse(claimed.body).url).toBe('/oidc/auth');

    // Discovery is claimed too, and the application's own routes are untouched.
    expect((await fastify.inject({ method: 'GET', url: '/.well-known/openid-configuration' })).statusCode).toBe(200);
    expect((await fastify.inject({ method: 'GET', url: '/app/thing' })).statusCode).toBe(200);
    expect((await fastify.inject({ method: 'GET', url: '/nope' })).statusCode).toBe(404);

    await fastify.close();
  });

  it('leaves the request body unconsumed on Fastify', async () => {
    // The reason Fastify avoids the Express caveat: onRequest runs before body parsing,
    // so the provider keeps its own request-size limit.
    const fastify = Fastify({ logger: false });
    new OIDCSelfMountService(hostOf(fastify), providerOf() as never, options()).onModuleInit();
    await fastify.ready();

    const res = await fastify.inject({
      method: 'POST',
      url: '/oidc/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'grant_type=authorization_code',
    });

    expect(JSON.parse(res.body).bodyConsumed).toBe(false);
    await fastify.close();
  });

  it('still honours an explicitly injected adapter', () => {
    const { instance } = createInstance();
    const mountRaw = jest.fn();
    const adapter = { name: 'CustomAdapter', mountRaw } as never;

    new OIDCSelfMountService(hostOf(instance), providerOf() as never, options(), adapter).onModuleInit();

    expect(mountRaw).toHaveBeenCalledTimes(1);
    expect(instance.use).not.toHaveBeenCalled();
  });

  it('honours a custom path prefix', () => {
    const { instance, dispatch } = createInstance();
    new OIDCSelfMountService(hostOf(instance), providerOf() as never, options({ pathPrefix: '/identity' })).onModuleInit();

    expect(dispatch('/identity/token').handled).toBe(true);
    expect(dispatch('/oidc/token').handled).toBe(false);
  });

  it('warns rather than throwing when there is no HTTP instance', () => {
    const logger = { warn: jest.fn(), log: jest.fn() } as never;
    const host = { httpAdapter: undefined } as never;

    expect(() =>
      new OIDCSelfMountService(host, providerOf() as never, options(), undefined, logger).onModuleInit(),
    ).not.toThrow();
  });
});
