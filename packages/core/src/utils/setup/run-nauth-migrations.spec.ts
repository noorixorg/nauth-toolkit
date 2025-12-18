import { DataSource } from 'typeorm';
import { runNAuthMigrationsOnStartup } from './run-nauth-migrations';
import { NAuthLogger } from '../nauth-logger';
import { NAuthConfig } from '../../interfaces/config.interface';

const runNAuthMigrationsMock = jest.fn(async () => 0);

jest.mock('@nauth-toolkit/database-typeorm-postgres', () => ({
  runNAuthMigrations: (...args: unknown[]) => runNAuthMigrationsMock(...args),
}));

describe('runNAuthMigrationsOnStartup', () => {
  beforeEach(() => {
    runNAuthMigrationsMock.mockClear();
  });

  it('selects the postgres adapter and passes the prefixed migrations table name', async () => {
    const dataSource = {
      options: { type: 'postgres' },
    } as unknown as DataSource;

    const config: NAuthConfig = {
      tablePrefix: 'app_',
      jwt: { accessToken: { secret: 'x' }, refreshToken: { secret: 'y' } },
    };

    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      isEnabled: jest.fn(() => true),
    } as unknown as NAuthLogger;

    await runNAuthMigrationsOnStartup(config, dataSource, logger);

    expect(runNAuthMigrationsMock).toHaveBeenCalledTimes(1);
    const args = runNAuthMigrationsMock.mock.calls[0];
    expect(args[0]).toBe(dataSource);
    expect(args[2]).toEqual({ migrationsTableName: 'app_migrations' });
  });
});


