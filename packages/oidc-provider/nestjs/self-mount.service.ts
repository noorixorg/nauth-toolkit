/**
 * Self-mounting for the OpenID Connect provider
 *
 * The provider's endpoints are raw HTTP: its handler is Koa's, arity `(req, res)` with
 * no `next`, so it must own the request outright and sit outside Nest's routing. This
 * service attaches it during module initialisation, which removes the hand-ordered
 * bootstrapping that previously had to live in `main.ts`.
 *
 * @packageDocumentation
 */

import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type Provider from 'oidc-provider';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ExpressAdapter, FastifyAdapter, NAuthLogger, type NAuthAdapter } from '@nauth-toolkit/core';
import { isProviderPath } from '../src/mount/express';
import { NAUTH_OIDC_PROVIDER } from './tokens';

/** Settings the self-mount needs, supplied by `OIDCProviderModule.forRoot()`. */
export interface OIDCSelfMountOptions {
  /** Path prefix the provider's routes were configured with. */
  pathPrefix: string;
  /** Optional rate limiter, registered ahead of the provider. */
  rateLimiter?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
}

/** DI token carrying the self-mount settings. */
export const NAUTH_OIDC_MOUNT_OPTIONS = 'NAUTH_OIDC_MOUNT_OPTIONS';

/**
 * Attaches the provider to the running HTTP server.
 *
 * **Why `onModuleInit`, and why the raw driver.** `NestApplication.init()` runs
 * `registerParserMiddleware` → `registerModules` → `registerRouter` → `callInitHook`
 * → `registerRouterHooks`. This hook fires at `callInitHook`, which is:
 *
 * - *after* Nest's router, which is harmless — it calls `next()` when no controller
 *   matches, so provider paths fall through to us;
 * - *before* the not-found handler, which is essential — one step later
 *   (`onApplicationBootstrap`) and every provider request would 404.
 *
 * Attaching to the raw driver rather than `MiddlewareConsumer` is equally deliberate:
 * middleware routes are rewritten by `RouteInfoPathExtractor` to include the global
 * prefix, which would move discovery off the origin root and break every URL the
 * issuer advertises.
 *
 * The one cost, on Express only, is that the body arrives already parsed — the parser
 * is registered before modules and ignores the global prefix. `oidc-provider` falls
 * back to `req.body`, so this works; the provider's own request-size limit simply
 * defers to the upstream parser's. Fastify has no such cost: its `onRequest` hook runs
 * before body parsing.
 */
@Injectable()
export class OIDCSelfMountService implements OnModuleInit {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(NAUTH_OIDC_PROVIDER) private readonly provider: Provider,
    @Inject(NAUTH_OIDC_MOUNT_OPTIONS) private readonly options: OIDCSelfMountOptions,
    @Optional() @Inject('NAUTH_ADAPTER') private readonly nauthAdapter?: NAuthAdapter,
    @Optional() private readonly logger?: NAuthLogger,
  ) {}

  /**
   * Pick the platform adapter matching the HTTP driver Nest is running on.
   *
   * Selection is by capability rather than by an injected token: under NestJS the core
   * adapters are not part of the request pipeline at all, so nothing binds one, and
   * depending on an injected `NAUTH_ADAPTER` left the Fastify path unreachable. A
   * consumer that *does* bind one still wins.
   *
   * @param instance - The underlying HTTP instance from `HttpAdapterHost`
   * @returns The adapter whose `mountRaw` suits this driver, or undefined if neither fits
   */
  private selectAdapter(instance: { use?: unknown; addHook?: unknown }): NAuthAdapter | undefined {
    if (this.nauthAdapter?.mountRaw) return this.nauthAdapter;

    // Fastify first: its instance also exposes other methods, but only it has addHook,
    // and `use()` on Fastify needs the middie shim that may not be registered.
    if (typeof instance.addHook === 'function') return new FastifyAdapter();
    if (typeof instance.use === 'function') return new ExpressAdapter();

    return undefined;
  }

  /**
   * Register the rate limiter and provider on the underlying HTTP instance.
   */
  onModuleInit(): void {
    const instance = this.adapterHost?.httpAdapter?.getInstance?.() as
      | { use?: (handler: unknown) => unknown; addHook?: unknown }
      | undefined;

    if (!instance) {
      this.logger?.warn?.('OIDC self-mount skipped: no HTTP adapter instance available');
      return;
    }

    const prefix = this.options.pathPrefix;
    const callback = this.provider.callback() as unknown as (req: unknown, res: unknown) => void;
    const adapter = this.selectAdapter(instance);

    if (!adapter?.mountRaw) {
      this.logger?.warn?.(
        'OIDC self-mount skipped: the HTTP driver exposes neither use() nor addHook(), ' +
          'so the provider could not be attached. Mount it yourself with mountOIDCProviderNest().',
      );
      return;
    }

    // The rate limiter runs inside the same claimed request rather than as a separate
    // layer, so both drivers get it: on Fastify the socket is already hijacked by the
    // time the handler runs, and a second hook could not intervene.
    const limiter = this.options.rateLimiter;
    const handler = limiter
      ? (req: IncomingMessage, res: ServerResponse): void => {
          limiter(req, res, () => callback(req, res));
        }
      : (req: IncomingMessage, res: ServerResponse): void => callback(req, res);

    adapter.mountRaw(instance, (path) => isProviderPath({ path }, prefix), handler);

    this.logger?.log?.(`OpenID Connect provider mounted at ${prefix} via ${adapter.name}`);
  }
}
