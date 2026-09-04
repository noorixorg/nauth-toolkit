import type Provider from 'oidc-provider';
import { mountOIDCProviderExpress } from '../src/mount/express';

/** The slice of `INestApplication` this helper needs. */
interface NestAppLike {
  getHttpAdapter(): { getInstance(): unknown };
}

/**
 * Attach an OpenID Connect provider to a NestJS application by hand.
 *
 * **You almost certainly do not need this.** `OIDCProviderModule.forRoot()` mounts the
 * provider itself during module initialisation, so a typical application has no
 * OpenID Connect code in `main.ts` at all. This is the companion to
 * `mount: { enabled: false }`, for the rare case where you must control the ordering —
 * for example to place other raw middleware between the parser and the provider.
 *
 * Call it **before** `app.use(json())` and before `setGlobalPrefix`. The provider is
 * attached to the underlying platform instance, not to Nest's router, so it
 * deliberately bypasses guards, interceptors, pipes and filters — it speaks OAuth on
 * its own paths and has nothing to gain from nauth's request pipeline. The interaction
 * bridge, which *does* need nauth's context, is an ordinary Nest controller instead.
 *
 * Because the mount is on the platform instance, `setGlobalPrefix('api')` does not
 * apply to it: the provider's endpoints sit at the origin root exactly as its
 * discovery document advertises them.
 *
 * Express-family drivers only. On Fastify, leave the module to mount itself — it
 * routes through the platform adapter, which knows to use an `onRequest` hook.
 *
 * @param app - The Nest application
 * @param provider - A configured provider
 * @param options - The path prefix its routes were configured with
 *
 * @example
 * ```typescript
 * // Only alongside OIDCProviderModule.forRoot({ ..., mount: { enabled: false } })
 * const app = await NestFactory.create(AppModule, new ExpressAdapter());
 * mountOIDCProviderNest(app, app.get(NAUTH_OIDC_PROVIDER));
 * app.use(cookieParser());
 * app.setGlobalPrefix('api');
 * ```
 */
export function mountOIDCProviderNest(
  app: NestAppLike,
  provider: Provider,
  options: { pathPrefix?: string } = {},
): void {
  const instance = app.getHttpAdapter().getInstance() as {
    use(handler: (req: never, res: never, next: () => void) => void): unknown;
  };
  mountOIDCProviderExpress(instance, provider, options);
}
