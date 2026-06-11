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
import {
  NAuth,
  FastifyAdapter,
  NAuthInstance,
} from '@nauth-toolkit/core';
import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';

import { authConfig } from './config/auth.config';
import { registerAuthRoutes, registerMobileAuthRoutes } from './routes/auth.routes';
import { registerSocialRoutes } from './routes/social.routes';
import { errorHandler } from './utils/error-handler';

type FastifyPreHandler = (request: unknown, reply: unknown) => Promise<void>;
type TypedNAuth = NAuthInstance<FastifyPreHandler, FastifyPreHandler>;

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
  fastify.addHook('preHandler', nauth.middleware.clientInfo as FastifyPreHandler);
  fastify.addHook('preHandler', nauth.middleware.csrf as FastifyPreHandler);
  fastify.addHook('preHandler', nauth.middleware.auth as FastifyPreHandler);
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

  const typedNauth = nauth as TypedNAuth;

  await registerAuthRoutes(fastify, typedNauth);
  await registerMobileAuthRoutes(fastify, typedNauth);
  await registerSocialRoutes(fastify, typedNauth, nauth.socialRedirect!);

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
