import { DataSource } from 'typeorm';
import type { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
import { migrations } from '../migrations';
import { getNAuthEntities, getNAuthTransientStorageEntities } from '../entities';

type TypeOrmMigration = { name: string };

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
  type: 'postgres';
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
      type: 'postgres',
      url: opts.url,
      extra: opts.extra,
    };
  }

  // Otherwise, use individual connection parameters
  return {
    type: 'postgres',
    host: opts.host,
    port: opts.port,
    username: opts.username,
    password: opts.password,
    database: opts.database,
    extra: opts.extra,
  };
}

/**
 * Run nauth-toolkit migrations for Postgres.
 *
 * @remarks
 * This creates a completely isolated DataSource instance for nauth migrations,
 * ensuring zero interference with consumer migrations. The consumer's DataSource
 * is never modified or accessed for migration purposes.
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

  logger.log(`[nauth-toolkit] Ensuring database schema via migrations (@nauth-toolkit/database-typeorm-postgres)...`);

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
    // Always destroy the isolated DataSource to clean up connections
    if (nauthDataSource.isInitialized) {
      await nauthDataSource.destroy();
    }
  }
}
