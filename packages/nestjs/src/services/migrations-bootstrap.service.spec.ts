import { DataSource } from 'typeorm';
import { NAuthMigrationsBootstrapService } from './migrations-bootstrap.service';
import { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';

const runNAuthMigrationsMock = jest.fn(async () => 0);

jest.mock('@nauth-toolkit/database-typeorm-mysql', () => ({
  runNAuthMigrations: (...args: unknown[]) => runNAuthMigrationsMock(...args),
}));

describe('NAuthMigrationsBootstrapService', () => {
  beforeEach(() => {
    runNAuthMigrationsMock.mockClear();
  });

  it('runs migrations on module init with prefixed migrations table name', async () => {
    const dataSource = {
      options: { type: 'mysql' },
    } as unknown as DataSource;

    const config: NAuthConfig = {
      tablePrefix: 'x_',
      jwt: { accessToken: { secret: 'x' }, refreshToken: { secret: 'y' } },
    };

    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      isEnabled: jest.fn(() => true),
    } as unknown as NAuthLogger;

    const svc = new NAuthMigrationsBootstrapService(dataSource, config, logger);
    await svc.onModuleInit();

    expect(runNAuthMigrationsMock).toHaveBeenCalledTimes(1);
    const args = runNAuthMigrationsMock.mock.calls[0];
    expect(args[0]).toBe(dataSource);
    expect(args[2]).toEqual({ migrationsTableName: 'x_migrations' });
  });
});


