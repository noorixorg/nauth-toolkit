/**
 * Run NAuth Migrations Unit Tests
 *
 * Tests migration runner functionality including:
 * - DataSource initialization checks
 * - Database type detection
 * - Dynamic adapter loading
 * - Error handling
 */

import { DataSource } from 'typeorm';
import { runNAuthMigrationsOnStartup } from './run-nauth-migrations';
import { NAuthConfig } from '../../interfaces/config.interface';
import { NAuthLogger } from '../../utils/nauth-logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const postgresAdapter = require('@nauth-toolkit/database-typeorm-postgres') as { runNAuthMigrations: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlAdapter = require('@nauth-toolkit/database-typeorm-mysql') as { runNAuthMigrations: jest.Mock };

// Mock dynamic imports
jest.mock(
  '@nauth-toolkit/database-typeorm-postgres',
  () => ({
    runNAuthMigrations: jest.fn().mockResolvedValue(undefined),
  }),
  { virtual: true },
);

jest.mock(
  '@nauth-toolkit/database-typeorm-mysql',
  () => ({
    runNAuthMigrations: jest.fn().mockResolvedValue(undefined),
  }),
  { virtual: true },
);

describe('runNAuthMigrationsOnStartup', () => {
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  beforeEach(() => {
    postgresAdapter.runNAuthMigrations.mockClear();
    mysqlAdapter.runNAuthMigrations.mockClear();
    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
    } as NAuthConfig;
  });

  it('should skip migrations entirely when autoRun is disabled', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(
      { ...mockConfig, migrations: { autoRun: false } },
      mockDataSource as DataSource,
      mockLogger,
    );

    expect(result).toBe(false);
    expect(postgresAdapter.runNAuthMigrations).not.toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(
      '[nauth-toolkit] Automatic migrations disabled (migrations.autoRun: false); skipping.',
    );
  });

  it('should still run migrations when autoRun is explicitly enabled', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(
      { ...mockConfig, migrations: { autoRun: true } },
      mockDataSource as DataSource,
      mockLogger,
    );

    expect(result).toBe(true);
    expect(postgresAdapter.runNAuthMigrations).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).not.toHaveBeenCalledWith(
      '[nauth-toolkit] Automatic migrations disabled (migrations.autoRun: false); skipping.',
    );
  });

  it('should skip migrations when DataSource is not initialized', async () => {
    const mockDataSource = {
      isInitialized: false,
      options: { type: 'postgres' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(result).toBe(false);
    expect(postgresAdapter.runNAuthMigrations).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('[nauth-toolkit] DataSource not initialized; skipping migrations');
  });

  it('should return false when DataSource is undefined', async () => {
    const result = await runNAuthMigrationsOnStartup(mockConfig, undefined as unknown as DataSource, mockLogger);

    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('[nauth-toolkit] DataSource not initialized; skipping migrations');
  });

  it('should skip migrations for unsupported database types', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'sqlite' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[nauth-toolkit] Skipping migrations: unsupported TypeORM DataSource type'),
    );
  });

  it('should detect postgres database type', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(result).toBe(true);
    expect(postgresAdapter.runNAuthMigrations).toHaveBeenCalledWith(mockDataSource, mockLogger, mockConfig);
    expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('DataSource not initialized'));
  });

  it('should detect mysql database type', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'mysql' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(result).toBe(true);
    expect(mysqlAdapter.runNAuthMigrations).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('DataSource not initialized'));
  });

  it('should detect mariadb database type', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'mariadb' },
    } as any;

    const result = await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(result).toBe(true);
    expect(mysqlAdapter.runNAuthMigrations).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('DataSource not initialized'));
  });

  it('should handle undefined options gracefully', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: undefined,
    } as any;

    const result = await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
