import { DataSource } from 'typeorm';
import type { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
import { migrations } from '../migrations';
import { getNAuthEntities, getNAuthTransientStorageEntities } from '../entities';
import { acquireMigrationLock, MIGRATION_LOCK_TIMEOUT_MS } from './migration-lock';

type TypeOrmMigration = { name: string };

/**
 * Check whether any nauth migrations are still pending.
 *
 * @remarks
 * Used only on the lock-timeout path, to distinguish "another instance already did the
 * work" from "the schema is genuinely out of date". Treats a failed check as pending so
 * an unclear state fails loudly instead of starting on an unmigrated schema.
 *
 * @param dataSource - Initialized nauth DataSource
 * @param logger - NAuth logger instance
 * @returns True if migrations remain unapplied (or the check could not be performed)
 */
async function hasPendingMigrations(dataSource: DataSource, logger: NAuthLogger): Promise<boolean> {
  try {
    return await dataSource.showMigrations();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[nauth-toolkit] Could not determine pending migrations: ${message}`);
    return true;
  }
}

function getMigrationsTableName(config: NAuthConfig): string {
  const tablePrefix = config.tablePrefix ?? 'nauth_';
  return `${tablePrefix}migrations`;
}

/**
 * Extracts connection configuration from consumer DataSource without touching it.
 *
 * @remarks
 * This function only reads connection options and never modifies the consumer's DataSource.
 * It supports both connection URL and individual connection parameters.
 *
 * @param dataSource - Consumer's DataSource instance
 * @returns Connection configuration object
 */
function extractConnectionConfig(dataSource: DataSource): {
  type: 'mysql';
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  extra?: unknown;
} {
  const options = dataSource.options;
  const opts = options as {
    url?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    extra?: unknown;
  };

  // If connection URL is provided, use it (takes precedence)
  if (opts.url) {
    return {
      type: 'mysql',
      url: opts.url,
      extra: opts.extra,
    };
  }

  // Otherwise, use individual connection parameters
  return {
    type: 'mysql',
    host: opts.host,
    port: opts.port,
    username: opts.username,
    password: opts.password,
    database: opts.database,
    extra: opts.extra,
  };
}

/**
 * Run nauth-toolkit migrations for MySQL.
 *
 * @remarks
 * This creates a completely isolated DataSource instance for nauth migrations,
 * ensuring zero interference with consumer migrations. The consumer's DataSource
 * is never modified or accessed for migration purposes.
 *
 * The run is serialized across instances by a MySQL session-level named lock, so
 * containers that boot in parallel (ECS tasks, Kubernetes pods) cannot race to create the
 * same tables on a first deployment or apply the same migration twice on a later one.
 * Instances that lose the race wait for the winner and then find nothing left to do. The
 * lock is released by the database if an instance dies, so it can never wedge a deploy.
 *
 * @param dataSource - Consumer's DataSource (only used to extract connection config)
 * @param logger - NAuth logger instance
 * @param config - NAuth configuration
 */
export async function runNAuthMigrations(
  dataSource: DataSource,
  logger: NAuthLogger,
  config: NAuthConfig,
): Promise<void> {
  const migrationsTableName = getMigrationsTableName(config);

  logger.log(`[nauth-toolkit] Ensuring database schema via migrations (@nauth-toolkit/database-typeorm-mysql)...`);

  // Extract connection config from consumer DataSource (read-only, no modifications)
  const connectionConfig = extractConnectionConfig(dataSource);

  // Create a completely separate DataSource instance for nauth migrations only
  // This ensures hard separation - consumer migrations are never touched
  const nauthDataSource = new DataSource({
    ...connectionConfig,
    entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
    migrations,
    migrationsTableName,
    synchronize: false,
    logging: false,
  });

  try {
    // Initialize the isolated nauth DataSource
    await nauthDataSource.initialize();

    // ============================================================================
    // Acquire the cross-instance migration lock
    // ============================================================================
    // Without this, instances starting in parallel each see an empty migrations table
    // and race to apply the same DDL.
    const lock = await acquireMigrationLock(nauthDataSource, migrationsTableName, logger);

    if (!lock) {
      // Timed out waiting for the instance that holds the lock. Continue only if it
      // already applied everything; never migrate concurrently.
      if (!(await hasPendingMigrations(nauthDataSource, logger))) {
        logger.warn(
          `[nauth-toolkit] Timed out after ${MIGRATION_LOCK_TIMEOUT_MS}ms waiting for the migration lock, but no migrations are pending; continuing startup.`,
        );
        return;
      }

      throw new Error(
        `[nauth-toolkit] Timed out after ${MIGRATION_LOCK_TIMEOUT_MS}ms waiting for another instance to finish migrations, and migrations are still pending. ` +
          `Apply migrations before rolling out and set migrations.autoRun to false, or investigate the instance holding the lock.`,
      );
    }

    try {
      logger.log(
        `[nauth-toolkit] Running ${migrations.length} NAuth migration(s) using isolated DataSource (table: ${migrationsTableName})`,
      );
      logger.log('[nauth-toolkit] Checking for pending migrations...');

      // Run migrations on the isolated DataSource
      const executed = (await nauthDataSource.runMigrations({
        transaction: 'all',
      } as unknown as { transaction: 'all' })) as TypeOrmMigration[];

      if (!executed.length) {
        logger.log('[nauth-toolkit] No pending migrations.');
        return;
      }

      logger.log(`[nauth-toolkit] Executed ${executed.length} migration(s):`);
      for (const m of executed) logger.log(`  ${m.name}`);
    } finally {
      // Release before destroying the DataSource so the lock is dropped explicitly
      // rather than relying on connection teardown.
      await lock.release();
    }
  } finally {
    // Always destroy the isolated DataSource to clean up connections
    if (nauthDataSource.isInitialized) {
      await nauthDataSource.destroy();
    }
  }
}
