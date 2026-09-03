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
 * Delay between advisory lock acquisition attempts while waiting.
 */
const LOCK_RETRY_DELAY_MS = 1_000;

/**
 * A held PostgreSQL advisory lock.
 */
export interface MigrationLockHandle {
  /**
   * Release the advisory lock and return its connection to the pool.
   *
   * Safe to call more than once.
   */
  release(): Promise<void>;
}

/**
 * Shape of the single row returned by `pg_try_advisory_lock`.
 */
type AdvisoryLockRow = { acquired?: unknown };

/**
 * Derive a stable 64-bit PostgreSQL advisory lock key from the migrations table name.
 *
 * @remarks
 * Deriving from the table name means two applications sharing one database but using
 * different `tablePrefix` values migrate independently instead of blocking each other.
 *
 * @param migrationsTableName - Name of the nauth migrations table
 * @returns Signed 64-bit key as a decimal string (PostgreSQL `bigint`)
 */
export function computeAdvisoryLockKey(migrationsTableName: string): string {
  const digest = createHash('sha256').update(`nauth-toolkit:migrations:${migrationsTableName}`).digest();
  return BigInt.asIntN(64, digest.readBigUInt64BE(0)).toString();
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
 * Acquire a PostgreSQL session-level advisory lock for the migration run.
 *
 * @remarks
 * The lock is held on a dedicated `QueryRunner` connection for the entire migration run.
 * PostgreSQL releases session-level advisory locks automatically when the connection
 * ends, so a crashed or killed instance can never leave a permanent lock behind — this
 * is why an advisory lock is used rather than a lock row in a table.
 *
 * Polls with `pg_try_advisory_lock` instead of blocking on `pg_advisory_lock` so that
 * waiting is bounded by {@link MIGRATION_LOCK_TIMEOUT_MS} and progress can be logged.
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
  const lockKey = computeAdvisoryLockKey(migrationsTableName);
  const queryRunner: QueryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  let released = false;
  const handle: MigrationLockHandle = {
    async release(): Promise<void> {
      if (released) return;
      released = true;
      try {
        await queryRunner.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey]);
      } catch (err) {
        // Non-fatal: PostgreSQL drops the lock when the session ends.
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`[nauth-toolkit] Failed to release migration advisory lock: ${message}`);
      } finally {
        await queryRunner.release();
      }
    },
  };

  const deadline = Date.now() + MIGRATION_LOCK_TIMEOUT_MS;
  let waitLogged = false;

  try {
    for (;;) {
      const rows = (await queryRunner.query('SELECT pg_try_advisory_lock($1::bigint) AS acquired', [
        lockKey,
      ])) as AdvisoryLockRow[];

      if (rows[0]?.acquired === true) {
        logger.debug(`[nauth-toolkit] Acquired migration advisory lock (key: ${lockKey})`);
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
