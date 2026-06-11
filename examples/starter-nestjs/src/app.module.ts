import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';

/**
 * Root application module.
 *
 * Configures:
 * - TypeORM connection to PostgreSQL using nauth-toolkit entities
 * - Auth module (nauth-toolkit integration)
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE ?? 'nauth_sample',
      entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in dev
      logging: false,
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
