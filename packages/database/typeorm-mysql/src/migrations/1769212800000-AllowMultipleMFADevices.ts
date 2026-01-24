import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow multiple MFA devices per method (MySQL).
 *
 * WHY:
 * - Users may enroll multiple devices for the same MFA method (e.g., multiple TOTP authenticators
 *   and multiple passkeys) for redundancy.
 * - We retain passkey de-duplication by enforcing uniqueness on (userId, type, credentialId).
 *
 * MySQL note:
 * - MySQL cannot create a unique index on a TEXT column without a prefix length, so we narrow
 *   `credentialId` to VARCHAR(512) first.
 */
export class AllowMultipleMFADevices1769212800000 implements MigrationInterface {
  name = 'AllowMultipleMFADevices1769212800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================================
    // Drop legacy unique index (single device per method per user)
    // ============================================================================
    await queryRunner.query(`
      DROP INDEX \`uq_mfa_device_user_type\` ON \`nauth_mfa_devices\`
    `);

    // ============================================================================
    // Make credentialId indexable (required for uniqueness key)
    // ============================================================================
    await queryRunner.query(`
      ALTER TABLE \`nauth_mfa_devices\`
      MODIFY \`credentialId\` varchar(512) NULL
    `);

    // ============================================================================
    // Add passkey-safe uniqueness (prevents duplicate credential registration)
    // ============================================================================
    await queryRunner.query(`
      CREATE UNIQUE INDEX \`uq_mfa_device_user_type_credential\`
      ON \`nauth_mfa_devices\` (\`userId\`, \`type\`, \`credentialId\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX \`uq_mfa_device_user_type_credential\` ON \`nauth_mfa_devices\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`nauth_mfa_devices\`
      MODIFY \`credentialId\` text NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX \`uq_mfa_device_user_type\`
      ON \`nauth_mfa_devices\` (\`userId\`, \`type\`)
    `);
  }
}

