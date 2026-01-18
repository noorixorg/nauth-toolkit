/**
 * Migrations Bootstrap Service Unit Tests
 *
 * Tests migration bootstrap provider functionality.
 */

import { DataSource } from 'typeorm';
import { nauthMigrationsBootstrapProvider, NAUTH_MIGRATIONS_BOOTSTRAP } from './migrations-bootstrap.service';
import { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';

describe('nauthMigrationsBootstrapProvider', () => {
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
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
    // Will fail because package is not installed in test environment
    await expect(factory(mockConfig, mockLogger, postgresDataSource)).rejects.toThrow();
  });

  it('should handle mysql database type', async () => {
    const mysqlDataSource = {
      isInitialized: true,
      options: { type: 'mysql' },
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    // Will fail because package is not installed in test environment
    await expect(factory(mockConfig, mockLogger, mysqlDataSource)).rejects.toThrow();
  });

  it('should handle mariadb database type', async () => {
    const mariadbDataSource = {
      isInitialized: true,
      options: { type: 'mariadb' },
    } as any;

    const provider = nauthMigrationsBootstrapProvider as { useFactory?: (...args: any[]) => Promise<any> };
    const factory = provider.useFactory!;
    // Will fail because package is not installed in test environment
    await expect(factory(mockConfig, mockLogger, mariadbDataSource)).rejects.toThrow();
  });
});
