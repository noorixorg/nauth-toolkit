import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestService } from './test.service';
import { CustomAuthModule } from './auth/auth.module';
// Import helper function to get entities (prevents direct entity access)
import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-mysql';
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
const entities = [...getNAuthEntities(), ...getNAuthTransientStorageEntities()];

const imports = [
  // TypeORM configuration for MySQL
  TypeOrmModule.forRoot({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!, 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
    entities,
    synchronize: false, // migrations will be run automatically
    logging: false,
  }),

  // Custom Auth Module (imports AuthModule internally)
  CustomAuthModule,
];

// Test Module (only active when NAUTH_TEST_MODE=true)
// Provides endpoints: /test/reset, /test/config/apply, /test/sms/latest, /test/totp/secret
if (process.env.NAUTH_TEST_MODE === 'true') {
  imports.push(TestModule);
}

@Module({
  imports,
  controllers: [AppController],
  providers: [AppService, TestService],
})
export class AppModule {}
