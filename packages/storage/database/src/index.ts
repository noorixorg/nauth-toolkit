/**
 * Database Storage Adapter Package
 *
 * Provides DatabaseStorageAdapter for persistent storage of transient state
 * (rate limits, locks, token reuse tracking) using TypeORM repositories.
 *
 * @example
 * ```typescript
 * import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
 * import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';
 *
 * TypeOrmModule.forRoot({
 *   entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
 * });
 *
 * AuthModule.forRoot({
 *   storageAdapter: new DatabaseStorageAdapter(), // Uses injected repositories
 * });
 * ```
 */

export { DatabaseStorageAdapter } from './database-storage.adapter';
