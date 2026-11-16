/**
 * Migrations Bootstrap Service Unit Tests
 *
 * Tests migration bootstrap provider functionality.
 */

import { DataSource } from 'typeorm';
import { nauthMigrationsBootstrapProvider, NAUTH_MIGRATIONS_BOOTSTRAP } from './migrations-bootstrap.service';
import { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';

// Wrap the real adapters so tests can assert whether the migration runner was invoked
// while the other tests keep exercising the real adapter code path.
jest.mock('@nauth-toolkit/database-typeorm-postgres', () => {
  const actual = jest.requireActual('@nauth-toolkit/database-typeorm-postgres');
  return { ...actual, runNAuthMigrations: jest.fn(actual.runNAuthMigrations) };
});
jest.mock('@nauth-toolkit/database-typeorm-mysql', () => {
  const actual = jest.requireActual('@nauth-toolkit/database-typeorm-mysql');
  return { ...actual, runNAuthMigrations: jest.fn(actual.runNAuthMigrations) };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const postgresAdapter = require('@nauth-toolkit/database-typeorm-postgres') as { runNAuthMigrations: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlAdapter = require('@nauth-toolkit/database-typeorm-mysql') as { runNAuthMigrations: jest.Mock };

describe('nauthMigrationsBootstrapProvider', () => {
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    postgresAdapter.runNAuthMigrations.mockClear();
    mysqlAdapter.runNAuthMigrations.mockClear();
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
    } as NAuthConfig;

    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    mockDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
    } as any;
  });

  it('should provide NAUTH_MIGRATIONS_BOOTSTRAP token', () => {
    const provider = nauthMigrationsBootstrapProvider as { provide?: string };
    expect(provider.provide).toBe(NAUTH_MIGRATIONS_BOOTSTRAP);
  });

  it('should inject required dependencies', () => {
    const provider = nauthMigrationsBootstrapProvider as { inject?: unknown[] };
    expect(provider.inject).toEqual(['NAUTH_CONFIG', 'NAUTH_LOGGER', DataSource]);
  });

  it('should return false when DataSource not initialized', async () => {
    const uninitializedDataSource = {
      isInitialized: false,
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    const result = await factory(mockConfig, mockLogger, uninitializedDataSource);

    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('[nauth-toolkit] DataSource not initialized; skipping migrations');
  });

  it('should resolve false and never run the adapter when migrations.autoRun is false', async () => {
    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;

    for (const type of ['postgres', 'mysql', 'mariadb']) {
      const dataSource = { isInitialized: true, options: { type } } as any;
      const result = await factory({ ...mockConfig, migrations: { autoRun: false } }, mockLogger, dataSource);
      expect(result).toBe(false);
    }

    expect(postgresAdapter.runNAuthMigrations).not.toHaveBeenCalled();
    expect(mysqlAdapter.runNAuthMigrations).not.toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(
      '[nauth-toolkit] Automatic migrations disabled (migrations.autoRun: false); skipping.',
    );
  });

  it('should run the adapter when migrations.autoRun is omitted', async () => {
    postgresAdapter.runNAuthMigrations.mockResolvedValueOnce(undefined);
    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;

    const result = await factory(mockConfig, mockLogger, mockDataSource);

    expect(result).toBe(true);
    expect(postgresAdapter.runNAuthMigrations).toHaveBeenCalledWith(mockDataSource, mockLogger, mockConfig);
  });

  it('should return false for unsupported database type', async () => {
    const unsupportedDataSource = {
      isInitialized: true,
      options: { type: 'sqlite' },
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    const result = await factory(mockConfig, mockLogger, unsupportedDataSource);

    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle postgres database type', async () => {
    const postgresDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    // Dynamic import succeeds in monorepo; runNAuthMigrations throws when no DB / invalid config
    await expect(factory(mockConfig, mockLogger, postgresDataSource)).rejects.toThrow();
  }, 20000);

  it('should handle mysql database type', async () => {
    const mysqlDataSource = {
      isInitialized: true,
      options: { type: 'mysql' },
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    await expect(factory(mockConfig, mockLogger, mysqlDataSource)).rejects.toThrow();
  }, 20000);

  it('should handle mariadb database type', async () => {
    const mariadbDataSource = {
      isInitialized: true,
      options: { type: 'mariadb' },
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    await expect(factory(mockConfig, mockLogger, mariadbDataSource)).rejects.toThrow();
  }, 20000);
});
