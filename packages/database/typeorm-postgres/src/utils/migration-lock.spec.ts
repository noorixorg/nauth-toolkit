import type { DataSource } from 'typeorm';
import type { NAuthLogger } from '@nauth-toolkit/core';
import { acquireMigrationLock, computeAdvisoryLockKey, MIGRATION_LOCK_TIMEOUT_MS } from './migration-lock';

/**
 * Migration Lock Unit Tests (PostgreSQL)
 *
 * Covers advisory lock key derivation and the acquire/wait/release behaviour that keeps
 * parallel container starts from racing on the same schema.
 */
describe('migration-lock (postgres)', () => {
  let mockLogger: jest.Mocked<NAuthLogger>;
  let query: jest.Mock;
  let release: jest.Mock;
  let connect: jest.Mock;
  let dataSource: DataSource;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<NAuthLogger>;

    query = jest.fn();
    release = jest.fn().mockResolvedValue(undefined);
    connect = jest.fn().mockResolvedValue(undefined);

    dataSource = {
      createQueryRunner: (): unknown => ({ connect, query, release }),
    } as unknown as DataSource;
  });

  describe('computeAdvisoryLockKey', () => {
    it('is deterministic for the same migrations table', () => {
      expect(computeAdvisoryLockKey('nauth_migrations')).toBe(computeAdvisoryLockKey('nauth_migrations'));
    });

    it('differs per table prefix so two apps in one database do not block each other', () => {
      expect(computeAdvisoryLockKey('nauth_migrations')).not.toBe(computeAdvisoryLockKey('other_migrations'));
    });

    it('produces a value inside the signed 64-bit range PostgreSQL bigint accepts', () => {
      const key = BigInt(computeAdvisoryLockKey('nauth_migrations'));
      expect(key).toBeGreaterThanOrEqual(-(2n ** 63n));
      expect(key).toBeLessThanOrEqual(2n ** 63n - 1n);
    });
  });

  describe('acquireMigrationLock', () => {
    it('acquires the lock on the first try and releases it explicitly', async () => {
      query.mockResolvedValue([{ acquired: true }]);

      const lock = await acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
      expect(lock).not.toBeNull();

      expect(query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1::bigint) AS acquired', [
        computeAdvisoryLockKey('nauth_migrations'),
      ]);

      await lock!.release();

      expect(query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1::bigint)', [
        computeAdvisoryLockKey('nauth_migrations'),
      ]);
      expect(release).toHaveBeenCalled();
    });

    it('waits for the holder and acquires once the lock frees up', async () => {
      jest.useFakeTimers();
      query.mockResolvedValueOnce([{ acquired: false }]).mockResolvedValue([{ acquired: true }]);

      try {
        const pending = acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
        await jest.advanceTimersByTimeAsync(2_000);

        await expect(pending).resolves.not.toBeNull();
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Another instance is applying migrations'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns null and frees the connection when the wait times out', async () => {
      jest.useFakeTimers();
      query.mockResolvedValue([{ acquired: false }]);

      try {
        const pending = acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
        await jest.advanceTimersByTimeAsync(MIGRATION_LOCK_TIMEOUT_MS + 1_000);

        await expect(pending).resolves.toBeNull();
        expect(release).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('releases the connection when the lock query fails', async () => {
      query.mockRejectedValue(new Error('connection reset'));

      await expect(acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger)).rejects.toThrow(
        'connection reset',
      );
      expect(release).toHaveBeenCalled();
    });

    it('is safe to release more than once', async () => {
      query.mockResolvedValue([{ acquired: true }]);

      const lock = await acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
      await lock!.release();
      await lock!.release();

      expect(release).toHaveBeenCalledTimes(1);
    });

    it('still frees the connection when the unlock query fails', async () => {
      query.mockResolvedValueOnce([{ acquired: true }]).mockRejectedValueOnce(new Error('unlock failed'));

      const lock = await acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
      await lock!.release();

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to release migration advisory lock'));
      expect(release).toHaveBeenCalled();
    });
  });
});
