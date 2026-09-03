import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// Load environment variables BEFORE importing AppModule
dotenv.config();

import { AppModule } from './app.module';
import { NAuthHttpExceptionFilter, NAuthValidationPipe } from '@nauth-toolkit/nestjs';
import {
  NAUTH_OIDC_PROVIDER,
  createOIDCRateLimiter,
  mountOIDCProviderNest,
} from '@nauth-toolkit/oidc-provider/nestjs';
import { oidcConfig } from './config/oidc.config';

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

  // Mount the OpenID Connect provider FIRST.
  //
  // It attaches to the Express instance rather than Nest's router, so it deliberately
  // sits outside the guard, interceptor, pipe and filter chain — it speaks OAuth on
  // its own paths and wants nothing from nauth's request pipeline. Mounting ahead of
  // the body parsers also leaves the raw request stream intact for POST /oidc/token.
  //
  // Being on the Express instance also means setGlobalPrefix('api') does not apply,
  // so the endpoints sit exactly where the discovery document advertises them.
  // Rate limit ahead of the provider. oidc-provider ships none, and the mount sits
  // outside nauth's guard chain, so nothing else covers these paths — POST /token is
  // otherwise an unauthenticated brute-force surface against client secrets and
  // authorization codes.
  app.use(
    createOIDCRateLimiter(
      app.get('STORAGE_ADAPTER'),
      {
        authorize: { max: 60, windowSeconds: 60 },
        token: { max: 60, windowSeconds: 60 },
        introspection: { max: 600, windowSeconds: 60 },
      },
      { pathPrefix: oidcConfig.pathPrefix },
    ),
  );

  mountOIDCProviderNest(app, app.get(NAUTH_OIDC_PROVIDER), { pathPrefix: oidcConfig.pathPrefix });

  // Cookie middleware for cookie-based token delivery (e.g. nauth_refresh_token)
  app.use(cookieParser());

  // Enable nauth-toolkit exception filter (platform-agnostic)
  app.useGlobalFilters(new NAuthHttpExceptionFilter());

  // Enable global validation pipe for all DTOs
  app.useGlobalPipes(new NAuthValidationPipe());

  // Global prefix so routes match API_BASE_URL (e.g. https://demo.nauth.dev/api)
  app.setGlobalPrefix('api');

  const allowedOrigins: string[] = [
    'http://localhost:4200',
    'capacitor://localhost',
    'ionic://localhost',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    for (const origin of envOrigins) {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    }
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-csrf-token', 'x-device-token'],
  });

  const port = process.env.PORT || 3000;

  // Listen on all network interfaces so Android app can access it
  await app.listen(port, '0.0.0.0');
}

bootstrap();
