import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the nauth_api_keys table for API key authentication.
 */
export class AddApiKeys1769300000000 implements MigrationInterface {
  name = 'AddApiKeys1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nauth_api_keys" (` +
        `"id" SERIAL NOT NULL, ` +
        `"keyId" uuid NOT NULL, ` +
        `"userId" integer NOT NULL, ` +
        `"lookupId" character varying(64) NOT NULL, ` +
        `"keyHash" character varying(128) NOT NULL, ` +
        `"name" character varying(255), ` +
        `"lastFour" character varying(8), ` +
        `"allowedIps" text, ` +
        `"expiresAt" TIMESTAMP WITH TIME ZONE, ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"revokedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"revokeReason" character varying(255), ` +
        `"createdByAdmin" boolean NOT NULL DEFAULT false, ` +
        `"lastUsedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"lastUsedIp" character varying(45), ` +
        `"usageCount" integer NOT NULL DEFAULT 0, ` +
        `"metadata" jsonb, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_nauth_api_keys" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_nauth_api_keys_keyId" ON "nauth_api_keys" ("keyId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_nauth_api_keys_lookupId" ON "nauth_api_keys" ("lookupId")`);
    await queryRunner.query(`CREATE INDEX "IDX_nauth_api_keys_userId" ON "nauth_api_keys" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_nauth_api_keys_isActive" ON "nauth_api_keys" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_nauth_api_keys_expiresAt" ON "nauth_api_keys" ("expiresAt")`);
    // Cascade delete keys when the owning user is removed (matches other user-owned tables).
    await queryRunner.query(
      `ALTER TABLE "nauth_api_keys" ADD CONSTRAINT "FK_nauth_api_keys_userId" ` +
        `FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nauth_api_keys" DROP CONSTRAINT "FK_nauth_api_keys_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_expiresAt"`);
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_lookupId"`);
    await queryRunner.query(`DROP INDEX "IDX_nauth_api_keys_keyId"`);
    await queryRunner.query(`DROP TABLE "nauth_api_keys"`);
  }
}
