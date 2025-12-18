import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';

/**
 * NAuth migrations bootstrap service (NestJS)
 *
 * @remarks
 * Runs database adapter migrations automatically during NestJS module initialization.
 * This keeps consumer apps free from migration wiring while ensuring schema compatibility
 * as users upgrade nauth-toolkit packages.
 *
 * @example
 * ```typescript
 * // Consumer apps do NOT need to call anything manually:
 * @Module({
 *   imports: [
 *     TypeOrmModule.forRoot({ synchronize: false, entities: getNAuthEntities() }),
 *     AuthModule.forRoot(config),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class NAuthMigrationsBootstrapService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('NAUTH_CONFIG') private readonly config: NAuthConfig,
    @Inject('NAUTH_LOGGER') private readonly logger: NAuthLogger,
  ) {}

  /**
   * Run pending migrations during module initialization.
   *
   * @throws {Error} When migrations fail
   */
  async onModuleInit(): Promise<void> {
    const dbType = this.dataSource.options.type;
    const tablePrefix = this.config.tablePrefix ?? 'nauth_';
    const migrationsTableName = `${tablePrefix}migrations`;

    let adapterPackageName: string | null = null;
    if (dbType === 'postgres') adapterPackageName = '@nauth-toolkit/database-typeorm-postgres';
    if (dbType === 'mysql') adapterPackageName = '@nauth-toolkit/database-typeorm-mysql';

    if (!adapterPackageName) {
      this.logger.debug?.(`[nauth-toolkit] Skipping migrations (unsupported TypeORM driver: ${String(dbType)})`);
      return;
    }

    const imported = (await import(adapterPackageName)) as unknown;
    const runNAuthMigrations = (imported as { runNAuthMigrations?: unknown }).runNAuthMigrations;

    if (typeof runNAuthMigrations !== 'function') {
      throw new Error(
        `[nauth-toolkit] ${adapterPackageName} does not export runNAuthMigrations(). ` +
          `Install/upgrade the database adapter package to enable automatic migrations.`,
      );
    }

    this.logger.log?.(`[nauth-toolkit] Ensuring database schema via migrations (${adapterPackageName})...`);

    await (
      runNAuthMigrations as (ds: DataSource, log?: unknown, opts?: { migrationsTableName?: string }) => Promise<number>
    )(this.dataSource, this.logger, { migrationsTableName });
  }
}
