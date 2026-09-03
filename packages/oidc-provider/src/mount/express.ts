import type Provider from 'oidc-provider';

/** Minimal shape of the Express-like app this helper mounts onto. */
interface MountableApp {
  use(handler: (req: MountableRequest, res: unknown, next: () => void) => void): unknown;
}

/** Minimal shape of the request this helper inspects. */
interface MountableRequest {
  url?: string;
  path?: string;
}

/**
 * Mount an `oidc-provider` instance onto an Express-style application.
 *
 * The provider is given the request **without any URL rewriting**. That is deliberate
 * and load-bearing: its routes are configured with the path prefix already baked in,
 * so it must see the full path. Mounting the conventional way, with
 * `app.use('/oidc', provider.callback())`, strips the prefix and breaks every URL the
 * provider generates.
 *
 * `provider.callback()` is Koa's — arity `(req, res)`, with no `next` — so it can
 * never pass a request on. The gate below decides what reaches it and lets everything
 * else continue to the rest of the application.
 *
 * Mount this **before** body-parsing middleware where you can. `oidc-provider` falls
 * back to a pre-parsed `req.body` if the stream is already consumed, so it works
 * either way, but mounting first avoids a startup warning and keeps the provider's own
 * request size limit rather than deferring to the upstream parser's.
 *
 * @param app - The Express application
 * @param provider - A configured provider
 * @param options - The path prefix its routes were configured with
 *
 * @example
 * ```typescript
 * const app = express();
 * mountOIDCProviderExpress(app, provider, { pathPrefix: '/oidc' });
 * app.use(express.json());
 * ```
 */
export function mountOIDCProviderExpress(
  app: MountableApp,
  provider: Provider,
  options: { pathPrefix?: string } = {},
): void {
  const prefix = options.pathPrefix ?? '/oidc';
  const callback = provider.callback();

  app.use((req: MountableRequest, res: unknown, next: () => void) => {
    if (isProviderPath(req, prefix)) {
      // Hand the raw Node objects straight over; the provider owns the response.
      (callback as unknown as (rq: unknown, rs: unknown) => void)(req, res);
      return;
    }
    next();
  });
}

/**
 * Whether a request belongs to the provider.
 *
 * Discovery lives at the origin root, not under the prefix, because the issuer is a
 * bare origin — that is exactly where OpenID Connect Discovery says it belongs.
 */
export function isProviderPath(req: { url?: string; path?: string }, prefix: string): boolean {
  const path = (req.path ?? req.url ?? '').split('?')[0];
  return path.startsWith(`${prefix}/`) || path === prefix || path.startsWith('/.well-known/');
}
