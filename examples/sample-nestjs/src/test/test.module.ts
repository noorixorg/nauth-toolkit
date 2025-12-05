import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestController } from './test.controller';
import { TestService } from './test.service';

/**
 * Test Module
 *
 * Provides test-mode endpoints for E2E testing.
 * Only registered when NAUTH_TEST_MODE=true
 *
 * Database-agnostic: Works with PostgreSQL and MySQL
 *
 * Note: Imports TypeOrmModule to make DataSource available for TestService.
 * STORAGE_ADAPTER is optional and provided by AuthModule if available.
 */
@Module({
  imports: [
    // Import TypeOrmModule to make DataSource available for injection
    // This allows TestService to access the database connection
    TypeOrmModule.forFeature([]),
  ],
  controllers: [TestController],
  providers: [TestService],
  exports: [TestService],
})
export class TestModule {}
