import { DataSource } from 'typeorm';
import { migrations } from '@nauth-toolkit/core/migrations';

/**
 * Logger interface for migration output
 */
export interface MigrationLogger {
  log: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
}

/**
 * Automatically run nauth-toolkit migrations
 *
 * Called internally during NAuth initialization.
 * Idempotent - safe to run on every startup.
 * TypeORM tracks which migrations have been executed in the migrations table.
 *
 * **Multi-Server Safe:**
 * - Uses database-level locking via TypeORM's migrations table
 * - When multiple containers start simultaneously, only one executes migrations
 * - Others wait for the lock, then see migrations are already applied
 * - MySQL InnoDB uses row-level locks with transaction isolation
 *
 * @param dataSource - TypeORM DataSource instance
 * @param logger - Optional logger for migration output
 * @returns Number of migrations executed (0 if already up-to-date or executed by another instance)
 *
 * @internal Called automatically by the library
 *
 * @example
 * ```typescript
 * import { runNAuthMigrations } from '@nauth-toolkit/database-typeorm-mysql';
 *
 * await runNAuthMigrations(dataSource, logger);
 * ```
 */
export async function runNAuthMigrations(
  dataSource: DataSource,
  logger?: MigrationLogger,
): Promise<number> {
  try {
    // #region agent log
    const debugFetch =
      (
        globalThis as typeof globalThis & {
          fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown>;
        }
      ).fetch ?? null;

    debugFetch
      ?.('http://127.0.0.1:7242/ingest/97f9fe53-6a8b-43e2-ae9b-4b2d0f725816', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'packages/database/typeorm-mysql/src/utils/run-migrations.ts:45',
          message: 'before injection',
          data: {
            hasOptionsMigrations: Array.isArray(dataSource.options.migrations),
            optionsMigrationsLength: Array.isArray(dataSource.options.migrations)
              ? dataSource.options.migrations.length
              : null,
            hasDataSourceMigrations: Object.prototype.hasOwnProperty.call(
              dataSource as unknown as { migrations?: unknown[] },
              'migrations',
            ),
            dataSourceMigrationsLength: Array.isArray(
              (dataSource as unknown as { migrations?: unknown[] }).migrations,
            )
              ? ((dataSource as unknown as { migrations?: unknown[] }).migrations ?? []).length
              : null,
            isInitialized: dataSource.isInitialized,
          },
          timestamp: Date.now(),
        }),
      })
      .catch(() => {
        // Intentionally ignore debug logging errors
      });
    // #endregion

    // ========================================================================
    // Inject NAuth migrations into DataSource
    // ========================================================================
    // Migrations configured at options-level (class references / paths)
    const existingOptionMigrations = (dataSource.options.migrations as unknown[]) || [];
    // Runtime migration instances already built by TypeORM during initialize()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingRuntimeMigrations = ((dataSource as any).migrations as unknown[]) || [];

    // Instantiate NAuth migrations - TypeORM expects *instances* in connection.migrations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nauthMigrationInstances = migrations.map((MigrationClass: any) => new MigrationClass());

    logger?.log(
      `[nauth-toolkit] Injecting ${migrations.length} NAuth migration(s) into DataSource (existing: ${existingRuntimeMigrations.length})`,
    );
    logger?.log(`[nauth-toolkit] Migration names: ${migrations.map((m: any) => m.name).join(', ')}`);

    // Keep options.migrations in sync with class references (for tooling / future rebuilds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource.options as any).migrations = [...existingOptionMigrations, ...migrations];

    // Update live DataSource.migrations with instances used by MigrationExecutor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource as any).migrations = [...existingRuntimeMigrations, ...nauthMigrationInstances];

    // ========================================================================
    // Check for pending migrations
    // ========================================================================
    // #region agent log
    debugFetch
      ?.('http://127.0.0.1:7242/ingest/97f9fe53-6a8b-43e2-ae9b-4b2d0f725816', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'packages/database/typeorm-mysql/src/utils/run-migrations.ts:63',
          message: 'after injection',
          data: {
            optionsMigrationsLength: Array.isArray(dataSource.options.migrations)
              ? dataSource.options.migrations.length
              : null,
            dataSourceMigrationsLength: Array.isArray(
              (dataSource as unknown as { migrations?: unknown[] }).migrations,
            )
              ? ((dataSource as unknown as { migrations?: unknown[] }).migrations ?? []).length
              : null,
          },
          timestamp: Date.now(),
        }),
      })
      .catch(() => {
        // Intentionally ignore debug logging errors
      });
    // #endregion

    logger?.log('[nauth-toolkit] Checking for pending migrations...');
    const hasPending = await dataSource.showMigrations();

    // #region agent log
    debugFetch
      ?.('http://127.0.0.1:7242/ingest/97f9fe53-6a8b-43e2-ae9b-4b2d0f725816', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H2',
          location: 'packages/database/typeorm-mysql/src/utils/run-migrations.ts:83',
          message: 'after showMigrations',
          data: {
            hasPending,
          },
          timestamp: Date.now(),
        }),
      })
      .catch(() => {
        // Intentionally ignore debug logging errors
      });
    // #endregion

    if (!hasPending) {
      logger?.log('[nauth-toolkit] Database schema is up to date');
      return 0;
    }

    // ========================================================================
    // Run migrations with transaction lock
    // Multi-server safe: TypeORM uses database-level locking via migrations table
    // If multiple containers start simultaneously, only one will execute migrations
    // Others will wait and then see the migrations are already applied
    // ========================================================================
    logger?.log('[nauth-toolkit] Running database migrations...');

    const executed = await dataSource.runMigrations({
      transaction: 'all', // All-or-nothing: entire migration batch succeeds or fails together
    });

    if (executed.length > 0) {
      logger?.log(`[nauth-toolkit] Executed ${executed.length} migration(s):`);
      executed.forEach((migration) => {
        logger?.log(`  ✓ ${migration.name}`);
      });
    } else {
      // This can happen if another container executed migrations between
      // showMigrations() and runMigrations() calls (race condition window)
      logger?.log('[nauth-toolkit] No migrations executed (already applied by another instance)');
    }

    return executed.length;
  } catch (error) {
    // ========================================================================
    // Error handling for concurrent execution scenarios
    // ========================================================================
    const message = error instanceof Error ? error.message : String(error);

    // Check if error is due to concurrent migration execution (already applied)
    // This can happen in rare race conditions during simultaneous container startup
    if (
      message.includes('already exists') ||
      message.includes('duplicate key') ||
      message.includes('already been applied')
    ) {
      logger?.warn(
        '[nauth-toolkit] Migrations already applied by another instance (concurrent startup detected)',
      );
      return 0;
    }

    logger?.error('[nauth-toolkit] Migration failed:', error);
    throw new Error(`NAuth migrations failed: ${message}`);
  }
}

