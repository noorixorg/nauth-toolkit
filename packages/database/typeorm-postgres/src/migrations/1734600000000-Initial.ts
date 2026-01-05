import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1734600000000 implements MigrationInterface {
  name = 'Initial1734600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Needed for uuid_generate_v4()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TABLE "nauth_users" ("id" SERIAL NOT NULL, "sub" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(255), "firstName" character varying(100), "lastName" character varying(100), "email" character varying(255) NOT NULL, "phone" character varying(20), "passwordHash" character varying(255), "passwordChangedAt" TIMESTAMP WITH TIME ZONE, "passwordHistory" text, "mustChangePassword" boolean NOT NULL DEFAULT false, "isEmailVerified" boolean NOT NULL DEFAULT false, "isPhoneVerified" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "isLocked" boolean NOT NULL DEFAULT false, "lockReason" character varying(100), "lockedAt" TIMESTAMP WITH TIME ZONE, "lockedUntil" TIMESTAMP WITH TIME ZONE, "failedLoginAttempts" integer NOT NULL DEFAULT '0', "lastFailedLoginAt" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "lastLoginIp" character varying(45), "mfaEnabled" boolean NOT NULL DEFAULT false, "mfaMethods" text, "mfaEnforcedAt" TIMESTAMP WITH TIME ZONE, "totpSecret" text, "backupCodes" text, "preferredMfaMethod" character varying(20), "mfaExempt" boolean NOT NULL DEFAULT false, "mfaExemptReason" character varying(500), "mfaExemptGrantedAt" TIMESTAMP WITH TIME ZONE, "mfaExemptGrantedBy" character varying(255), "hasSocialAuth" boolean NOT NULL DEFAULT false, "socialProviders" text, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_55109e088d372ba04b3c2868efa" UNIQUE ("sub"), CONSTRAINT "UQ_def83cb63b4ad43b92d4244a8e1" UNIQUE ("username"), CONSTRAINT "UQ_06127de246f8855cfa2b04a4e52" UNIQUE ("email"), CONSTRAINT "PK_d8137f7679293cbbdfa21f1250b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_545148d3ac52c29568490ff064" ON "nauth_users" ("hasSocialAuth") `);
    await queryRunner.query(`CREATE INDEX "IDX_79f6834c0c66979cb09b62473b" ON "nauth_users" ("isActive") `);
    await queryRunner.query(`CREATE INDEX "IDX_e7f7b3f18dfd026b8fe3ea08c2" ON "nauth_users" ("phone") `);
    await queryRunner.query(`CREATE INDEX "IDX_def83cb63b4ad43b92d4244a8e" ON "nauth_users" ("username") `);
    await queryRunner.query(`CREATE INDEX "IDX_06127de246f8855cfa2b04a4e5" ON "nauth_users" ("email") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_55109e088d372ba04b3c2868ef" ON "nauth_users" ("sub") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_sessions" ("id" SERIAL NOT NULL, "version" integer NOT NULL, "userId" integer NOT NULL, "accessTokenHash" character varying(255) NOT NULL, "refreshTokenHash" character varying(255) NOT NULL, "tokenFamily" character varying(255), "deviceId" character varying(255), "deviceName" character varying(255), "deviceType" character varying(50), "deviceFingerprint" character varying(255), "ipAddress" character varying(45), "ipCountry" character varying(100), "ipCity" character varying(100), "ipLatitude" numeric(10,6), "ipLongitude" numeric(10,6), "ipIsp" character varying(255), "userAgent" text, "platform" character varying(50), "browser" character varying(50), "authMethod" character varying(50), "isRemembered" boolean NOT NULL DEFAULT false, "isTrustedDevice" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastActivityAt" TIMESTAMP WITH TIME ZONE, "isRevoked" boolean NOT NULL DEFAULT false, "revokedAt" TIMESTAMP WITH TIME ZONE, "revokeReason" character varying(100), "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60132e1342212a029ef50ac8c97" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5889ec53efe12d4c0861540351" ON "nauth_sessions" ("tokenFamily", "isRevoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_abfe290f316aaec23c6ab8fe4c" ON "nauth_sessions" ("userId", "ipCountry") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82dea1b621a55c1d46f9431c6d" ON "nauth_sessions" ("userId", "ipAddress") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1025cfeb0a432699b35cc9b5a" ON "nauth_sessions" ("userId", "deviceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_394e04ff686168d6b794faab32" ON "nauth_sessions" ("userId", "isRevoked", "expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_640b8b4fb5e34cc462b26c32c7" ON "nauth_sessions" ("userId", "isRevoked", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1116f1740b6f598e409f9b8c8" ON "nauth_sessions" ("userId", "isRevoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a256330403ded68e658351ea6d" ON "nauth_sessions" ("refreshTokenHash", "isRevoked") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_d346547e35ce945120bce8d28e" ON "nauth_sessions" ("isRevoked") `);
    await queryRunner.query(`CREATE INDEX "IDX_f7d5f2b5e7d0ed7630f1494a49" ON "nauth_sessions" ("expiresAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_e11df8864e07aa20e0ad54e9a2" ON "nauth_sessions" ("deviceId") `);
    await queryRunner.query(`CREATE INDEX "IDX_83cb51e5982dd6ea8b01de3707" ON "nauth_sessions" ("refreshTokenHash") `);
    await queryRunner.query(`CREATE INDEX "IDX_7b945889632b425fd83e00627c" ON "nauth_sessions" ("accessTokenHash") `);
    await queryRunner.query(`CREATE INDEX "IDX_29a306abd7483eb7e50bfea13d" ON "nauth_sessions" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_login_attempts" ("id" SERIAL NOT NULL, "email" character varying(255), "userId" integer, "ipAddress" character varying(45), "userAgent" text, "success" boolean NOT NULL, "failureReason" character varying(100), "mfaRequired" boolean NOT NULL DEFAULT false, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d2e5ffaf4001fd44e62a3520c15" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1f72b23ca82eecae26227fe8b4" ON "nauth_login_attempts" ("ipAddress", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad332e5ca8b7c4f6f4cc7bd39c" ON "nauth_login_attempts" ("email", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "nauth_challenge_sessions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "challengeName" character varying(50) NOT NULL, "sessionToken" character varying(255) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "isCompleted" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', "maxAttempts" integer NOT NULL DEFAULT '3', "challengeParameters" jsonb, "metadata" jsonb, "ipAddress" character varying(45), "userAgent" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f439ccf58d5844f715f9eec9cd4" UNIQUE ("sessionToken"), CONSTRAINT "PK_d428df595af0e50c3af8c090bca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e360f85f65e26bedc85eaf4d0d" ON "nauth_challenge_sessions" ("userId", "isCompleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1d8693434fa20d7f7630487f15" ON "nauth_challenge_sessions" ("challengeName") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_12ae307de0750a4dd32471f4e0" ON "nauth_challenge_sessions" ("expiresAt") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_6fc21f5b74c04518123ad1287c" ON "nauth_challenge_sessions" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_verification_tokens" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "challengeSessionId" integer, "type" character varying(20) NOT NULL, "token" character varying(255) NOT NULL, "code" character varying(10), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "usedAt" TIMESTAMP WITH TIME ZONE, "ipAddress" character varying(45), "userAgent" text, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_aba0fc0da872c0599fcea723067" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b643b4dde1e5b2a7bccab9af7e" ON "nauth_verification_tokens" ("expiresAt") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_c5812e0d5be495c141912c9fc3" ON "nauth_verification_tokens" ("token") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_4e9020601dede5c4350a7694e3" ON "nauth_verification_tokens" ("userId", "type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "nauth_social_accounts" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "provider" character varying(50) NOT NULL, "providerId" character varying(255) NOT NULL, "providerEmail" character varying(255), "linkedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_850038b86ca465318d5267cec45" UNIQUE ("provider", "providerId"), CONSTRAINT "PK_ec9b84f29493f4c3cb84dd92f9b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bebad32f44dd2f2a373fd609a6" ON "nauth_social_accounts" ("providerEmail") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_bcf231c8bee2c37f7713dcbcb8" ON "nauth_social_accounts" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_mfa_devices" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "type" character varying(20) NOT NULL, "name" character varying(255) NOT NULL, "secret" text, "phoneNumber" character varying(20), "credentialId" text, "publicKey" text, "counter" integer, "transports" text, "isActive" boolean NOT NULL DEFAULT true, "isPrimary" boolean NOT NULL DEFAULT false, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "usageCount" integer NOT NULL DEFAULT '0', "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_mfa_device_user_type" UNIQUE ("userId", "type"), CONSTRAINT "PK_f6896a302bdbbbdf6bbcffa445d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_bb95066fbbcbb404d8a329607f" ON "nauth_mfa_devices" ("isActive") `);
    await queryRunner.query(`CREATE INDEX "IDX_54097fe7cdef07b08b3866934c" ON "nauth_mfa_devices" ("type") `);
    await queryRunner.query(`CREATE INDEX "IDX_7850b00d043a63657522249b81" ON "nauth_mfa_devices" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_auth_audit" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "eventType" character varying(50) NOT NULL, "eventStatus" character varying(20) NOT NULL, "riskFactor" integer, "riskFactors" text array, "adaptiveMfaTriggered" boolean, "ipAddress" character varying(45), "ipCountry" character varying(100), "ipCity" character varying(100), "ipLatitude" numeric(10,6), "ipLongitude" numeric(10,6), "userAgent" text, "platform" character varying(50), "browser" character varying(50), "deviceId" character varying(255), "deviceName" character varying(255), "deviceType" character varying(50), "sessionId" integer, "challengeSessionId" integer, "authMethod" character varying(50), "performedBy" character varying(255), "reason" character varying(500), "description" text, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bfa7ce5b870836679a850a4227" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58c758ac01b0b9628dcd8da13e" ON "nauth_auth_audit" ("userId", "ipAddress") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9aac36f5d60c47085006e14c86" ON "nauth_auth_audit" ("userId", "eventType", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2a3142225b10cbb2d61c3d7670" ON "nauth_auth_audit" ("authMethod", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d34a4ba3b16763ba96373bd60" ON "nauth_auth_audit" ("adaptiveMfaTriggered", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_efc809a946b92cca2791ad900d" ON "nauth_auth_audit" ("riskFactor", "createdAt") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_8ad1870f1c47bc4aea6bf069be" ON "nauth_auth_audit" ("createdAt") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_8f3e679bbcea9a0c54cb7fc138" ON "nauth_auth_audit" ("eventStatus", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aee5b503e165b59225e6004bb3" ON "nauth_auth_audit" ("eventType", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5a6e9fdcb66f2b33bb1420b62" ON "nauth_auth_audit" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "nauth_trusted_devices" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "deviceTokenHash" character varying(255) NOT NULL, "deviceId" character varying(255), "deviceName" character varying(255), "deviceType" character varying(50), "ipAddress" character varying(45), "userAgent" text, "platform" character varying(50), "browser" character varying(50), "trustedUntil" TIMESTAMP WITH TIME ZONE NOT NULL, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3e388d947e0b5b07efc6ae308d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e1eadc45b91af58ad18626de36" ON "nauth_trusted_devices" ("userId", "deviceTokenHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ec93fcdd969044b56966d5b8f" ON "nauth_trusted_devices" ("trustedUntil") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_4be50a51f46a2110415882ebae" ON "nauth_trusted_devices" ("deviceId") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_96d642dfb86b07683970edb383" ON "nauth_trusted_devices" ("deviceTokenHash") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_6b1ebaf31bc726f6c40020a0d2" ON "nauth_trusted_devices" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_rate_limits" ("id" SERIAL NOT NULL, "key" character varying(255) NOT NULL, "value" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2e84e65556919eb0ea56a4c2ac7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_f97c41c9a490f252b1d0c9367d" ON "nauth_rate_limits" ("expiresAt") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_90d96c7c013510b358d30d8144" ON "nauth_rate_limits" ("key") `);
    await queryRunner.query(
      `CREATE TABLE "nauth_storage_locks" ("id" SERIAL NOT NULL, "key" character varying(255) NOT NULL, "value" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5137ad1e6a473acd622a2fedd66" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_61474f43e24de2af1d8bf88ee1" ON "nauth_storage_locks" ("expiresAt") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_24b2bef3e4cfafcecc2ad09df4" ON "nauth_storage_locks" ("key") `);
    await queryRunner.query(
      `ALTER TABLE "nauth_sessions" ADD CONSTRAINT "FK_29a306abd7483eb7e50bfea13d8" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_login_attempts" ADD CONSTRAINT "FK_21b1aa08d1cb4c6c5dda7f6fac0" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_challenge_sessions" ADD CONSTRAINT "FK_6fc21f5b74c04518123ad1287cb" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_verification_tokens" ADD CONSTRAINT "FK_8ff39e7ffb5e4ffb734ee9e57c5" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_verification_tokens" ADD CONSTRAINT "FK_5e34b085fd0bc42216849e53aa3" FOREIGN KEY ("challengeSessionId") REFERENCES "nauth_challenge_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_social_accounts" ADD CONSTRAINT "FK_bcf231c8bee2c37f7713dcbcb8a" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_mfa_devices" ADD CONSTRAINT "FK_7850b00d043a63657522249b816" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_auth_audit" ADD CONSTRAINT "FK_af799e756285b8639985dd09f50" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nauth_trusted_devices" ADD CONSTRAINT "FK_6b1ebaf31bc726f6c40020a0d2a" FOREIGN KEY ("userId") REFERENCES "nauth_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nauth_trusted_devices" DROP CONSTRAINT "FK_6b1ebaf31bc726f6c40020a0d2a"`);
    await queryRunner.query(`ALTER TABLE "nauth_auth_audit" DROP CONSTRAINT "FK_af799e756285b8639985dd09f50"`);
    await queryRunner.query(`ALTER TABLE "nauth_mfa_devices" DROP CONSTRAINT "FK_7850b00d043a63657522249b816"`);
    await queryRunner.query(`ALTER TABLE "nauth_social_accounts" DROP CONSTRAINT "FK_bcf231c8bee2c37f7713dcbcb8a"`);
    await queryRunner.query(`ALTER TABLE "nauth_verification_tokens" DROP CONSTRAINT "FK_5e34b085fd0bc42216849e53aa3"`);
    await queryRunner.query(`ALTER TABLE "nauth_verification_tokens" DROP CONSTRAINT "FK_8ff39e7ffb5e4ffb734ee9e57c5"`);
    await queryRunner.query(`ALTER TABLE "nauth_challenge_sessions" DROP CONSTRAINT "FK_6fc21f5b74c04518123ad1287cb"`);
    await queryRunner.query(`ALTER TABLE "nauth_login_attempts" DROP CONSTRAINT "FK_21b1aa08d1cb4c6c5dda7f6fac0"`);
    await queryRunner.query(`ALTER TABLE "nauth_sessions" DROP CONSTRAINT "FK_29a306abd7483eb7e50bfea13d8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_24b2bef3e4cfafcecc2ad09df4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_61474f43e24de2af1d8bf88ee1"`);
    await queryRunner.query(`DROP TABLE "nauth_storage_locks"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_90d96c7c013510b358d30d8144"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f97c41c9a490f252b1d0c9367d"`);
    await queryRunner.query(`DROP TABLE "nauth_rate_limits"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6b1ebaf31bc726f6c40020a0d2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_96d642dfb86b07683970edb383"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4be50a51f46a2110415882ebae"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7ec93fcdd969044b56966d5b8f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e1eadc45b91af58ad18626de36"`);
    await queryRunner.query(`DROP TABLE "nauth_trusted_devices"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d5a6e9fdcb66f2b33bb1420b62"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aee5b503e165b59225e6004bb3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8f3e679bbcea9a0c54cb7fc138"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8ad1870f1c47bc4aea6bf069be"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_efc809a946b92cca2791ad900d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9d34a4ba3b16763ba96373bd60"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2a3142225b10cbb2d61c3d7670"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9aac36f5d60c47085006e14c86"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_58c758ac01b0b9628dcd8da13e"`);
    await queryRunner.query(`DROP TABLE "nauth_auth_audit"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7850b00d043a63657522249b81"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_54097fe7cdef07b08b3866934c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bb95066fbbcbb404d8a329607f"`);
    await queryRunner.query(`DROP TABLE "nauth_mfa_devices"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bcf231c8bee2c37f7713dcbcb8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bebad32f44dd2f2a373fd609a6"`);
    await queryRunner.query(`DROP TABLE "nauth_social_accounts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e9020601dede5c4350a7694e3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c5812e0d5be495c141912c9fc3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b643b4dde1e5b2a7bccab9af7e"`);
    await queryRunner.query(`DROP TABLE "nauth_verification_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6fc21f5b74c04518123ad1287c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_12ae307de0750a4dd32471f4e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1d8693434fa20d7f7630487f15"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e360f85f65e26bedc85eaf4d0d"`);
    await queryRunner.query(`DROP TABLE "nauth_challenge_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ad332e5ca8b7c4f6f4cc7bd39c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1f72b23ca82eecae26227fe8b4"`);
    await queryRunner.query(`DROP TABLE "nauth_login_attempts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_29a306abd7483eb7e50bfea13d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7b945889632b425fd83e00627c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_83cb51e5982dd6ea8b01de3707"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e11df8864e07aa20e0ad54e9a2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f7d5f2b5e7d0ed7630f1494a49"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d346547e35ce945120bce8d28e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a256330403ded68e658351ea6d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e1116f1740b6f598e409f9b8c8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_640b8b4fb5e34cc462b26c32c7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_394e04ff686168d6b794faab32"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f1025cfeb0a432699b35cc9b5a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_82dea1b621a55c1d46f9431c6d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_abfe290f316aaec23c6ab8fe4c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5889ec53efe12d4c0861540351"`);
    await queryRunner.query(`DROP TABLE "nauth_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_55109e088d372ba04b3c2868ef"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_06127de246f8855cfa2b04a4e5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_def83cb63b4ad43b92d4244a8e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e7f7b3f18dfd026b8fe3ea08c2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_79f6834c0c66979cb09b62473b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_545148d3ac52c29568490ff064"`);
    await queryRunner.query(`DROP TABLE "nauth_users"`);
  }
}
