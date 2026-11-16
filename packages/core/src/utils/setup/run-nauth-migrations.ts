import type { DataSource } from 'typeorm';
import type { NAuthConfig } from '../../interfaces/config.interface';
import type { NAuthLogger } from '../nauth-logger';

type SupportedTypeOrmDbType = 'postgres' | 'mysql' | 'mariadb';

function getDbType(dataSource: DataSource): SupportedTypeOrmDbType | null {
  const type = (dataSource.options as { type?: unknown } | undefined)?.type;
  if (type === 'postgres' || type === 'mysql' || type === 'mariadb') return type;
  return null;
}

type MigrationRunnerModule = {
  runNAuthMigrations?: (dataSource: DataSource, logger: NAuthLogger, config: NAuthConfig) => Promise<void>;
};

/**
 * Runs nauth-toolkit migrations automatically on startup (zero consumer burden).
 *
 * @remarks
 * This dynamically loads the database-specific adapter package and asks it to run its
 * own adapter-owned migrations into the provided `DataSource`.
 *
 * The adapter serializes the run behind a database-level lock (Postgres advisory lock /
 * MySQL named lock), so multiple instances booting in parallel — ECS tasks, Kubernetes
 * pods — cannot race on the same schema. See `config.migrations`.
 *
 * Set `config.migrations.autoRun = false` to skip this entirely and apply migrations
 * out-of-band (for example from a one-off release task).
 *
 * This is the only implementation: `NAuth.create()` and the NestJS `AuthModule` both call it,
 * so `migrations.autoRun` behaves the same on every framework.
 *
 * @param config - nauth configuration (reads `migrations.autoRun`)
 * @param dataSource - Initialized TypeORM DataSource to migrate
 * @param logger - nauth logger
 * @returns `true` when the adapter ran its migrations, `false` when they were skipped
 *   (`autoRun: false`, DataSource not initialized, or an unsupported database type)
 * @throws {Error} When the adapter package cannot be loaded or the migration run fails
 */
export async function runNAuthMigrationsOnStartup(
  config: NAuthConfig,
  dataSource: DataSource,
  logger: NAuthLogger,
): Promise<boolean> {
  if (config.migrations?.autoRun === false) {
    logger.log('[nauth-toolkit] Automatic migrations disabled (migrations.autoRun: false); skipping.');
    return false;
  }

  if (!dataSource?.isInitialized) {
    logger.warn('[nauth-toolkit] DataSource not initialized; skipping migrations');
    return false;
  }

  const dbType = getDbType(dataSource);
  if (!dbType) {
    logger.debug(
      `[nauth-toolkit] Skipping migrations: unsupported TypeORM DataSource type: ${String(
        (dataSource.options as { type?: unknown } | undefined)?.type,
      )}`,
    );
    return false;
  }

  const adapterPackageName =
    dbType === 'postgres' ? '@nauth-toolkit/database-typeorm-postgres' : '@nauth-toolkit/database-typeorm-mysql';

  let imported: MigrationRunnerModule;
  try {
    // NOTE: use a variable import (not a string literal) to avoid hard dependency from core -> adapter packages
    imported = (await import(adapterPackageName)) as unknown as MigrationRunnerModule;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[nauth-toolkit] Failed to load migration adapter ${adapterPackageName}: ${message}`);
  }

  if (typeof imported.runNAuthMigrations !== 'function') {
    throw new Error(`[nauth-toolkit] Migration adapter ${adapterPackageName} does not export runNAuthMigrations()`);
  }

  await imported.runNAuthMigrations(dataSource, logger, config);
  return true;
}
