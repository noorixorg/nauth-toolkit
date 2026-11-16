import type { Provider } from '@nestjs/common';
import type { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
import { runNAuthMigrationsOnStartup } from '@nauth-toolkit/core/internal';
import { DataSource } from 'typeorm';

/**
 * Injection token for the migrations bootstrap provider.
 *
 * @remarks
 * Resolves to `true` when nauth migrations ran during module init, `false` when they were
 * skipped. `NAuthContextGuard` injects it so the provider is created eagerly at startup.
 */
export const NAUTH_MIGRATIONS_BOOTSTRAP = 'NAUTH_MIGRATIONS_BOOTSTRAP';

/**
 * NestJS provider that auto-runs nauth-toolkit migrations on module init.
 *
 * @remarks
 * Delegates to core's `runNAuthMigrationsOnStartup()`, the same function `NAuth.create()`
 * uses, so NestJS apps get identical behaviour: `migrations.autoRun: false` skips the run,
 * an uninitialized or unsupported DataSource is skipped, and the adapter serializes
 * concurrent boots behind a database lock.
 */
export const nauthMigrationsBootstrapProvider: Provider = {
  provide: NAUTH_MIGRATIONS_BOOTSTRAP,
  useFactory: (config: NAuthConfig, logger: NAuthLogger, dataSource: DataSource): Promise<boolean> =>
    runNAuthMigrationsOnStartup(config, dataSource, logger),
  inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER', DataSource],
};
