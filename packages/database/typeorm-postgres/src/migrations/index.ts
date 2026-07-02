import type { MigrationInterface } from 'typeorm';
import { Initial1734600000000 } from './1734600000000-Initial';
import { AddSocialProviderSecrets1766480775000 } from './1766480775000-AddSocialProviderSecrets';
import { AllowMultipleMFADevices1769212800000 } from './1769212800000-AllowMultipleMFADevices';
import { AddApiKeys1769300000000 } from './1769300000000-AddApiKeys';

export type MigrationConstructor = { new (): MigrationInterface };

/**
 * Adapter-owned migrations for @nauth-toolkit/database-typeorm-postgres
 */
export const migrations: MigrationConstructor[] = [
  Initial1734600000000,
  AddSocialProviderSecrets1766480775000,
  AllowMultipleMFADevices1769212800000,
  AddApiKeys1769300000000,
];
