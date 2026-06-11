import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow multiple MFA devices per method (PostgreSQL).
 *
 * WHY:
 * - Users may enroll multiple devices for the same MFA method (e.g., multiple TOTP authenticators
 *   and multiple passkeys) for redundancy.
 * - We retain passkey de-duplication by enforcing uniqueness on (userId, type, credentialId).
 *
 * Notes:
 * - `credentialId` is populated only for passkey devices.
 * - Unique constraints treat NULL values as distinct, so non-passkey methods remain unaffected.
 */
export class AllowMultipleMFADevices1769212800000 implements MigrationInterface {
  name = 'AllowMultipleMFADevices1769212800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================================
    // Drop legacy unique constraint (single device per method per user)
    // ============================================================================
    await queryRunner.query(`
      ALTER TABLE "nauth_mfa_devices"
      DROP CONSTRAINT IF EXISTS "uq_mfa_device_user_type"
    `);

    // ============================================================================
    // Ensure credentialId is bounded and indexable across adapters
    // ============================================================================
    await queryRunner.query(`
      ALTER TABLE "nauth_mfa_devices"
      ALTER COLUMN "credentialId" TYPE character varying(512)
    `);

    // ============================================================================
    // Add passkey-safe uniqueness (prevents duplicate credential registration)
    // ============================================================================
    await queryRunner.query(`
      ALTER TABLE "nauth_mfa_devices"
      ADD CONSTRAINT "uq_mfa_device_user_type_credential" UNIQUE ("userId", "type", "credentialId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nauth_mfa_devices"
      DROP CONSTRAINT IF EXISTS "uq_mfa_device_user_type_credential"
    `);

    await queryRunner.query(`
      ALTER TABLE "nauth_mfa_devices"
      ALTER COLUMN "credentialId" TYPE text
    `);

    await queryRunner.query(`
      ALTER TABLE "nauth_mfa_devices"
      ADD CONSTRAINT "uq_mfa_device_user_type" UNIQUE ("userId", "type")
    `);
  }
}
