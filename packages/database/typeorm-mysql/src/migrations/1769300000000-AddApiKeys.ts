import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the nauth_api_keys table for API key authentication (MySQL).
 */
export class AddApiKeys1769300000000 implements MigrationInterface {
  name = 'AddApiKeys1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `nauth_api_keys` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`keyId` char(36) NOT NULL, ' +
        '`userId` int NOT NULL, ' +
        '`lookupId` varchar(64) NOT NULL, ' +
        '`keyHash` varchar(128) NOT NULL, ' +
        '`name` varchar(255) NULL, ' +
        '`lastFour` varchar(8) NULL, ' +
        '`allowedIps` json NULL, ' +
        '`expiresAt` timestamp(6) NULL, ' +
        "`isActive` tinyint(1) NOT NULL DEFAULT '1', " +
        '`revokedAt` timestamp(6) NULL, ' +
        '`revokeReason` varchar(255) NULL, ' +
        "`createdByAdmin` tinyint(1) NOT NULL DEFAULT '0', " +
        '`lastUsedAt` timestamp(6) NULL, ' +
        '`lastUsedIp` varchar(45) NULL, ' +
        "`usageCount` int NOT NULL DEFAULT '0', " +
        '`metadata` json NULL, ' +
        '`createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        '`updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
        'INDEX `IDX_nauth_api_keys_userId` (`userId`), ' +
        'INDEX `IDX_nauth_api_keys_isActive` (`isActive`), ' +
        'INDEX `IDX_nauth_api_keys_expiresAt` (`expiresAt`), ' +
        'UNIQUE INDEX `IDX_nauth_api_keys_keyId` (`keyId`), ' +
        'UNIQUE INDEX `IDX_nauth_api_keys_lookupId` (`lookupId`), ' +
        'PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    // Cascade delete keys when the owning user is removed (matches other user-owned tables).
    await queryRunner.query(
      'ALTER TABLE `nauth_api_keys` ADD CONSTRAINT `FK_nauth_api_keys_userId` ' +
        'FOREIGN KEY (`userId`) REFERENCES `nauth_users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `nauth_api_keys` DROP FOREIGN KEY `FK_nauth_api_keys_userId`');
    await queryRunner.query('DROP TABLE `nauth_api_keys`');
  }
}
