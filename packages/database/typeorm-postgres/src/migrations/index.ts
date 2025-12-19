import type { MigrationInterface } from 'typeorm';
import { Initial1734600000000 } from './1734600000000-Initial';

export type MigrationConstructor = { new (): MigrationInterface };

/**
 * Adapter-owned migrations for @nauth-toolkit/database-typeorm-postgres
 */
export const migrations: MigrationConstructor[] = [Initial1734600000000];



