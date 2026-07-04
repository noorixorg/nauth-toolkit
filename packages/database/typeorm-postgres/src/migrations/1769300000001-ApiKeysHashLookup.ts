import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Switch API keys from lookupId-based lookup to direct keyHash lookup.
 *
 * Drops the `lookupId` column (and its unique index) and makes `keyHash` the unique lookup index.
 * Runs for both fresh installs and upgrades from 0.3.1 (which shipped the lookupId column).
 */
export class ApiKeysHashLookup1769300000001 implements MigrationInterface {
  name = 'ApiKeysHashLookup1769300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_lookupId"`);
    await queryRunner.query(`ALTER TABLE "nauth_api_keys" DROP COLUMN "lookupId"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_nauth_api_keys_keyHash" ON "nauth_api_keys" ("keyHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_keyHash"`);
    await queryRunner.query(`ALTER TABLE "nauth_api_keys" ADD "lookupId" character varying(64)`);
  }
}
