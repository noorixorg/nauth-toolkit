import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// Load environment variables BEFORE importing AppModule
dotenv.config();

import { AppModule } from './app.module';
import { NAuthHttpExceptionFilter, NAuthValidationPipe } from '@nauth-toolkit/nestjs';

/**
 * Bootstrap the NestJS application with Express (5.x)
 *
 * Uses ExpressAdapter from @nestjs/platform-express to select the Express HTTP driver.
 * Cookie-parser middleware is used for cookie-based token delivery.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Cookie middleware for cookie-based token delivery (e.g. nauth_refresh_token)
  app.use(cookieParser());

  // Enable nauth-toolkit exception filter (platform-agnostic)
  app.useGlobalFilters(new NAuthHttpExceptionFilter());

  // Enable global validation pipe for all DTOs
  app.useGlobalPipes(new NAuthValidationPipe());

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://192.168.50.39:4200',
      'capacitor://localhost',
      'ionic://localhost',
      'https://angular.dev1.noorix.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-csrf-token', 'x-device-token'],
  });

  const port = process.env.PORT || 3000;

  // Listen on all network interfaces so Android app can access it
  await app.listen(port, '0.0.0.0');
}

bootstrap();
