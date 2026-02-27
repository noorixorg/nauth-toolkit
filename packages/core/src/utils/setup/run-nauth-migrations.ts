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
 */
export async function runNAuthMigrationsOnStartup(
  config: NAuthConfig,
  dataSource: DataSource,
  logger: NAuthLogger,
): Promise<void> {
  if (!dataSource.isInitialized) {
    logger.warn('[nauth-toolkit] DataSource not initialized; skipping migrations');
    return;
  }

  const dbType = getDbType(dataSource);
  if (!dbType) {
    logger.debug(
      `[nauth-toolkit] Skipping migrations: unsupported TypeORM DataSource type: ${String(
        (dataSource.options as { type?: unknown } | undefined)?.type,
      )}`,
    );
    return;
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
}
