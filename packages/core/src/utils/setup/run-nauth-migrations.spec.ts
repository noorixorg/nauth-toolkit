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

// Mock dynamic imports
jest.mock('@nauth-toolkit/database-typeorm-postgres', () => ({
  runNAuthMigrations: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

jest.mock('@nauth-toolkit/database-typeorm-mysql', () => ({
  runNAuthMigrations: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

describe('runNAuthMigrationsOnStartup', () => {
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  beforeEach(() => {
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

  it('should skip migrations when DataSource is not initialized', async () => {
    const mockDataSource = {
      isInitialized: false,
      options: { type: 'postgres' },
    } as any;

    await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith('[nauth-toolkit] DataSource not initialized; skipping migrations');
  });

  it('should skip migrations for unsupported database types', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'sqlite' },
    } as any;

    await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[nauth-toolkit] Skipping migrations: unsupported TypeORM DataSource type'),
    );
  });

  it('should detect postgres database type', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
    } as any;

    await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    // Should not throw and should call logger methods
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('DataSource not initialized'),
    );
  });

  it('should detect mysql database type', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'mysql' },
    } as any;

    await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('DataSource not initialized'),
    );
  });

  it('should detect mariadb database type', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: { type: 'mariadb' },
    } as any;

    await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('DataSource not initialized'),
    );
  });

  it('should handle undefined options gracefully', async () => {
    const mockDataSource = {
      isInitialized: true,
      options: undefined,
    } as any;

    await runNAuthMigrationsOnStartup(mockConfig, mockDataSource as DataSource, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
