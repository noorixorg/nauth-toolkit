import type { DataSource } from 'typeorm';
import type { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
import { migrations } from '../migrations';

type TypeOrmMigration = { name: string };

function getMigrationsTableName(config: NAuthConfig): string {
  const tablePrefix = config.tablePrefix ?? 'nauth_';
  return `${tablePrefix}migrations`;
}

/**
 * Run nauth-toolkit migrations for MySQL.
 *
 * @remarks
 * This is invoked automatically by the core/nestjs packages at startup.
 */
export async function runNAuthMigrations(
  dataSource: DataSource,
  logger: NAuthLogger,
  config: NAuthConfig,
): Promise<void> {
  const migrationsTableName = getMigrationsTableName(config);

  logger.log(`[nauth-toolkit] Ensuring database schema via migrations (@nauth-toolkit/database-typeorm-mysql)...`);

  const existing = Array.isArray(dataSource.options.migrations) ? dataSource.options.migrations : [];
  const merged = [...existing, ...migrations];

  // Inject our migrations into the DataSource options, then rebuild metadatas so TypeORM creates Migration instances.
  // (Setting options alone is not enough after initialization; TypeORM uses `dataSource.migrations` built in buildMetadatas()).
  (dataSource.options as { migrations?: unknown[] }).migrations = merged as unknown[];
  (dataSource.options as { migrationsTableName?: string }).migrationsTableName = migrationsTableName;
  await (dataSource as unknown as { buildMetadatas: () => Promise<void> }).buildMetadatas();

  logger.log(
    `[nauth-toolkit] Injecting ${migrations.length} NAuth migration(s) into DataSource (existing runtime: ${existing.length})`,
  );
  logger.log('[nauth-toolkit] Checking for pending migrations...');

  const executed = (await dataSource.runMigrations(
    { transaction: 'all' } as unknown as { transaction: 'all' },
  )) as TypeOrmMigration[];

  if (!executed.length) {
    logger.log('[nauth-toolkit] No pending migrations.');
    return;
  }

  logger.log(`[nauth-toolkit] Executed ${executed.length} migration(s):`);
  for (const m of executed) logger.log(`  ${m.name}`);
}
