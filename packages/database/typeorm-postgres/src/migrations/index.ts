import { MigrationInterface } from 'typeorm';
import { Initial1734600000000 } from './1734600000000-Initial';

/**
 * TypeORM migration constructor type
 *
 * @internal
 */
export type MigrationConstructor = new () => MigrationInterface;

/**
 * NAuth TypeORM migrations (PostgreSQL)
 *
 * Add migration classes here (in chronological order).
 *
 * @remarks
 * This package intentionally keeps migrations **database-specific** for maximum compatibility.
 * Create the initial "ground zero" migration via TypeORM CLI against an empty database:
 *
 * ```bash
 * # Example (run in this package directory):
 * npx typeorm migration:generate src/migrations/Initial -d ./src/typeorm-cli.datasource.ts
 * ```
 *
 * The generated file should then be imported and added to this array.
 *
 * @internal Used by `runNAuthMigrations()` during bootstrapping.
 */
export const migrations: MigrationConstructor[] = [Initial1734600000000];
