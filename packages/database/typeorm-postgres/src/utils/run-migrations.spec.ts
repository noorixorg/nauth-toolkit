import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import type { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';

const capturedOptions: Array<Record<string, unknown>> = [];
const runMigrations = jest.fn().mockResolvedValue([]);
const destroy = jest.fn().mockResolvedValue(undefined);

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    DataSource: jest.fn().mockImplementation((options: Record<string, unknown>) => {
      capturedOptions.push(options);
      return {
        isInitialized: true,
        initialize: jest.fn().mockResolvedValue(undefined),
        runMigrations,
        destroy,
      };
    }),
  };
});

jest.mock('./migration-lock', () => ({
  MIGRATION_LOCK_TIMEOUT_MS: 1000,
  acquireMigrationLock: jest.fn().mockResolvedValue({ release: jest.fn().mockResolvedValue(undefined) }),
}));

import { runNAuthMigrations } from './run-migrations';

/**
 * Migration Bootstrap Unit Tests (PostgreSQL)
 *
 * The nauth migration run happens on its own DataSource, so every connection option the
 * consumer relies on has to be copied across. These tests pin the options that are not
 * re-derivable from the credentials alone - TLS and the target schema.
 */
describe('runNAuthMigrations (postgres)', () => {
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<NAuthLogger>;

  const config = {} as NAuthConfig;

  beforeEach(() => {
    capturedOptions.length = 0;
    jest.clearAllMocks();
  });

  it('carries ssl and schema onto the isolated DataSource', async () => {
    const consumer = {
      options: {
        type: 'postgres',
        host: 'db.internal',
        port: 5432,
        username: 'app',
        password: 'secret',
        database: 'app',
        schema: 'auth',
        ssl: { rejectUnauthorized: false },
        extra: { max: 10 },
      },
    } as unknown as DataSource;

    await runNAuthMigrations(consumer, logger, config);

    expect(capturedOptions).toHaveLength(1);
    expect(capturedOptions[0]).toMatchObject({
      type: 'postgres',
      host: 'db.internal',
      port: 5432,
      username: 'app',
      password: 'secret',
      database: 'app',
      schema: 'auth',
      ssl: { rejectUnauthorized: false },
      extra: { max: 10 },
      migrationsTableName: 'nauth_migrations',
      synchronize: false,
    });
  });

  it('carries ssl onto the isolated DataSource when the consumer connects by url', async () => {
    const consumer = {
      options: {
        type: 'postgres',
        url: 'postgres://app:secret@db.internal:5432/app',
        ssl: true,
      },
    } as unknown as DataSource;

    await runNAuthMigrations(consumer, logger, config);

    expect(capturedOptions[0]).toMatchObject({
      url: 'postgres://app:secret@db.internal:5432/app',
      ssl: true,
    });
  });

  it('leaves ssl undefined for a plaintext consumer connection', async () => {
    const consumer = {
      options: { type: 'postgres', host: 'localhost', port: 5432, database: 'app' },
    } as unknown as DataSource;

    await runNAuthMigrations(consumer, logger, config);

    expect(capturedOptions[0].ssl).toBeUndefined();
  });

  it('honours the configured table prefix for the migrations table', async () => {
    const consumer = { options: { type: 'postgres', host: 'localhost' } } as unknown as DataSource;

    await runNAuthMigrations(consumer, logger, { tablePrefix: 'acme_' } as NAuthConfig);

    expect(capturedOptions[0].migrationsTableName).toBe('acme_migrations');
  });
});
