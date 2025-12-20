/**
 * Storage Adapter Initialization Helper
 *
 * Initializes storage adapter with repository injection and proper error handling.
 */

import { Repository, type ObjectLiteral } from 'typeorm';
import { StorageAdapter, LoggerService, NAuthConfig, NAuthException, AuthErrorCode } from '../../index';

/**
 * Import an optional peer dependency at runtime without creating a compile-time
 * dependency for TypeScript consumers of `@nauth-toolkit/core`.
 *
 * IMPORTANT: the module specifier is intentionally typed as `string` (not a literal)
 * to prevent TypeScript from erroring when the peer dependency isn't installed.
 */
async function importOptional<TModule>(moduleName: string): Promise<TModule | null> {
  try {
    return (await import(moduleName)) as unknown as TModule;
  } catch {
    return null;
  }
}

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
  rateLimitRepo: Repository<ObjectLiteral> | null,
  storageLockRepo: Repository<ObjectLiteral> | null,
  logger: LoggerService,
): Promise<StorageAdapter> {
  // If storage adapter explicitly provided, use it
  if (config.storageAdapter) {
    const adapter = config.storageAdapter;

    // Inject logger if adapter supports it
    {
      const maybeLoggerAware = adapter as { setLogger?: (logger: LoggerService) => void };
      if (typeof maybeLoggerAware.setLogger === 'function') {
        maybeLoggerAware.setLogger(logger);
      }
    }

    // Inject repositories into DatabaseStorageAdapter if it supports it
    {
      const maybeRepoAware = adapter as {
        setRepositories?: (
          rateLimitRepo: Repository<ObjectLiteral>,
          storageLockRepo: Repository<ObjectLiteral>,
        ) => void;
      };
      if (typeof maybeRepoAware.setRepositories === 'function' && rateLimitRepo && storageLockRepo) {
        maybeRepoAware.setRepositories(rateLimitRepo, storageLockRepo);
      }
    }

    await adapter.initialize();
    return adapter;
  }

  // No storage adapter provided - try to use DatabaseStorageAdapter if repositories available
  if (rateLimitRepo && storageLockRepo) {
    try {
      type DatabaseStorageAdapterModule = {
        DatabaseStorageAdapter: new (...args: unknown[]) => StorageAdapter & {
          setRepositories?: (
            rateLimitRepo: Repository<ObjectLiteral>,
            storageLockRepo: Repository<ObjectLiteral>,
          ) => void;
        };
      };

      // Lazy import to avoid bundling if not used
      const mod = await importOptional<DatabaseStorageAdapterModule>('@nauth-toolkit/storage-database' as string);
      if (!mod) {
        throw new Error('storage-database package not installed');
      }

      const adapter = new mod.DatabaseStorageAdapter(null, null, logger);
      if (typeof adapter.setRepositories === 'function') {
        adapter.setRepositories(rateLimitRepo, storageLockRepo);
      }
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
        { error: error as Error },
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
