import { DataSource } from 'typeorm';
import { runNAuthMigrations } from './run-migrations';

jest.mock('../migrations', () => {
  class DummyMigration {
    name = 'DummyMigration';
    // eslint-disable-next-line @typescript-eslint/require-await
    async up(): Promise<void> {}
    // eslint-disable-next-line @typescript-eslint/require-await
    async down(): Promise<void> {}
  }

  return { migrations: [DummyMigration] };
});

describe('runNAuthMigrations (mysql)', () => {
  it('injects migrations and runs pending migrations', async () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const dataSource = {
      options: {
        type: 'mysql',
        migrations: [],
        migrationsTableName: undefined,
      },
      migrations: [],
      showMigrations: jest.fn(async () => true),
      runMigrations: jest.fn(async () => [{ name: 'DummyMigration' }]),
    } as unknown as DataSource;

    const executed = await runNAuthMigrations(dataSource, logger, { migrationsTableName: 'nauth_migrations' });

    expect(executed).toBe(1);
    expect(logger.log).toHaveBeenCalled();
    expect((dataSource.options as unknown as { migrationsTableName?: string }).migrationsTableName).toBe('nauth_migrations');
    expect((dataSource as unknown as { migrations?: unknown[] }).migrations?.length).toBeGreaterThanOrEqual(1);
    expect(dataSource.showMigrations).toHaveBeenCalledTimes(1);
    expect(dataSource.runMigrations).toHaveBeenCalledTimes(1);
  });
});


