import { DataSource, MigrationInterface } from 'typeorm';
import { migrations, type MigrationConstructor } from '../migrations';

/**
 * Logger interface for migration output
 */
export interface MigrationLogger {
  log: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
}

/**
 * Options for running NAuth migrations
 */
export interface RunNAuthMigrationsOptions {
  /**
   * Override the migrations table name (defaults to TypeORM's default if not set).
   *
   * @remarks
   * If you want a consistent nauth table naming convention, pass something like:
   * `nauth_migrations` or `${tablePrefix}migrations`.
   */
  migrationsTableName?: string;
}

/**
 * Get the runtime migrations array from TypeORM DataSource.
 *
 * @remarks
 * TypeORM stores instantiated migrations on an internal `dataSource.migrations` property.
 * This is not part of the public type surface, so we access it via a narrow structural type.
 */
function getRuntimeMigrations(dataSource: DataSource): MigrationInterface[] {
  const ds = dataSource as DataSource & { migrations?: MigrationInterface[] };
  return Array.isArray(ds.migrations) ? ds.migrations : [];
}

/**
 * Set runtime migrations on TypeORM DataSource.
 *
 * @remarks
 * This updates TypeORM's internal list used by MigrationExecutor.
 */
function setRuntimeMigrations(dataSource: DataSource, runtimeMigrations: MigrationInterface[]): void {
  const ds = dataSource as DataSource & { migrations?: MigrationInterface[] };
  ds.migrations = runtimeMigrations;
}

/**
 * Create migration instances from constructors.
 *
 * @internal
 */
function instantiateMigrations(constructors: MigrationConstructor[]): MigrationInterface[] {
  return constructors.map((Ctor) => new Ctor());
}

/**
 * Automatically run nauth-toolkit migrations (PostgreSQL)
 *
 * Called internally during NAuth initialization.
 * Idempotent - safe to run on every startup.
 * TypeORM tracks which migrations have been executed in the migrations table.
 *
 * @param dataSource - TypeORM DataSource instance
 * @param logger - Optional logger for migration output
 * @param options - Optional execution options
 * @returns Number of migrations executed (0 if already up-to-date or executed by another instance)
 *
 * @internal Called automatically by the library
 */
export async function runNAuthMigrations(
  dataSource: DataSource,
  logger?: MigrationLogger,
  options?: RunNAuthMigrationsOptions,
): Promise<number> {
  try {
    // ============================================================================
    // Configure migrations table name (optional)
    // ============================================================================
    const mutableOptions = dataSource.options as unknown as {
      migrationsTableName?: string;
      migrations?: unknown;
    };

    if (options?.migrationsTableName && !dataSource.options.migrationsTableName) {
      mutableOptions.migrationsTableName = options.migrationsTableName;
    }

    // ============================================================================
    // Inject NAuth migrations into DataSource
    // ============================================================================
    const existingOptionMigrations = (dataSource.options.migrations as unknown[]) || [];
    const existingRuntimeMigrations = getRuntimeMigrations(dataSource);

    if (migrations.length === 0) {
      logger?.warn(
        '[nauth-toolkit] No migrations registered in @nauth-toolkit/database-typeorm-postgres. ' +
          'Generate and add an Initial migration to src/migrations/index.ts.',
      );
      return 0;
    }

    const nauthMigrationInstances = instantiateMigrations(migrations);

    logger?.log(
      `[nauth-toolkit] Injecting ${migrations.length} NAuth migration(s) into DataSource (existing runtime: ${existingRuntimeMigrations.length})`,
    );

    mutableOptions.migrations = [...existingOptionMigrations, ...migrations];
    setRuntimeMigrations(dataSource, [...existingRuntimeMigrations, ...nauthMigrationInstances]);

    // ============================================================================
    // Check for pending migrations
    // ============================================================================
    logger?.log('[nauth-toolkit] Checking for pending migrations...');
    const hasPending = await dataSource.showMigrations();

    if (!hasPending) {
      logger?.log('[nauth-toolkit] Database schema is up to date');
      return 0;
    }

    // ============================================================================
    // Run migrations
    // ============================================================================
    logger?.log('[nauth-toolkit] Running database migrations...');
    const executed = await dataSource.runMigrations({ transaction: 'all' });

    if (executed.length > 0) {
      logger?.log(`[nauth-toolkit] Executed ${executed.length} migration(s):`);
      executed.forEach((migration) => logger?.log(`  ✓ ${migration.name}`));
    } else {
      logger?.log('[nauth-toolkit] No migrations executed (already applied by another instance)');
    }

    return executed.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('already exists') ||
      message.includes('duplicate key') ||
      message.includes('already been applied')
    ) {
      logger?.warn('[nauth-toolkit] Migrations already applied by another instance (concurrent startup detected)');
      return 0;
    }

    logger?.error('[nauth-toolkit] Migration failed:', error);
    throw new Error(`NAuth migrations failed: ${message}`);
  }
}
