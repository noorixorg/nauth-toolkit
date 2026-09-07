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

  // SECURITY: trust proxy so `req.ip` resolves the REAL client IP behind a reverse proxy /
  // load balancer, and forged `X-Forwarded-For` headers are ignored. nauth-toolkit keys
  // IP-based account lockout, geolocation and audit on `req.ip`, so this must be correct.
  //
  // Set TRUST_PROXY to match your topology:
  //   - Behind one reverse proxy (e.g. Caddy/Nginx on dev/staging): `1` (one hop).
  //   - Behind AWS ELB/ALB (ECS, Copilot) or other private-network LBs: `uniquelocal`
  //     trusts loopback + private ranges, so the first PUBLIC hop from the right (the real
  //     client) is used regardless of how many private hops (LB, sidecar) precede it.
  //   - A specific IP/CIDR list also works, e.g. `10.0.0.0/8`.
  //   - NEVER use `true` (trust all): it re-enables X-Forwarded-For spoofing.
  // Leave TRUST_PROXY unset when nothing proxies you: `req.ip` is then the socket peer
  // (fail-closed) and forwarding headers are ignored entirely.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== 'false') {
    const value: number | string = /^\d+$/.test(trustProxy) ? parseInt(trustProxy, 10) : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', value);
  }

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
