import type { Provider } from '@nestjs/common';
import type { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
import { DataSource } from 'typeorm';

export const NAUTH_MIGRATIONS_BOOTSTRAP = 'NAUTH_MIGRATIONS_BOOTSTRAP';

type MigrationRunnerModule = {
  runNAuthMigrations?: (dataSource: DataSource, logger: NAuthLogger, config: NAuthConfig) => Promise<void>;
};

function getAdapterPackageName(
  dataSource: DataSource,
): '@nauth-toolkit/database-typeorm-postgres' | '@nauth-toolkit/database-typeorm-mysql' | null {
  const type = (dataSource.options as { type?: unknown } | undefined)?.type;
  if (type === 'postgres') return '@nauth-toolkit/database-typeorm-postgres';
  if (type === 'mysql' || type === 'mariadb') return '@nauth-toolkit/database-typeorm-mysql';
  return null;
}

/**
 * NestJS provider that auto-runs nauth-toolkit migrations on module init.
 *
 * @remarks
 * This ensures NestJS apps get the same "zero bootstrap burden" migration behavior as `NAuth.create()`.
 */
export const nauthMigrationsBootstrapProvider: Provider = {
  provide: NAUTH_MIGRATIONS_BOOTSTRAP,
  useFactory: async (config: NAuthConfig, logger: NAuthLogger, dataSource: DataSource) => {
    logger?.debug?.('[PERF] Migrations bootstrap factory started');
    if (!dataSource?.isInitialized) {
      logger?.warn?.('[nauth-toolkit] DataSource not initialized; skipping migrations');
      return false;
    }

    logger?.debug?.('[PERF] Determining adapter package name...');
    const adapterPackageName = getAdapterPackageName(dataSource);
    if (!adapterPackageName) {
      logger?.debug?.(
        `[nauth-toolkit] Skipping migrations: unsupported TypeORM DataSource type: ${String(
          (dataSource.options as { type?: unknown } | undefined)?.type,
        )}`,
      );
      return false;
    }

    logger?.debug?.(`[PERF] Importing migration adapter: ${adapterPackageName}...`);
    let imported: MigrationRunnerModule;
    try {
      imported = (await import(adapterPackageName)) as unknown as MigrationRunnerModule;
      logger?.debug?.('[PERF] Migration adapter imported');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[nauth-toolkit] Failed to load migration adapter ${adapterPackageName}: ${message}`);
    }

    if (typeof imported.runNAuthMigrations !== 'function') {
      throw new Error(`[nauth-toolkit] Migration adapter ${adapterPackageName} does not export runNAuthMigrations()`);
    }

    logger?.debug?.('[PERF] Running migrations...');
    await imported.runNAuthMigrations(dataSource, logger, config);
    logger?.debug?.('[PERF] Migrations completed');
    return true;
  },
  inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER', DataSource],
};
