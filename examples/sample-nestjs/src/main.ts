import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';

// Load environment variables BEFORE importing AppModule
dotenv.config();

import { AppModule } from './app.module';
import { NAuthHttpExceptionFilter, NAuthValidationPipe } from '@nauth-toolkit/nestjs';

/**
 * Bootstrap the NestJS application with Fastify
 *
 * **PLATFORM-AGNOSTIC PROOF OF CONCEPT:**
 * This demonstrates that nauth-toolkit's core and NestJS adapter
 * work seamlessly with ANY NestJS HTTP adapter (Express, Fastify, etc.)
 *
 * The only changes required:
 * 1. Import FastifyAdapter and NestFastifyApplication
 * 2. Pass FastifyAdapter to NestFactory.create()
 * 3. Replace Express middleware with Fastify plugins
 *
 * NO CHANGES needed to auth services, guards, interceptors, or decorators!
 * Everything is platform-agnostic via NestJS's ArgumentsHost abstraction.
 */
async function bootstrap() {
  // Create NestJS application with Fastify adapter
  // Enable Fastify request logging
  const fastifyAdapter = new FastifyAdapter({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      // Fastify will log all incoming requests automatically
      // Format: { level, time, msg, reqId, req: { method, url, ... }, res: { statusCode, ... } }
    },
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // app.set('trust proxy', true);

  // Get Fastify instance for plugin registration
  const fastifyInstance = app.getHttpAdapter().getInstance();

  // Register Fastify cookie plugin for cookie-based token delivery
  // (replaces Express cookie-parser middleware)
  // Type assertion needed due to type mismatch between NestJS Fastify adapter and plugin types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await fastifyInstance.register(fastifyCookie as any);

  // ============================================================================
  // Fix DELETE endpoint body parsing
  // ============================================================================
  // Use Fastify's preParsing hook to handle DELETE requests with empty bodies
  // This is the official Fastify way to handle this scenario
  fastifyInstance.addHook('preParsing', (request, reply, payload, done) => {
    // Remove Content-Type header for DELETE requests with empty bodies
    // This prevents Fastify from expecting a JSON body when none is provided
    if (
      request.method === 'DELETE' &&
      request.headers['content-type'] === 'application/json' &&
      (!request.headers['content-length'] || request.headers['content-length'] === '0')
    ) {
      delete request.headers['content-type'];
    }
    done();
  });

  // Enable nauth-toolkit exception filter (PLATFORM-AGNOSTIC - works with Fastify!)
  // Uses ArgumentsHost abstraction - not Express-specific
  app.useGlobalFilters(new NAuthHttpExceptionFilter());

  // Enable global validation pipe for all DTOs
  // Validates request bodies using nauth-toolkit's stable error contract
  app.useGlobalPipes(new NAuthValidationPipe());

  // CORS configuration from environment
  const allowedOrigins = [
    process.env.FRONTEND_BASE_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  ].filter((origin): origin is string => origin !== undefined);

  // Add localhost for local development
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:4200', 'http://localhost:3000');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-csrf-token', 'x-device-token'],
  });

  // Global API prefix: all routes served under /api (e.g. /api/auth/signup, /api/health)
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;

  // Listen on all network interfaces so Android app can access it
  await app.listen(port, '0.0.0.0');
}

bootstrap();
