/**
 * Fastify Authentication Server
 *
 * Demonstrates nauth-toolkit integration with Fastify.
 * Exact replica of the Express app using FastifyAdapter and Fastify-specific bootstrap.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { DataSource } from 'typeorm';
import { NAuth, FastifyAdapter, FastifyMiddlewareType } from '@nauth-toolkit/core';
import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';

import { authConfig } from './config/auth.config';
import { registerNAuthFastifyRoutes } from '@nauth-toolkit/core';
import { errorHandler } from './utils/error-handler';


async function main(): Promise<void> {
  console.log('Starting Fastify Authentication Server...');

  // ── Database ─────────────────────────────────────────────────────────────────
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
    adapter: new FastifyAdapter(),
  });

  console.log('nauth-toolkit initialized');

  // ── Fastify App ───────────────────────────────────────────────────────────────

  const fastify = Fastify({ logger: false });

  await fastify.register(fastifyCookie);
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-csrf-token', 'x-device-token'],
  });

  // ── NAuth Hooks (ORDER MATTERS) ───────────────────────────────────────────────
  // preHandler: clientInfo MUST BE FIRST (initializes AsyncLocalStorage)
  fastify.addHook('preHandler', nauth.middleware.clientInfo as FastifyMiddlewareType);
  fastify.addHook('preHandler', nauth.middleware.csrf as FastifyMiddlewareType);
  fastify.addHook('preHandler', nauth.middleware.auth as FastifyMiddlewareType);
  // tokenDelivery is a response interceptor — use onSend
  fastify.addHook(
    'onSend',
    nauth.middleware.tokenDelivery as (request: unknown, reply: unknown, payload: unknown) => Promise<unknown>,
  );

  // ── Health Check ──────────────────────────────────────────────────────────────

  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Routes ────────────────────────────────────────────────────────────────────

  // Mounted from the toolkit's route manifest rather than hand-written. Registering
  // inside an encapsulated scope is how Fastify applies a prefix; both bundles serve
  // the same handlers and differ only in token transport.
  //
  // To customise one route, exclude its key and register your own in the same scope.
  await fastify.register(
    async (scope) => registerNAuthFastifyRoutes(scope, nauth, { delivery: 'cookies' }),
    { prefix: '/auth' },
  );

  await fastify.register(
    async (scope) =>
      registerNAuthFastifyRoutes(scope, nauth, {
        delivery: 'json',
        groups: ['core', 'profile', 'mfa', 'social', 'device'],
      }),
    { prefix: '/mobile/auth' },
  );

  // ── Error Handler (MUST BE LAST) ──────────────────────────────────────────────
  fastify.setErrorHandler(errorHandler);

  // ── Start ─────────────────────────────────────────────────────────────────────

  const port = parseInt(process.env.PORT || '3000', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Server running on http://0.0.0.0:${port}`);
  console.log(`Health: http://0.0.0.0:${port}/health`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
