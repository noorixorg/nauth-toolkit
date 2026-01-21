import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to remove deprecated isRemembered column from sessions table
 *
 * The isRemembered field was a legacy "remember me" feature that has been
 * replaced by the isTrustedDevice feature for MFA trusted devices.
 */
export class RemoveIsRemembered1737500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the isRemembered column
    await queryRunner.query(`
      ALTER TABLE "nauth_session"
      DROP COLUMN IF EXISTS "isRemembered"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the isRemembered column if needed for rollback
    await queryRunner.query(`
      ALTER TABLE "nauth_session"
      ADD COLUMN "isRemembered" boolean NOT NULL DEFAULT false
    `);
  }
}
