import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestController } from './test.controller';
import { TestService } from './test.service';

/**
 * Test Module
 *
 * Provides endpoints for E2E testing and code fetching (verification codes, TOTP secret, reset).
 * Always registered so code-fetching endpoints are available.
 *
 * Database-agnostic: Works with PostgreSQL and MySQL.
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
