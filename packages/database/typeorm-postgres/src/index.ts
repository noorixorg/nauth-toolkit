/**
 * @nauth-toolkit/database-typeorm-postgres
 *
 * PostgreSQL database adapter for nauth-toolkit using TypeORM.
 * Provides all entities needed for PostgreSQL databases.
 */

// Export helper function for getting entities (preferred)
export { getNAuthEntities } from './entities';

// Export entities (for advanced use cases only - prefer getNAuthEntities())
export * from './entities';
