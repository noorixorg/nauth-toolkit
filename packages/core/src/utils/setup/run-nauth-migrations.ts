import { DataSource } from 'typeorm';
import { NAuthConfig } from '../../interfaces/config.interface';
import { NAuthLogger } from '../nauth-logger';

/**
 * Run nauth-toolkit migrations during application bootstrap.
 *
 * @remarks
 * This helper is used by framework adapters (Express/Fastify via `NAuth.create`, and NestJS module bootstrap).
 * It keeps consumer apps free from any migration wiring: migrations are executed automatically at startup.
 *
 * Migrations are intentionally owned by the **database adapter packages** (e.g. `database-typeorm-postgres`,
 * `database-typeorm-mysql`) for maximum compatibility with database-specific semantics.
 *
 * @param config - NAuth config (used for default migrations table naming)
 * @param dataSource - Initialized TypeORM DataSource
 * @param logger - NAuth logger wrapper
 * @throws {Error} If migrations fail to execute
 */
export async function runNAuthMigrationsOnStartup(
  config: NAuthConfig,
  dataSource: DataSource,
  logger: NAuthLogger,
): Promise<void> {
  const dbType = dataSource.options.type;
  const tablePrefix = config.tablePrefix ?? 'nauth_';
  const migrationsTableName = `${tablePrefix}migrations`;

  // ============================================================================
  // Determine database adapter package
  // ============================================================================
  let adapterPackageName: string | null = null;

  if (dbType === 'postgres') adapterPackageName = '@nauth-toolkit/database-typeorm-postgres';
  if (dbType === 'mysql') adapterPackageName = '@nauth-toolkit/database-typeorm-mysql';

  if (!adapterPackageName) {
    logger.debug?.(`[nauth-toolkit] Skipping migrations (unsupported TypeORM driver: ${String(dbType)})`);
    return;
  }

  // ============================================================================
  // Dynamically load adapter migration runner (keeps core DB-agnostic)
  // ============================================================================
  const imported = (await import(adapterPackageName)) as unknown;
  const runNAuthMigrations = (imported as { runNAuthMigrations?: unknown }).runNAuthMigrations;

  if (typeof runNAuthMigrations !== 'function') {
    throw new Error(
      `[nauth-toolkit] ${adapterPackageName} does not export runNAuthMigrations(). ` +
        `Install/upgrade the database adapter package to enable automatic migrations.`,
    );
  }

  // ============================================================================
  // Execute migrations
  // ============================================================================
  logger.log?.(`[nauth-toolkit] Ensuring database schema via migrations (${adapterPackageName})...`);

  await (
    runNAuthMigrations as (ds: DataSource, log?: unknown, opts?: { migrationsTableName?: string }) => Promise<number>
  )(dataSource, logger, { migrationsTableName });
}
