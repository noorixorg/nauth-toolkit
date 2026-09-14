import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add optional `timezone` and `locale` columns to users.
 *
 * Both are nullable with no default, so existing rows are untouched and every code path
 * treats a missing value as "fall back to the server default". On PostgreSQL 11+ adding a
 * nullable column without a default is a metadata-only change, so this does not rewrite
 * or lock the table.
 *
 * Runs for both fresh installs and upgrades.
 */
export class AddUserTimezoneLocale1789344000000 implements MigrationInterface {
  name = 'AddUserTimezoneLocale1789344000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nauth_users" ADD COLUMN IF NOT EXISTS "timezone" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "nauth_users" ADD COLUMN IF NOT EXISTS "locale" character varying(35)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nauth_users" DROP COLUMN IF EXISTS "locale"`);
    await queryRunner.query(`ALTER TABLE "nauth_users" DROP COLUMN IF EXISTS "timezone"`);
  }
}
