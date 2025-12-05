/**
 * Storage Adapter Initialization Helper
 *
 * Initializes storage adapter with repository injection and proper error handling.
 */

import { Repository } from 'typeorm';
import { StorageAdapter, LoggerService, NAuthConfig, NAuthException, AuthErrorCode } from '../../index';

/**
 * Initialize storage adapter
 *
 * Handles:
 * - Logger injection (if adapter supports it)
 * - Repository injection (for DatabaseStorageAdapter)
 * - Adapter initialization
 * - Fallback to DatabaseStorageAdapter if no adapter provided and repositories available
 * - Error if no adapter and no repositories (prevents unsafe defaults)
 *
 * @param config - NAuth configuration
 * @param rateLimitRepo - RateLimit repository (nullable)
 * @param storageLockRepo - StorageLock repository (nullable)
 * @param logger - Logger instance
 * @returns Initialized StorageAdapter
 * @throws {NAuthException} If no adapter provided and DatabaseStorageAdapter cannot be created
 */
export async function initStorage(
  config: NAuthConfig,
  rateLimitRepo: Repository<any> | null,
  storageLockRepo: Repository<any> | null,
  logger: LoggerService,
): Promise<StorageAdapter> {
  // If storage adapter explicitly provided, use it
  if (config.storageAdapter) {
    const adapter = config.storageAdapter;

    // Inject logger if adapter supports it
    if (adapter && typeof (adapter as any).setLogger === 'function') {
      (adapter as any).setLogger(logger);
    }

    // Inject repositories into DatabaseStorageAdapter if it supports it
    if (adapter && typeof (adapter as any).setRepositories === 'function') {
      if (rateLimitRepo && storageLockRepo) {
        (adapter as any).setRepositories(rateLimitRepo, storageLockRepo);
      }
    }

    await adapter.initialize();
    return adapter;
  }

  // No storage adapter provided - try to use DatabaseStorageAdapter if repositories available
  if (rateLimitRepo && storageLockRepo) {
    try {
      // Lazy import to avoid bundling if not used
      // @ts-ignore - Dynamic import of optional peer dependency
      const { DatabaseStorageAdapter } = await import('@nauth-toolkit/storage-database');
      const adapter = new DatabaseStorageAdapter(null, null, logger as any);
      adapter.setRepositories(rateLimitRepo as any, storageLockRepo as any);
      await adapter.initialize();

      logger?.warn?.(
        'WARNING: Storage adapter not provided. Using DatabaseStorageAdapter as default. ' +
          'For production, explicitly configure storageAdapter in your config.',
      );

      return adapter;
    } catch (error) {
      // If DatabaseStorageAdapter import fails, fall through to error
      logger?.error?.(
        'Failed to create DatabaseStorageAdapter. Please explicitly configure storageAdapter in your config.',
        { error },
      );
    }
  }

  // No storage adapter provided and no repositories available - REQUIRE explicit configuration
  throw new NAuthException(
    AuthErrorCode.VALIDATION_FAILED,
    'Storage adapter is REQUIRED for production deployments. ' +
      'MemoryStorageAdapter is NOT safe for production (data lost on restart, not shared across instances). ' +
      'Please configure storageAdapter in your NAuthConfig:\n\n' +
      'Option 1: DatabaseStorageAdapter (recommended if you have a database)\n' +
      '  import { createDatabaseStorageAdapter } from "@nauth-toolkit/express";\n' +
      '  storageAdapter: createDatabaseStorageAdapter()\n\n' +
      'Option 2: RedisStorageAdapter (for high-performance multi-server deployments)\n' +
      '  import { createRedisStorageAdapter } from "@nauth-toolkit/express";\n' +
      '  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL)\n\n' +
      'Make sure to include storage entities in your DataSource configuration:\n' +
      '  import { getNAuthStorageEntities } from "@nauth-toolkit/database-typeorm-postgres";\n' +
      '  entities: [...getNAuthEntities(), ...getNAuthStorageEntities()]',
  );
}
