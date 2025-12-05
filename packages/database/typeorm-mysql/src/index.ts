/**
 * @nauth-toolkit/database-typeorm-mysql
 *
 * MySQL database adapter for nauth-toolkit using TypeORM.
 * Provides all entities needed for MySQL databases.
 */

// Export helper function for getting entities (preferred)
export { getNAuthEntities, getNAuthTransientStorageEntities } from './entities';

// Export storage entities helper (alias for backward compatibility)
export { getNAuthTransientStorageEntities as getNAuthStorageEntities } from './entities';

// Export entities (for advanced use cases only - prefer getNAuthEntities())
export * from './entities';
