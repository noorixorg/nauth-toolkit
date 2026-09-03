import { DynamicModule, Module, Provider as NestProvider } from '@nestjs/common';
import type Provider from 'oidc-provider';
import type { Repository } from 'typeorm';
import type { BaseUser, StorageAdapter } from '@nauth-toolkit/core';
import { IdpSessionGate } from '@nauth-toolkit/core/internal';
import { createNAuthOIDCProvider } from '../src/create-provider';
import { OIDCInteractionBridge } from '../src/interaction-bridge';
import { OIDCSessionTerminator } from '../src/session-termination';
import type { NAuthOIDCOptions } from '../src/config.types';

/** Injection token for the configured `oidc-provider` instance. */
export const NAUTH_OIDC_PROVIDER = 'NAUTH_OIDC_PROVIDER';

/** Injection token for the interaction bridge. */
export const NAUTH_OIDC_BRIDGE = 'NAUTH_OIDC_BRIDGE';

/** Injection token for the single-logout helper. */
export const NAUTH_OIDC_SESSIONS = 'NAUTH_OIDC_SESSIONS';

/**
 * Everything the module needs that is not already available from `AuthModule`.
 *
 * Storage and the user repository are resolved from `AuthModule`'s exports, so they
 * are deliberately absent here.
 */
export type OIDCProviderModuleOptions = Omit<NAuthOIDCOptions, 'storage' | 'userRepository'>;

/**
 * Registers an OpenID Connect provider alongside `AuthModule`.
 *
 * The provider itself is *not* mounted by this module — it owns raw HTTP and must be
 * attached to the underlying platform adapter in `main.ts`, before the body parsers.
 * See `mountOIDCProviderNest`. What this module contributes is the configured
 * provider instance and the interaction bridge, both injectable into your own
 * controllers.
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
   * @param options - Issuer, interaction URL, cookie keys and clients
   * @returns A dynamic module exporting the provider and its interaction bridge
   */
  static forRoot(options: OIDCProviderModuleOptions): DynamicModule {
    const providerFactory: NestProvider = {
      provide: NAUTH_OIDC_PROVIDER,
      useFactory: async (storage: StorageAdapter, userRepository: Repository<BaseUser>): Promise<Provider> =>
        createNAuthOIDCProvider({ ...options, storage, userRepository }),
      inject: ['STORAGE_ADAPTER', 'UserRepository'],
    };

    const bridgeFactory: NestProvider = {
      provide: NAUTH_OIDC_BRIDGE,
      useFactory: (provider: Provider, gate: IdpSessionGate): OIDCInteractionBridge =>
        new OIDCInteractionBridge(provider, gate),
      inject: [NAUTH_OIDC_PROVIDER, IdpSessionGate],
    };

    const terminatorFactory: NestProvider = {
      provide: NAUTH_OIDC_SESSIONS,
      useFactory: (storage: StorageAdapter): OIDCSessionTerminator => new OIDCSessionTerminator(storage),
      inject: ['STORAGE_ADAPTER'],
    };

    return {
      module: OIDCProviderModule,
      providers: [providerFactory, bridgeFactory, terminatorFactory],
      exports: [NAUTH_OIDC_PROVIDER, NAUTH_OIDC_BRIDGE, NAUTH_OIDC_SESSIONS],
    };
  }
}
