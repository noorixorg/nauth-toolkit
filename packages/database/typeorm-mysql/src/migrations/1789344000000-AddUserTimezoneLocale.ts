import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add optional `timezone` and `locale` columns to users (MySQL).
 *
 * Both are nullable with no default, so existing rows are untouched and every code path
 * treats a missing value as "fall back to the server default". MySQL 8 applies a nullable
 * column addition with ALGORITHM=INSTANT, so this does not rewrite or lock the table.
 *
 * MySQL has no `ADD COLUMN IF NOT EXISTS`; the migrations table is what guarantees this
 * runs exactly once.
 *
 * Runs for both fresh installs and upgrades.
 */
export class AddUserTimezoneLocale1789344000000 implements MigrationInterface {
  name = 'AddUserTimezoneLocale1789344000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `nauth_users` ADD `timezone` varchar(64) NULL');
    await queryRunner.query('ALTER TABLE `nauth_users` ADD `locale` varchar(35) NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `nauth_users` DROP COLUMN `locale`');
    await queryRunner.query('ALTER TABLE `nauth_users` DROP COLUMN `timezone`');
  }
}
