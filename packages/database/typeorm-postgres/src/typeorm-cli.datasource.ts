import { DataSource } from 'typeorm';
import { getNAuthEntities, getNAuthTransientStorageEntities } from './entities';

/**
 * TypeORM CLI DataSource (PostgreSQL) for generating migrations
 *
 * @remarks
 * This DataSource is intended for nauth-toolkit maintainers (not consumers) to generate
 * database-specific migrations using TypeORM's CLI.
 *
 * Example:
 *
 * ```bash
 * # From packages/database/typeorm-postgres
 * export DB_HOST=localhost
 * export DB_PORT=5432
 * export DB_USERNAME=postgres
 * export DB_PASSWORD=password
 * export DB_DATABASE=nauth_migrations_empty
 *
 * npx typeorm migration:generate src/migrations/Initial -d ./src/typeorm-cli.datasource.ts
 * ```
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_DATABASE ?? 'nauth_migrations_empty',
  entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
