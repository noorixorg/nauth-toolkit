import { DataSource } from 'typeorm';
import { getNAuthEntities, getNAuthTransientStorageEntities } from './entities';

/**
 * TypeORM CLI DataSource (MySQL) for generating migrations
 *
 * @remarks
 * This DataSource is intended for nauth-toolkit maintainers (not consumers) to generate
 * database-specific migrations using TypeORM's CLI.
 *
 * Example:
 *
 * ```bash
 * # From packages/database/typeorm-mysql
 * export DB_HOST=localhost
 * export DB_PORT=3306
 * export DB_USERNAME=root
 * export DB_PASSWORD=password
 * export DB_DATABASE=nauth_migrations_empty
 *
 * npx typeorm migration:generate src/migrations/Initial -d ./src/typeorm-cli.datasource.ts
 * ```
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_DATABASE ?? 'nauth_migrations_empty',
  entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
