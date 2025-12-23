import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialProviderSecrets1766480775000 implements MigrationInterface {
  name = 'AddSocialProviderSecrets1766480775000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`nauth_social_provider_secrets\` (\`id\` int NOT NULL AUTO_INCREMENT, \`provider\` varchar(50) NOT NULL, \`clientSecretJwt\` text NOT NULL, \`expiresAt\` timestamp(6) NOT NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_social_provider_secrets_provider\` ON \`nauth_social_provider_secrets\` (\`provider\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_social_provider_secrets_provider\` ON \`nauth_social_provider_secrets\``);
    await queryRunner.query(`DROP TABLE \`nauth_social_provider_secrets\``);
  }
}
