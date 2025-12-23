import type { MigrationInterface } from 'typeorm';
import { Initial1734600000000 } from './1734600000000-Initial';
import { AddSocialProviderSecrets1766480775000 } from './1766480775000-AddSocialProviderSecrets';

export type MigrationConstructor = { new (): MigrationInterface };

/**
 * Adapter-owned migrations for @nauth-toolkit/database-typeorm-mysql
 */
export const migrations: MigrationConstructor[] = [Initial1734600000000, AddSocialProviderSecrets1766480775000];
