import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialProviderSecrets1766480775000 implements MigrationInterface {
  name = 'AddSocialProviderSecrets1766480775000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nauth_social_provider_secrets" ("id" SERIAL NOT NULL, "provider" character varying(50) NOT NULL, "clientSecretJwt" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_social_provider_secrets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_social_provider_secrets_provider" ON "nauth_social_provider_secrets" ("provider")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_social_provider_secrets_provider"`);
    await queryRunner.query(`DROP TABLE "nauth_social_provider_secrets"`);
  }
}
