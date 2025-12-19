import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1734600000000 implements MigrationInterface {
  name = 'Initial1734600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`nauth_users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`sub\` char(36) NOT NULL, \`username\` varchar(255) NULL, \`firstName\` varchar(100) NULL, \`lastName\` varchar(100) NULL, \`email\` varchar(255) NOT NULL, \`phone\` varchar(20) NULL, \`passwordHash\` varchar(255) NULL, \`passwordChangedAt\` timestamp(6) NULL, \`passwordHistory\` json NULL, \`mustChangePassword\` tinyint(1) NOT NULL DEFAULT '0', \`isEmailVerified\` tinyint(1) NOT NULL DEFAULT '0', \`isPhoneVerified\` tinyint(1) NOT NULL DEFAULT '0', \`isActive\` tinyint(1) NOT NULL DEFAULT '1', \`isLocked\` tinyint(1) NOT NULL DEFAULT '0', \`lockReason\` varchar(100) NULL, \`lockedAt\` timestamp(6) NULL, \`lockedUntil\` timestamp(6) NULL, \`failedLoginAttempts\` int NOT NULL DEFAULT '0', \`lastFailedLoginAt\` timestamp(6) NULL, \`lastLoginAt\` timestamp(6) NULL, \`lastLoginIp\` varchar(45) NULL, \`mfaEnabled\` tinyint(1) NOT NULL DEFAULT '0', \`mfaMethods\` json NULL, \`mfaEnforcedAt\` timestamp(6) NULL, \`totpSecret\` text NULL, \`backupCodes\` json NULL, \`preferredMfaMethod\` varchar(20) NULL, \`mfaExempt\` tinyint(1) NOT NULL DEFAULT '0', \`mfaExemptReason\` varchar(500) NULL, \`mfaExemptGrantedAt\` timestamp(6) NULL, \`mfaExemptGrantedBy\` varchar(255) NULL, \`hasSocialAuth\` tinyint(1) NOT NULL DEFAULT '0', \`socialProviders\` json NULL, \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` timestamp(6) NULL, INDEX \`IDX_545148d3ac52c29568490ff064\` (\`hasSocialAuth\`), INDEX \`IDX_79f6834c0c66979cb09b62473b\` (\`isActive\`), INDEX \`IDX_e7f7b3f18dfd026b8fe3ea08c2\` (\`phone\`), UNIQUE INDEX \`IDX_def83cb63b4ad43b92d4244a8e\` (\`username\`), UNIQUE INDEX \`IDX_06127de246f8855cfa2b04a4e5\` (\`email\`), UNIQUE INDEX \`IDX_55109e088d372ba04b3c2868ef\` (\`sub\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_sessions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`version\` int NOT NULL, \`userId\` int NOT NULL, \`accessTokenHash\` varchar(255) NOT NULL, \`refreshTokenHash\` varchar(255) NOT NULL, \`tokenFamily\` varchar(255) NULL, \`deviceId\` varchar(255) NULL, \`deviceName\` varchar(255) NULL, \`deviceType\` varchar(50) NULL, \`deviceFingerprint\` varchar(255) NULL, \`ipAddress\` varchar(45) NULL, \`ipCountry\` varchar(100) NULL, \`ipCity\` varchar(100) NULL, \`ipLatitude\` decimal(10,6) NULL, \`ipLongitude\` decimal(10,6) NULL, \`ipIsp\` varchar(255) NULL, \`userAgent\` text NULL, \`platform\` varchar(50) NULL, \`browser\` varchar(50) NULL, \`authMethod\` varchar(50) NULL, \`isRemembered\` tinyint(1) NOT NULL DEFAULT '0', \`isTrustedDevice\` tinyint(1) NOT NULL DEFAULT '0', \`expiresAt\` timestamp(6) NOT NULL, \`lastActivityAt\` timestamp(6) NULL, \`isRevoked\` tinyint(1) NOT NULL DEFAULT '0', \`revokedAt\` timestamp(6) NULL, \`revokeReason\` varchar(100) NULL, \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_5889ec53efe12d4c0861540351\` (\`tokenFamily\`, \`isRevoked\`), INDEX \`IDX_abfe290f316aaec23c6ab8fe4c\` (\`userId\`, \`ipCountry\`), INDEX \`IDX_82dea1b621a55c1d46f9431c6d\` (\`userId\`, \`ipAddress\`), INDEX \`IDX_f1025cfeb0a432699b35cc9b5a\` (\`userId\`, \`deviceId\`), INDEX \`IDX_394e04ff686168d6b794faab32\` (\`userId\`, \`isRevoked\`, \`expiresAt\`), INDEX \`IDX_640b8b4fb5e34cc462b26c32c7\` (\`userId\`, \`isRevoked\`, \`createdAt\`), INDEX \`IDX_e1116f1740b6f598e409f9b8c8\` (\`userId\`, \`isRevoked\`), INDEX \`IDX_a256330403ded68e658351ea6d\` (\`refreshTokenHash\`, \`isRevoked\`), INDEX \`IDX_d346547e35ce945120bce8d28e\` (\`isRevoked\`), INDEX \`IDX_f7d5f2b5e7d0ed7630f1494a49\` (\`expiresAt\`), INDEX \`IDX_e11df8864e07aa20e0ad54e9a2\` (\`deviceId\`), INDEX \`IDX_83cb51e5982dd6ea8b01de3707\` (\`refreshTokenHash\`), INDEX \`IDX_7b945889632b425fd83e00627c\` (\`accessTokenHash\`), INDEX \`IDX_29a306abd7483eb7e50bfea13d\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_login_attempts\` (\`id\` int NOT NULL AUTO_INCREMENT, \`email\` varchar(255) NULL, \`userId\` int NULL, \`ipAddress\` varchar(45) NULL, \`userAgent\` text NULL, \`success\` tinyint(1) NOT NULL, \`failureReason\` varchar(100) NULL, \`mfaRequired\` tinyint(1) NOT NULL DEFAULT '0', \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_1f72b23ca82eecae26227fe8b4\` (\`ipAddress\`, \`createdAt\`), INDEX \`IDX_ad332e5ca8b7c4f6f4cc7bd39c\` (\`email\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_challenge_sessions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`challengeName\` varchar(50) NOT NULL, \`sessionToken\` varchar(255) NOT NULL, \`expiresAt\` timestamp(6) NOT NULL, \`isCompleted\` tinyint(1) NOT NULL DEFAULT '0', \`completedAt\` timestamp(6) NULL, \`attempts\` int NOT NULL DEFAULT '0', \`maxAttempts\` int NOT NULL DEFAULT '3', \`challengeParameters\` json NULL, \`metadata\` json NULL, \`ipAddress\` varchar(45) NULL, \`userAgent\` text NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_e360f85f65e26bedc85eaf4d0d\` (\`userId\`, \`isCompleted\`), INDEX \`IDX_1d8693434fa20d7f7630487f15\` (\`challengeName\`), INDEX \`IDX_12ae307de0750a4dd32471f4e0\` (\`expiresAt\`), INDEX \`IDX_6fc21f5b74c04518123ad1287c\` (\`userId\`), UNIQUE INDEX \`IDX_f439ccf58d5844f715f9eec9cd\` (\`sessionToken\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_verification_tokens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`challengeSessionId\` int NULL, \`type\` varchar(20) NOT NULL, \`token\` varchar(255) NOT NULL, \`code\` varchar(10) NULL, \`expiresAt\` timestamp(6) NOT NULL, \`attempts\` int NOT NULL DEFAULT '0', \`usedAt\` timestamp(6) NULL, \`ipAddress\` varchar(45) NULL, \`userAgent\` text NULL, \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_b643b4dde1e5b2a7bccab9af7e\` (\`expiresAt\`), INDEX \`IDX_c5812e0d5be495c141912c9fc3\` (\`token\`), INDEX \`IDX_4e9020601dede5c4350a7694e3\` (\`userId\`, \`type\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_social_accounts\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`provider\` varchar(50) NOT NULL, \`providerId\` varchar(255) NOT NULL, \`providerEmail\` varchar(255) NULL, \`linkedAt\` timestamp(6) NOT NULL, \`lastUsedAt\` timestamp(6) NULL, \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_bebad32f44dd2f2a373fd609a6\` (\`providerEmail\`), INDEX \`IDX_bcf231c8bee2c37f7713dcbcb8\` (\`userId\`), UNIQUE INDEX \`IDX_850038b86ca465318d5267cec4\` (\`provider\`, \`providerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_mfa_devices\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`type\` varchar(20) NOT NULL, \`name\` varchar(255) NOT NULL, \`secret\` text NULL, \`phoneNumber\` varchar(20) NULL, \`credentialId\` text NULL, \`publicKey\` text NULL, \`counter\` int NULL, \`transports\` json NULL, \`isActive\` tinyint(1) NOT NULL DEFAULT '1', \`isPrimary\` tinyint(1) NOT NULL DEFAULT '0', \`lastUsedAt\` timestamp(6) NULL, \`usageCount\` int NOT NULL DEFAULT '0', \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_bb95066fbbcbb404d8a329607f\` (\`isActive\`), INDEX \`IDX_54097fe7cdef07b08b3866934c\` (\`type\`), INDEX \`IDX_7850b00d043a63657522249b81\` (\`userId\`), UNIQUE INDEX \`uq_mfa_device_user_type\` (\`userId\`, \`type\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_auth_audit\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`eventType\` varchar(50) NOT NULL, \`eventStatus\` varchar(20) NOT NULL, \`riskFactor\` int NULL, \`riskFactors\` json NULL, \`adaptiveMfaTriggered\` tinyint(1) NULL, \`ipAddress\` varchar(45) NULL, \`ipCountry\` varchar(100) NULL, \`ipCity\` varchar(100) NULL, \`ipLatitude\` decimal(10,6) NULL, \`ipLongitude\` decimal(10,6) NULL, \`userAgent\` text NULL, \`platform\` varchar(50) NULL, \`browser\` varchar(50) NULL, \`deviceId\` varchar(255) NULL, \`deviceName\` varchar(255) NULL, \`deviceType\` varchar(50) NULL, \`sessionId\` int NULL, \`challengeSessionId\` int NULL, \`authMethod\` varchar(50) NULL, \`performedBy\` varchar(255) NULL, \`reason\` varchar(500) NULL, \`description\` text NULL, \`metadata\` json NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_58c758ac01b0b9628dcd8da13e\` (\`userId\`, \`ipAddress\`), INDEX \`IDX_9aac36f5d60c47085006e14c86\` (\`userId\`, \`eventType\`, \`createdAt\`), INDEX \`IDX_2a3142225b10cbb2d61c3d7670\` (\`authMethod\`, \`createdAt\`), INDEX \`IDX_9d34a4ba3b16763ba96373bd60\` (\`adaptiveMfaTriggered\`, \`createdAt\`), INDEX \`IDX_efc809a946b92cca2791ad900d\` (\`riskFactor\`, \`createdAt\`), INDEX \`IDX_8ad1870f1c47bc4aea6bf069be\` (\`createdAt\`), INDEX \`IDX_8f3e679bbcea9a0c54cb7fc138\` (\`eventStatus\`, \`createdAt\`), INDEX \`IDX_aee5b503e165b59225e6004bb3\` (\`eventType\`, \`createdAt\`), INDEX \`IDX_d5a6e9fdcb66f2b33bb1420b62\` (\`userId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_trusted_devices\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NOT NULL, \`deviceTokenHash\` varchar(255) NOT NULL, \`deviceId\` varchar(255) NULL, \`deviceName\` varchar(255) NULL, \`deviceType\` varchar(50) NULL, \`ipAddress\` varchar(45) NULL, \`userAgent\` text NULL, \`platform\` varchar(50) NULL, \`browser\` varchar(50) NULL, \`trustedUntil\` timestamp(6) NOT NULL, \`lastUsedAt\` timestamp(6) NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_e1eadc45b91af58ad18626de36\` (\`userId\`, \`deviceTokenHash\`), INDEX \`IDX_7ec93fcdd969044b56966d5b8f\` (\`trustedUntil\`), INDEX \`IDX_4be50a51f46a2110415882ebae\` (\`deviceId\`), INDEX \`IDX_96d642dfb86b07683970edb383\` (\`deviceTokenHash\`), INDEX \`IDX_6b1ebaf31bc726f6c40020a0d2\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_rate_limits\` (\`id\` int NOT NULL AUTO_INCREMENT, \`key\` varchar(255) NOT NULL, \`value\` text NOT NULL, \`expiresAt\` timestamp(6) NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_f97c41c9a490f252b1d0c9367d\` (\`expiresAt\`), UNIQUE INDEX \`IDX_90d96c7c013510b358d30d8144\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`nauth_storage_locks\` (\`id\` int NOT NULL AUTO_INCREMENT, \`key\` varchar(255) NOT NULL, \`value\` text NOT NULL, \`expiresAt\` timestamp(6) NULL, \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_61474f43e24de2af1d8bf88ee1\` (\`expiresAt\`), UNIQUE INDEX \`IDX_24b2bef3e4cfafcecc2ad09df4\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_sessions\` ADD CONSTRAINT \`FK_29a306abd7483eb7e50bfea13d8\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_login_attempts\` ADD CONSTRAINT \`FK_21b1aa08d1cb4c6c5dda7f6fac0\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_challenge_sessions\` ADD CONSTRAINT \`FK_6fc21f5b74c04518123ad1287cb\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_verification_tokens\` ADD CONSTRAINT \`FK_8ff39e7ffb5e4ffb734ee9e57c5\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_verification_tokens\` ADD CONSTRAINT \`FK_5e34b085fd0bc42216849e53aa3\` FOREIGN KEY (\`challengeSessionId\`) REFERENCES \`nauth_challenge_sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_social_accounts\` ADD CONSTRAINT \`FK_bcf231c8bee2c37f7713dcbcb8a\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_mfa_devices\` ADD CONSTRAINT \`FK_7850b00d043a63657522249b816\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_auth_audit\` ADD CONSTRAINT \`FK_af799e756285b8639985dd09f50\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`nauth_trusted_devices\` ADD CONSTRAINT \`FK_6b1ebaf31bc726f6c40020a0d2a\` FOREIGN KEY (\`userId\`) REFERENCES \`nauth_users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`nauth_trusted_devices\` DROP FOREIGN KEY \`FK_6b1ebaf31bc726f6c40020a0d2a\``);
    await queryRunner.query(`ALTER TABLE \`nauth_auth_audit\` DROP FOREIGN KEY \`FK_af799e756285b8639985dd09f50\``);
    await queryRunner.query(`ALTER TABLE \`nauth_mfa_devices\` DROP FOREIGN KEY \`FK_7850b00d043a63657522249b816\``);
    await queryRunner.query(`ALTER TABLE \`nauth_social_accounts\` DROP FOREIGN KEY \`FK_bcf231c8bee2c37f7713dcbcb8a\``);
    await queryRunner.query(`ALTER TABLE \`nauth_verification_tokens\` DROP FOREIGN KEY \`FK_5e34b085fd0bc42216849e53aa3\``);
    await queryRunner.query(`ALTER TABLE \`nauth_verification_tokens\` DROP FOREIGN KEY \`FK_8ff39e7ffb5e4ffb734ee9e57c5\``);
    await queryRunner.query(`ALTER TABLE \`nauth_challenge_sessions\` DROP FOREIGN KEY \`FK_6fc21f5b74c04518123ad1287cb\``);
    await queryRunner.query(`ALTER TABLE \`nauth_login_attempts\` DROP FOREIGN KEY \`FK_21b1aa08d1cb4c6c5dda7f6fac0\``);
    await queryRunner.query(`ALTER TABLE \`nauth_sessions\` DROP FOREIGN KEY \`FK_29a306abd7483eb7e50bfea13d8\``);
    await queryRunner.query(`DROP INDEX \`IDX_24b2bef3e4cfafcecc2ad09df4\` ON \`nauth_storage_locks\``);
    await queryRunner.query(`DROP INDEX \`IDX_61474f43e24de2af1d8bf88ee1\` ON \`nauth_storage_locks\``);
    await queryRunner.query(`DROP TABLE \`nauth_storage_locks\``);
    await queryRunner.query(`DROP INDEX \`IDX_90d96c7c013510b358d30d8144\` ON \`nauth_rate_limits\``);
    await queryRunner.query(`DROP INDEX \`IDX_f97c41c9a490f252b1d0c9367d\` ON \`nauth_rate_limits\``);
    await queryRunner.query(`DROP TABLE \`nauth_rate_limits\``);
    await queryRunner.query(`DROP INDEX \`IDX_6b1ebaf31bc726f6c40020a0d2\` ON \`nauth_trusted_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_96d642dfb86b07683970edb383\` ON \`nauth_trusted_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_4be50a51f46a2110415882ebae\` ON \`nauth_trusted_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_7ec93fcdd969044b56966d5b8f\` ON \`nauth_trusted_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_e1eadc45b91af58ad18626de36\` ON \`nauth_trusted_devices\``);
    await queryRunner.query(`DROP TABLE \`nauth_trusted_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_d5a6e9fdcb66f2b33bb1420b62\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_aee5b503e165b59225e6004bb3\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_8f3e679bbcea9a0c54cb7fc138\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_8ad1870f1c47bc4aea6bf069be\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_efc809a946b92cca2791ad900d\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_9d34a4ba3b16763ba96373bd60\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_2a3142225b10cbb2d61c3d7670\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_9aac36f5d60c47085006e14c86\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`IDX_58c758ac01b0b9628dcd8da13e\` ON \`nauth_auth_audit\``);
    await queryRunner.query(`DROP TABLE \`nauth_auth_audit\``);
    await queryRunner.query(`DROP INDEX \`uq_mfa_device_user_type\` ON \`nauth_mfa_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_7850b00d043a63657522249b81\` ON \`nauth_mfa_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_54097fe7cdef07b08b3866934c\` ON \`nauth_mfa_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_bb95066fbbcbb404d8a329607f\` ON \`nauth_mfa_devices\``);
    await queryRunner.query(`DROP TABLE \`nauth_mfa_devices\``);
    await queryRunner.query(`DROP INDEX \`IDX_850038b86ca465318d5267cec4\` ON \`nauth_social_accounts\``);
    await queryRunner.query(`DROP INDEX \`IDX_bcf231c8bee2c37f7713dcbcb8\` ON \`nauth_social_accounts\``);
    await queryRunner.query(`DROP INDEX \`IDX_bebad32f44dd2f2a373fd609a6\` ON \`nauth_social_accounts\``);
    await queryRunner.query(`DROP TABLE \`nauth_social_accounts\``);
    await queryRunner.query(`DROP INDEX \`IDX_4e9020601dede5c4350a7694e3\` ON \`nauth_verification_tokens\``);
    await queryRunner.query(`DROP INDEX \`IDX_c5812e0d5be495c141912c9fc3\` ON \`nauth_verification_tokens\``);
    await queryRunner.query(`DROP INDEX \`IDX_b643b4dde1e5b2a7bccab9af7e\` ON \`nauth_verification_tokens\``);
    await queryRunner.query(`DROP TABLE \`nauth_verification_tokens\``);
    await queryRunner.query(`DROP INDEX \`IDX_f439ccf58d5844f715f9eec9cd\` ON \`nauth_challenge_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_6fc21f5b74c04518123ad1287c\` ON \`nauth_challenge_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_12ae307de0750a4dd32471f4e0\` ON \`nauth_challenge_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_1d8693434fa20d7f7630487f15\` ON \`nauth_challenge_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_e360f85f65e26bedc85eaf4d0d\` ON \`nauth_challenge_sessions\``);
    await queryRunner.query(`DROP TABLE \`nauth_challenge_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_ad332e5ca8b7c4f6f4cc7bd39c\` ON \`nauth_login_attempts\``);
    await queryRunner.query(`DROP INDEX \`IDX_1f72b23ca82eecae26227fe8b4\` ON \`nauth_login_attempts\``);
    await queryRunner.query(`DROP TABLE \`nauth_login_attempts\``);
    await queryRunner.query(`DROP INDEX \`IDX_29a306abd7483eb7e50bfea13d\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_7b945889632b425fd83e00627c\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_83cb51e5982dd6ea8b01de3707\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_e11df8864e07aa20e0ad54e9a2\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_f7d5f2b5e7d0ed7630f1494a49\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_d346547e35ce945120bce8d28e\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_a256330403ded68e658351ea6d\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_e1116f1740b6f598e409f9b8c8\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_640b8b4fb5e34cc462b26c32c7\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_394e04ff686168d6b794faab32\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_f1025cfeb0a432699b35cc9b5a\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_82dea1b621a55c1d46f9431c6d\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_abfe290f316aaec23c6ab8fe4c\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_5889ec53efe12d4c0861540351\` ON \`nauth_sessions\``);
    await queryRunner.query(`DROP TABLE \`nauth_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_55109e088d372ba04b3c2868ef\` ON \`nauth_users\``);
    await queryRunner.query(`DROP INDEX \`IDX_06127de246f8855cfa2b04a4e5\` ON \`nauth_users\``);
    await queryRunner.query(`DROP INDEX \`IDX_def83cb63b4ad43b92d4244a8e\` ON \`nauth_users\``);
    await queryRunner.query(`DROP INDEX \`IDX_e7f7b3f18dfd026b8fe3ea08c2\` ON \`nauth_users\``);
    await queryRunner.query(`DROP INDEX \`IDX_79f6834c0c66979cb09b62473b\` ON \`nauth_users\``);
    await queryRunner.query(`DROP INDEX \`IDX_545148d3ac52c29568490ff064\` ON \`nauth_users\``);
    await queryRunner.query(`DROP TABLE \`nauth_users\``);
  }
}


