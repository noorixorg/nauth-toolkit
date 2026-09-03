/**
 * @nauth-toolkit/database-typeorm-postgres
 *
 * PostgreSQL database adapter for nauth-toolkit using TypeORM.
 * Provides all entities needed for PostgreSQL databases.
 */

// Export helper function for getting entities (preferred)
export { getNAuthEntities, getNAuthTransientStorageEntities } from './entities';

// Export entities (for advanced use cases only - prefer getNAuthEntities())
export * from './entities';

// ============================================================================
// Migrations
// ============================================================================

/**
 * Run pending nauth-toolkit migrations (PostgreSQL)
 *
 * @remarks
 * This is invoked automatically by nauth-toolkit during bootstrap.
 * Consumers should not need to call this directly.
 */
export { runNAuthMigrations } from './utils/run-migrations';

/**
 * Migration lock helpers (PostgreSQL).
 *
 * @remarks
 * Exported so consumers applying migrations out-of-band (an ECS one-off task, a
 * Kubernetes Job) can take the same lock nauth-toolkit uses and stay mutually
 * exclusive with any instance that still boots with `migrations.autoRun` enabled.
 * The lock is a session-scoped advisory lock (`pg_try_advisory_lock`) derived from the
 * migrations table name.
 */
export { acquireMigrationLock, computeAdvisoryLockKey, MIGRATION_LOCK_TIMEOUT_MS } from './utils/migration-lock';
export type { MigrationLockHandle } from './utils/migration-lock';
