import type { DataSource } from 'typeorm';
import type { NAuthLogger } from '@nauth-toolkit/core';
import { acquireMigrationLock, computeNamedLockKey, MIGRATION_LOCK_TIMEOUT_MS } from './migration-lock';

/**
 * Migration Lock Unit Tests (MySQL)
 *
 * Covers named lock derivation and the acquire/wait/release behaviour that keeps
 * parallel container starts from racing on the same schema.
 */
describe('migration-lock (mysql)', () => {
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

  describe('computeNamedLockKey', () => {
    it('is deterministic for the same migrations table', () => {
      expect(computeNamedLockKey('nauth_migrations')).toBe(computeNamedLockKey('nauth_migrations'));
    });

    it('differs per table prefix so two apps in one database do not block each other', () => {
      expect(computeNamedLockKey('nauth_migrations')).not.toBe(computeNamedLockKey('other_migrations'));
    });

    it('stays within the 64-character limit MySQL enforces on lock names', () => {
      expect(computeNamedLockKey('a'.repeat(200)).length).toBeLessThanOrEqual(64);
    });
  });

  describe('acquireMigrationLock', () => {
    it('acquires the lock on the first try and releases it explicitly', async () => {
      query.mockResolvedValue([{ acquired: 1 }]);

      const lock = await acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
      expect(lock).not.toBeNull();

      expect(query).toHaveBeenCalledWith('SELECT GET_LOCK(?, ?) AS acquired', [
        computeNamedLockKey('nauth_migrations'),
        expect.any(Number),
      ]);

      await lock!.release();

      expect(query).toHaveBeenCalledWith('SELECT RELEASE_LOCK(?) AS acquired', [
        computeNamedLockKey('nauth_migrations'),
      ]);
      expect(release).toHaveBeenCalled();
    });

    it('treats a NULL GET_LOCK result as not acquired', async () => {
      jest.useFakeTimers();
      query.mockResolvedValueOnce([{ acquired: null }]).mockResolvedValue([{ acquired: 1 }]);

      try {
        const pending = acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
        await jest.advanceTimersByTimeAsync(2_000);

        await expect(pending).resolves.not.toBeNull();
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Another instance is applying migrations'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('waits for the holder and acquires once the lock frees up', async () => {
      jest.useFakeTimers();
      query.mockResolvedValueOnce([{ acquired: 0 }]).mockResolvedValue([{ acquired: 1 }]);

      try {
        const pending = acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
        await jest.advanceTimersByTimeAsync(2_000);

        await expect(pending).resolves.not.toBeNull();
        expect(query).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns null and frees the connection when the wait times out', async () => {
      jest.useFakeTimers();
      query.mockResolvedValue([{ acquired: 0 }]);

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
      query.mockResolvedValue([{ acquired: 1 }]);

      const lock = await acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
      await lock!.release();
      await lock!.release();

      expect(release).toHaveBeenCalledTimes(1);
    });

    it('still frees the connection when the unlock query fails', async () => {
      query.mockResolvedValueOnce([{ acquired: 1 }]).mockRejectedValueOnce(new Error('unlock failed'));

      const lock = await acquireMigrationLock(dataSource, 'nauth_migrations', mockLogger);
      await lock!.release();

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to release migration named lock'));
      expect(release).toHaveBeenCalled();
    });
  });
});
