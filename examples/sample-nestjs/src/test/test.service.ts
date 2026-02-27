import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorageAdapter } from '@nauth-toolkit/core';

/**
 * Test Service
 *
 * Provides test-mode functionality:
 * - Database/Redis reset (optional, not used by default)
 * - Test data retrieval (TOTP secrets)
 *
 * ONLY ACTIVE when NAUTH_TEST_MODE=true
 *
 * Note: Configuration changes require manual edits to auth.config.ts.
 * The app auto-restarts on file changes when using yarn start:dev.
 *
 * Email and SMS codes are retrieved directly from nauth_verification_tokens table
 * via the test controller using TypeORM query builder.
 */
@Injectable()
export class TestService {
  private readonly logger = new Logger(TestService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() @Inject('STORAGE_ADAPTER') private readonly storageAdapter?: StorageAdapter,
  ) {}

  /**
   * Reset test environment
   * - Drops and recreates all nauth tables (database-agnostic)
   * - Flushes Redis (if using Redis storage adapter)
   *
   * @param light - If true, only truncates tables (faster, preserves schema). If false, drops and recreates tables.
   */
  async reset(light = false): Promise<void> {
    this.logger.log(`Resetting test environment (${light ? 'light' : 'full'})...`);

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      // Detect database type from DataSource
      const dbType = this.dataSource.options.type || this.dataSource.driver.options.type;

      // Database-agnostic: Get all nauth tables using TypeORM metadata
      const nauthTables = this.dataSource.entityMetadatas
        .filter((metadata) => metadata.tableName.startsWith('nauth_') || metadata.tableName.startsWith('nauth_test_'))
        .map((metadata) => metadata.tableName);

      if (light) {
        // Light reset: Just truncate tables (faster, preserves schema)
        // Disable foreign key checks temporarily for truncation
        if (dbType === 'postgres') {
          // PostgreSQL: Use TRUNCATE CASCADE to handle foreign keys
          for (const tableName of nauthTables) {
            try {
              await queryRunner.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
              this.logger.debug(`Truncated table: ${tableName}`);
            } catch (error) {
              this.logger.debug(`Table ${tableName} may not exist: ${error}`);
            }
          }
        } else if (dbType === 'mysql') {
          // MySQL: Disable foreign key checks, truncate, re-enable
          await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
          for (const tableName of nauthTables) {
            try {
              await queryRunner.query(`TRUNCATE TABLE \`${tableName}\``);
              this.logger.debug(`Truncated table: ${tableName}`);
            } catch (error) {
              this.logger.debug(`Table ${tableName} may not exist: ${error}`);
            }
          }
          await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
        } else {
          // Fallback: Delete all rows
          for (const tableName of nauthTables) {
            try {
              await queryRunner.query(`DELETE FROM "${tableName}"`);
              this.logger.debug(`Cleared table: ${tableName}`);
            } catch (error) {
              this.logger.debug(`Table ${tableName} may not exist: ${error}`);
            }
          }
        }
        this.logger.log('Database data cleared (light reset)');
        await queryRunner.release();
      } else {
        // Full reset: Drop and recreate tables
        // Drop tables using TypeORM (database-agnostic)
        for (const tableName of nauthTables) {
          try {
            await queryRunner.dropTable(tableName, true, true, true); // ifExists, dropForeignKeys, dropIndices
            this.logger.debug(`Dropped table: ${tableName}`);
          } catch (error) {
            // Table might not exist, which is fine
            this.logger.debug(`Table ${tableName} may not exist: ${error}`);
          }
        }

        await queryRunner.release();

        // Recreate tables using TypeORM synchronize (database-agnostic)
        // This will recreate all entities registered in the DataSource
        this.logger.log('Recreating database schema...');
        await this.dataSource.synchronize(true); // true = drop before sync
        this.logger.log('Database schema recreated');
      }

      // Flush Redis if using storage adapter
      if (this.storageAdapter) {
        try {
          // Find all keys with nauth: prefix
          const keys = await this.storageAdapter.keys('nauth:*');
          if (keys.length > 0) {
            // Delete all nauth keys
            for (const key of keys) {
              await this.storageAdapter.del(key);
            }
            this.logger.log(`Cleared ${keys.length} Redis keys with nauth: prefix`);
          } else {
            this.logger.debug('No Redis keys found with nauth: prefix');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to flush Redis keys: ${errorMessage}`);
          // Non-blocking: Continue even if Redis flush fails
        }
      } else {
        this.logger.debug('No storage adapter available - skipping Redis flush');
      }

      this.logger.log('Test environment reset complete');
    } catch (error) {
      this.logger.error(`Failed to reset test environment: ${error}`);
      throw error;
    }
  }

  /**
   * Get TOTP secret for a user
   * Retrieves the TOTP secret from the database
   */
  async getTotpSecret(userId: string): Promise<string> {
    // TODO: Query nauth_mfa_methods table for TOTP secret
    // SELECT secret FROM nauth_mfa_methods WHERE user_id = ? AND method = 'TOTP'
    this.logger.warn(`TOTP secret retrieval not fully implemented for userId: ${userId}`);
    return '';
  }
}
