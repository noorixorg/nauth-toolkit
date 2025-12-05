/**
 * Fastify Authentication Server
 *
 * Demonstrates nauth-toolkit integration with Fastify.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyFormbody from '@fastify/formbody';
import { DataSource } from 'typeorm';
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { authConfig } from './config/auth.config';
import { createAuthRoutes } from './routes/auth.routes';
import { createTestRoutes } from './routes/test.routes';
import { createPinoLogger } from './utils/pino-logger.adapter';
import { errorHandler } from './utils/error-handler';

// ============================================================================
// Logger Setup
// ============================================================================
const logger = createPinoLogger({
  level: process.env.LOG_LEVEL || 'info',
});

async function main() {
  logger.info('Starting Fastify Authentication Server...');

  // ============================================================================
  // Database Setup
  // ============================================================================
  logger.info('Setting up database connection...');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'nauth_db',
    entities: [...getNAuthEntities()],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: false,
  });

  await dataSource.initialize();
  logger.info('Database connection established');

  // ============================================================================
  // NAuth Initialization
  // ============================================================================
  logger.info('Initializing NAuth Toolkit...');

  const nauth = await NAuth.create({
    config: authConfig,
    dataSource: dataSource as any,
    adapter: new FastifyAdapter(),
  });

  logger.info('NAuth Toolkit initialized');

  // ============================================================================
  // Fastify App Setup
  // ============================================================================
  const fastify = Fastify({
    logger: false, // We use our own logger
  });

  // Plugins
  await fastify.register(fastifyHelmet);
  await fastify.register(fastifyCors, {
    origin: ['http://localhost:4200', 'http://localhost:3000', 'https://angular.dev1.noorix.com'],
    credentials: true,
  });
  await fastify.register(fastifyFormbody);
  await fastify.register(fastifyCookie);

  // ============================================================================
  // NAuth Hooks (Global Middleware)
  // ============================================================================
  // Type cast to any required because NAuth is framework-agnostic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = nauth.middleware as any;

  // 1. Client Info - Initializes AsyncLocalStorage context (MUST BE FIRST)
  fastify.addHook('onRequest', m.clientInfo);

  // 2. CSRF - Runs after client info
  fastify.addHook('onRequest', m.csrf);

  // 3. Auth - Runs after CSRF
  fastify.addHook('onRequest', m.auth);

  // 4. Token Delivery - Intercepts responses
  fastify.addHook('onSend', m.tokenDelivery);

  // ============================================================================
  // Routes
  // ============================================================================
  // Register auth routes with /auth prefix
  fastify.register(
    async (api) => {
      createAuthRoutes(api, nauth);
    },
    { prefix: '/auth' },
  );

  // Test routes (only enabled when NAUTH_TEST_MODE=true)
  if (process.env.NAUTH_TEST_MODE === 'true') {
    fastify.register(
      async (api) => {
        createTestRoutes(api, dataSource);
      },
      { prefix: '/test' },
    );
    logger.warn('⚠️  Test mode endpoints are ENABLED. DO NOT USE in production.');
  }

  // Health Check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'Not found' });
  });

  // ============================================================================
  // Error Handler (MUST BE LAST)
  // ============================================================================
  fastify.setErrorHandler(errorHandler);

  // ============================================================================
  // Start Server
  // ============================================================================
  const PORT = parseInt(process.env.PORT || '3000', 10);
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
    logger.info(`API Health: http://0.0.0.0:${PORT}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
