import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getNAuthEntities, getNAuthTransientStorageEntities } from './entities';
import { migrations } from './migrations';

/**
 * TypeORM DataSource used ONLY for CLI migration generation.
 *
 * @example
 * `npx typeorm-ts-node-commonjs migration:generate src/migrations/Initial -d src/typeorm-cli.datasource.ts`
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
  migrations,
  synchronize: false,
  logging: false,
});





