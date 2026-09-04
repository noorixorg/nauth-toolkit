import { DynamicModule, Module, Provider as NestProvider, Type } from '@nestjs/common';
import type Provider from 'oidc-provider';
import type { Repository } from 'typeorm';
import type { BaseUser, StorageAdapter } from '@nauth-toolkit/core';
import { AuthAuditService, IdpSessionGate } from '@nauth-toolkit/core/internal';
import { createNAuthOIDCProvider } from '../src/create-provider';
import { createOIDCRateLimiter, type OIDCRateLimitConfig } from '../src/rate-limit';
import { OIDCInteractionBridge } from '../src/interaction-bridge';
import { OIDCSessionTerminator } from '../src/session-termination';
import type { NAuthOIDCOptions } from '../src/config.types';
import { NAUTH_OIDC_BRIDGE, NAUTH_OIDC_PROVIDER, NAUTH_OIDC_SESSIONS } from './tokens';
import { createOIDCInteractionController, DEFAULT_INTERACTION_PATH } from './oidc-interaction.controller';
import { OIDCSelfMountService, NAUTH_OIDC_MOUNT_OPTIONS, type OIDCSelfMountOptions } from './self-mount.service';

export { NAUTH_OIDC_BRIDGE, NAUTH_OIDC_PROVIDER, NAUTH_OIDC_SESSIONS };

/**
 * How the module registers the interaction routes the consent screen talks to.
 */
export interface OIDCInteractionRouteOptions {
  /**
   * Register the shipped interaction controller.
   *
   * Turn this off to write your own — the bridge stays exported either way, so a
   * hand-written controller only has to inject `NAUTH_OIDC_BRIDGE` and call it.
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Path the interaction routes are served under, relative to any global prefix.
   *
   * With Nest's `setGlobalPrefix('api')` the default lands the routes at
   * `/api/oidc/interaction/:uid`. Whatever you choose here has to match the frontend
   * SDK's `oidc.basePath`.
   *
   * @default 'oidc/interaction'
   */
  path?: string;
}

/**
 * Everything the module needs that is not already available from `AuthModule`.
 *
 * Storage and the user repository are resolved from `AuthModule`'s exports, so they
 * are deliberately absent here.
 */
export type OIDCProviderModuleOptions = Omit<NAuthOIDCOptions, 'storage' | 'userRepository'> & {
  /** How the interaction routes are registered. */
  interaction?: OIDCInteractionRouteOptions;

  /**
   * How the provider's own protocol endpoints are attached to the HTTP server.
   *
   * By default the module mounts them itself during initialisation, so `main.ts` needs
   * no OpenID Connect code at all. Set `enabled: false` only if you must control the
   * ordering yourself.
   */
  mount?: {
    /** @default true */
    enabled?: boolean;
  };

  /**
   * Rate limits for the provider's endpoints, applied ahead of it.
   *
   * `oidc-provider` ships none, and these endpoints sit outside nauth's guard chain, so
   * nothing else covers them — `POST /token` is otherwise an unauthenticated
   * brute-force surface against client secrets and authorization codes.
   *
   * The limiter is built here from the configured storage adapter, so this is plain
   * configuration rather than a constructed middleware.
   *
   * @example
   * ```typescript
   * rateLimit: {
   *   authorize: { max: 60, windowSeconds: 60 },
   *   token: { max: 60, windowSeconds: 60 },
   *   introspection: { max: 600, windowSeconds: 60 },
   * }
   * ```
   */
  rateLimit?: OIDCRateLimitConfig;
};

/**
 * Registers an OpenID Connect provider alongside `AuthModule`.
 *
 * The module contributes three things, and needs nothing from `main.ts`:
 *
 * 1. **The provider's protocol endpoints**, attached to the HTTP server during module
 *    initialisation. They own raw HTTP and deliberately sit outside nauth's guard,
 *    interceptor and pipe chain — and outside any global prefix, so discovery stays at
 *    the origin root where the issuer advertises it. See `OIDCSelfMountService` for the
 *    ordering this depends on; set `mount.enabled` to false to attach them yourself.
 * 2. **The interaction routes** the consent screen talks to, as an ordinary Nest
 *    controller at `oidc/interaction/:uid`. Set `interaction.enabled` to false to
 *    supply your own, or `interaction.path` to move them.
 * 3. **The provider instance and interaction bridge**, injectable into your own code.
 *
 * @example
 * ```typescript
 * // app.module.ts — that is the whole integration
 * imports: [AuthModule.forRoot(authConfig), OIDCProviderModule.forRoot(oidcConfig)]
 * ```
 */
@Module({})
export class OIDCProviderModule {
  /**
   * Configure the provider.
   *
   * @param options - Issuer, interaction URL, cookie keys, clients and interaction routing
   * @returns A dynamic module exporting the provider and its interaction bridge
   */
  static forRoot(options: OIDCProviderModuleOptions): DynamicModule {
    // Module-level concerns are stripped here: everything remaining is spread into the
    // provider's own configuration, which would reject keys it does not recognise.
    const { interaction, mount, rateLimit, ...providerOptions } = options;
    const pathPrefix = providerOptions.pathPrefix ?? '/oidc';

    const providerFactory: NestProvider = {
      provide: NAUTH_OIDC_PROVIDER,
      useFactory: async (storage: StorageAdapter, userRepository: Repository<BaseUser>): Promise<Provider> =>
        createNAuthOIDCProvider({ ...providerOptions, storage, userRepository }),
      inject: ['STORAGE_ADAPTER', 'UserRepository'],
    };

    const bridgeFactory: NestProvider = {
      provide: NAUTH_OIDC_BRIDGE,
      useFactory: (provider: Provider, gate: IdpSessionGate, audit?: AuthAuditService): OIDCInteractionBridge =>
        new OIDCInteractionBridge(provider, gate, audit),
      // The audit service is optional: `AuthModule` only exports it when audit logs are
      // enabled, and the bridge simply records nothing when it is absent.
      inject: [NAUTH_OIDC_PROVIDER, IdpSessionGate, { token: AuthAuditService, optional: true }],
    };

    const terminatorFactory: NestProvider = {
      provide: NAUTH_OIDC_SESSIONS,
      useFactory: (storage: StorageAdapter): OIDCSessionTerminator => new OIDCSessionTerminator(storage),
      inject: ['STORAGE_ADAPTER'],
    };

    const controllers: Type<unknown>[] =
      interaction?.enabled === false
        ? []
        : [createOIDCInteractionController(interaction?.path ?? DEFAULT_INTERACTION_PATH)];

    // The provider attaches itself to the HTTP server during module initialisation, so
    // nothing about OpenID Connect needs to appear in main.ts. Opt out to attach it
    // yourself - see OIDCSelfMountService for the ordering constraints that entails.
    const mountOptionsProvider: NestProvider = {
      provide: NAUTH_OIDC_MOUNT_OPTIONS,
      // Built from DI so the limiter can reach the configured storage adapter, which is
      // why rate limiting is expressed as configuration rather than a middleware.
      useFactory: (storage: StorageAdapter): OIDCSelfMountOptions => ({
        pathPrefix,
        rateLimiter: rateLimit ? createOIDCRateLimiter(storage, rateLimit, { pathPrefix }) : undefined,
      }),
      inject: ['STORAGE_ADAPTER'],
    };

    const selfMounts = options.mount?.enabled === false ? [] : [OIDCSelfMountService];

    return {
      module: OIDCProviderModule,
      controllers,
      providers: [providerFactory, bridgeFactory, terminatorFactory, mountOptionsProvider, ...selfMounts],
      exports: [NAUTH_OIDC_PROVIDER, NAUTH_OIDC_BRIDGE, NAUTH_OIDC_SESSIONS],
    };
  }
}
