import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestService } from './test.service';
import { CustomAuthModule } from './auth/auth.module';
// Import helper function to get entities (prevents direct entity access)
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { TestModule } from './test/test.module';

/**
 * Root application module (v2.0)
 *
 * Configures:
 * - TypeORM connection to PostgreSQL
 * - Custom auth controller (which imports AuthModule)
 *
 * Note: Entities now imported from database package
 */
// Build entities array
const entities = [...getNAuthEntities()];

const imports = [
  // TypeORM configuration for MySQL
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE ?? 'nauth_sample',
    entities,
    logging: false,
  }),

  // Custom Auth Module (imports AuthModule internally)
  CustomAuthModule,

  // Test Module - code-fetching endpoints for E2E (e.g. /test/code/latest, /test/totp/secret)
  TestModule,
];

@Module({
  imports,
  controllers: [AppController],
  providers: [AppService, TestService],
})
export class AppModule {}
