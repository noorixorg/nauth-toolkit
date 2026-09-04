/**
 * Express Authentication Server
 *
 * Demonstrates nauth-toolkit integration with Express.
 */

import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { DataSource } from 'typeorm';
import {
  NAuth,
  ExpressAdapter,
  ExpressMiddlewareType,
  NAuthInstance,
} from '@nauth-toolkit/core';
import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';

import { authConfig } from './config/auth.config';
import { registerNAuthExpressRoutes } from '@nauth-toolkit/core';
import { errorHandler } from './utils/error-handler';

// NAuthInstance typed for Express — makes helpers return express.RequestHandler directly

async function main(): Promise<void> {
  console.log('Starting Express Authentication Server...');

  // ── Database ─────────────────────────────────────────────────────────────────
  // getNAuthTransientStorageEntities() adds the tables used by DatabaseStorageAdapter
  // (nauth_rate_limits, nauth_storage_locks) so no Redis is needed.

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE ?? 'nauth_sample',
    entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connection established');

  // ── NAuth ─────────────────────────────────────────────────────────────────────

  const nauth = await NAuth.create({
    config: authConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataSource: dataSource as any,
    adapter: new ExpressAdapter(),
  });

  console.log('nauth-toolkit initialized');

  // ── Express App ───────────────────────────────────────────────────────────────

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Sample app: CORS is fully open so any local dev server can connect.
  // In production, replace `origin: true` with an explicit list of allowed origins.
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-csrf-token', 'x-device-token'],
    }),
  );

  // ── NAuth Middleware (ORDER MATTERS) ──────────────────────────────────────────
  app.use(nauth.middleware.clientInfo as ExpressMiddlewareType); // MUST BE FIRST — initializes AsyncLocalStorage
  app.use(nauth.middleware.csrf as ExpressMiddlewareType);       // CSRF validation
  app.use(nauth.middleware.auth as ExpressMiddlewareType);       // JWT validation (sets user on context)
  app.use(nauth.middleware.tokenDelivery as ExpressMiddlewareType); // Response interceptor for cookie delivery

  // ── Health Check ──────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // ── Routes ────────────────────────────────────────────────────────────────────
  //
  // Mounted from the toolkit's route manifest rather than hand-written. Both bundles
  // serve the same handlers; only the token transport differs, which is what
  // `tokenDelivery.method: 'hybrid'` makes possible.
  //
  // To customise one route, exclude its key and register your own:
  //   registerNAuthExpressRoutes(webRouter, nauth, { delivery: 'cookies', exclude: ['login'] });
  //   webRouter.post('/login', nauth.helpers.public(), myLoginHandler);

  const webRouter = express.Router();
  registerNAuthExpressRoutes(webRouter, nauth, { delivery: 'cookies' });
  app.use('/auth', webRouter);

  const mobileRouter = express.Router();
  registerNAuthExpressRoutes(mobileRouter, nauth, {
    delivery: 'json',
    groups: ['core', 'profile', 'mfa', 'social', 'device'],
  });
  app.use('/mobile/auth', mobileRouter);

  // ── Error Handler (MUST BE LAST) ──────────────────────────────────────────────
  app.use(errorHandler);

  // ── Start ─────────────────────────────────────────────────────────────────────

  const port = parseInt(process.env.PORT || '3000', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log(`Health: http://0.0.0.0:${port}/health`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
