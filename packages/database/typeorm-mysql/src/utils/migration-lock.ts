import { createHash } from 'crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import type { NAuthLogger } from '@nauth-toolkit/core';

/**
 * How long to wait for another instance to finish migrating before giving up.
 *
 * @remarks
 * Deliberately not configurable. Long enough to cover a realistic migration on a large
 * table, short enough that a genuinely stuck deploy fails with a clear error instead of
 * hanging forever.
 */
export const MIGRATION_LOCK_TIMEOUT_MS = 300_000;

/**
 * Delay between named lock acquisition attempts while waiting.
 */
const LOCK_RETRY_DELAY_MS = 1_000;

/**
 * Longest single `GET_LOCK` wait, in seconds.
 *
 * `GET_LOCK` blocks the connection for its timeout, so it is called in short slices to
 * keep the overall wait bounded and loggable.
 */
const GET_LOCK_SLICE_SECONDS = 5;

/**
 * A held MySQL named lock.
 */
export interface MigrationLockHandle {
  /**
   * Release the named lock and return its connection to the pool.
   *
   * Safe to call more than once.
   */
  release(): Promise<void>;
}

/**
 * Shape of the single row returned by `GET_LOCK` / `RELEASE_LOCK`.
 */
type NamedLockRow = { acquired?: unknown };

/**
 * Derive a stable MySQL named lock string from the migrations table name.
 *
 * @remarks
 * MySQL caps lock names at 64 characters, so the table name is hashed rather than
 * embedded. Deriving from the table name means two applications sharing one database
 * but using different `tablePrefix` values migrate independently.
 *
 * @param migrationsTableName - Name of the nauth migrations table
 * @returns Lock name (49 characters)
 */
export function computeNamedLockKey(migrationsTableName: string): string {
  const digest = createHash('sha256')
    .update(`nauth-toolkit:migrations:${migrationsTableName}`)
    .digest('hex')
    .slice(0, 32);
  return `nauth_migrations_${digest}`;
}

/**
 * Pause for the given number of milliseconds.
 *
 * @param ms - Delay in milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquire a MySQL/MariaDB session-level named lock for the migration run.
 *
 * @remarks
 * The lock is held on a dedicated `QueryRunner` connection for the entire migration run.
 * MySQL releases named locks automatically when the connection ends, so a crashed or
 * killed instance can never leave a permanent lock behind — this is why a named lock is
 * used rather than a lock row in a table.
 *
 * Locking matters more on MySQL than on PostgreSQL: MySQL commits implicitly on DDL, so
 * two instances running the same migration concurrently can leave the schema half
 * applied with no rollback.
 *
 * @param dataSource - Initialized DataSource used for the migration run
 * @param migrationsTableName - Name of the nauth migrations table (scopes the lock)
 * @param logger - NAuth logger instance
 * @returns A handle to release the lock, or `null` if it could not be acquired in time
 */
export async function acquireMigrationLock(
  dataSource: DataSource,
  migrationsTableName: string,
  logger: NAuthLogger,
): Promise<MigrationLockHandle | null> {
  const lockName = computeNamedLockKey(migrationsTableName);
  const queryRunner: QueryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  let released = false;
  const handle: MigrationLockHandle = {
    async release(): Promise<void> {
      if (released) return;
      released = true;
      try {
        await queryRunner.query('SELECT RELEASE_LOCK(?) AS acquired', [lockName]);
      } catch (err) {
        // Non-fatal: MySQL drops the lock when the session ends.
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`[nauth-toolkit] Failed to release migration named lock: ${message}`);
      } finally {
        await queryRunner.release();
      }
    },
  };

  const deadline = Date.now() + MIGRATION_LOCK_TIMEOUT_MS;
  let waitLogged = false;

  try {
    for (;;) {
      const remainingMs = deadline - Date.now();
      const sliceSeconds = Math.max(0, Math.min(GET_LOCK_SLICE_SECONDS, Math.ceil(remainingMs / 1000)));

      const rows = (await queryRunner.query('SELECT GET_LOCK(?, ?) AS acquired', [
        lockName,
        sliceSeconds,
      ])) as NamedLockRow[];

      // GET_LOCK returns 1 on success, 0 on timeout, NULL on error.
      if (Number(rows[0]?.acquired) === 1) {
        logger.debug(`[nauth-toolkit] Acquired migration named lock (${lockName})`);
        return handle;
      }

      if (Date.now() >= deadline) {
        await queryRunner.release();
        return null;
      }

      if (!waitLogged) {
        waitLogged = true;
        logger.log('[nauth-toolkit] Another instance is applying migrations; waiting for it to finish...');
      }

      await delay(LOCK_RETRY_DELAY_MS);
    }
  } catch (err) {
    await queryRunner.release();
    throw err;
  }
}
