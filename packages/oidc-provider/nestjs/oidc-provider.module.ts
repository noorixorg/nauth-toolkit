import { DynamicModule, Module, Provider as NestProvider, Type } from '@nestjs/common';
import type Provider from 'oidc-provider';
import type { Repository } from 'typeorm';
import type { BaseUser, StorageAdapter } from '@nauth-toolkit/core';
import { AuthAuditService, IdpSessionGate } from '@nauth-toolkit/core/internal';
import { createNAuthOIDCProvider } from '../src/create-provider';
import { OIDCInteractionBridge } from '../src/interaction-bridge';
import { OIDCSessionTerminator } from '../src/session-termination';
import type { NAuthOIDCOptions } from '../src/config.types';
import { NAUTH_OIDC_BRIDGE, NAUTH_OIDC_PROVIDER, NAUTH_OIDC_SESSIONS } from './tokens';
import { createOIDCInteractionController, DEFAULT_INTERACTION_PATH } from './oidc-interaction.controller';

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
};

/**
 * Registers an OpenID Connect provider alongside `AuthModule`.
 *
 * The provider itself is *not* mounted by this module — it owns raw HTTP and must be
 * attached to the underlying platform adapter in `main.ts`, before the body parsers.
 * See `mountOIDCProviderNest`. What this module contributes is the configured
 * provider instance and the interaction bridge, both injectable into your own
 * controllers.
 *
 * The interaction routes the consent screen talks to *are* registered here, as an
 * ordinary Nest controller at `oidc/interaction/:uid`. Set `interaction.enabled` to
 * false to supply your own, or `interaction.path` to move them.
 *
 * @example
 * ```typescript
 * // app.module.ts
 * imports: [AuthModule.forRoot(authConfig), OIDCProviderModule.forRoot(oidcConfig)]
 *
 * // main.ts — after create(), before app.use(json())
 * mountOIDCProviderNest(app, app.get(NAUTH_OIDC_PROVIDER));
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
    const { interaction, ...providerOptions } = options;

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

    return {
      module: OIDCProviderModule,
      controllers,
      providers: [providerFactory, bridgeFactory, terminatorFactory],
      exports: [NAUTH_OIDC_PROVIDER, NAUTH_OIDC_BRIDGE, NAUTH_OIDC_SESSIONS],
    };
  }
}
