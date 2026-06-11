import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// Load environment variables BEFORE importing AppModule
dotenv.config();

import { AppModule } from './app.module';
import { NAuthHttpExceptionFilter, NAuthValidationPipe } from '@nauth-toolkit/nestjs';

/**
 * Bootstrap the NestJS application with Express.
 *
 * - cookie-parser: required for cookie-based token delivery
 * - NAuthHttpExceptionFilter: maps nauth errors to HTTP responses
 * - NAuthValidationPipe: validates all incoming DTOs
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    logger: ['error', 'warn', 'log'],
  });

  app.use(cookieParser());
  app.useGlobalFilters(new NAuthHttpExceptionFilter());
  app.useGlobalPipes(new NAuthValidationPipe());

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-csrf-token', 'x-device-token'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
}

bootstrap();
