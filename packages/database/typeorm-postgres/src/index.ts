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
