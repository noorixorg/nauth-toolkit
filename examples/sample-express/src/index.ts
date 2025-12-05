/**
 * Express Authentication Server
 *
 * Demonstrates nauth-toolkit integration with Express.
 * Uses the same configuration as the NestJS sample app for consistency.
 */

import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { NAuth, ExpressAdapter, ExpressMiddlewareType, NAuthInstance } from '@nauth-toolkit/core';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { authConfig } from './config/auth.config';
import { createAuthRoutes } from './routes/auth.routes';
import { createTestRoutes } from './routes/test.routes';
import { errorHandler } from './utils/error-handler';
import { createPinoLogger } from './utils/pino-logger.adapter';

// ============================================================================
// Logger Setup
// ============================================================================
const logger = createPinoLogger({
  level: process.env.LOG_LEVEL || 'info',
});

async function main() {
  logger.info('Starting Express Authentication Server...');

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
    synchronize: process.env.NODE_ENV !== 'production', // Auto-sync in development
    logging: false, // Disable verbose TypeORM logs
  });

  await dataSource.initialize();
  logger.info('Database connection established');

  // ============================================================================
  // NAuth Initialization
  // ============================================================================
  logger.info('Initializing nauth-toolkit...');

  const nauth = await NAuth.create({
    config: authConfig,
    dataSource: dataSource as any,
    adapter: new ExpressAdapter()
  });

  logger.info('nauth-toolkit initialized');

  // ============================================================================
  // Express App Setup
  // ============================================================================
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration - allow frontend domains
  app.use(
    cors({
      origin: [
        'http://localhost:4200', // Local development
        'http://localhost:3000', // Local development
        'https://angular.dev1.noorix.com', // Deployed frontend
      ],
      credentials: true, // Allow cookies
    }),
  );

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Cookie parsing (MUST be before NAuth middleware)
  app.use(cookieParser());

  // ============================================================================
  // NAuth Middleware (ORDER MATTERS!)
  // ============================================================================
  // Type cast required because NAuth is framework-agnostic
  app.use(nauth.middleware.clientInfo as ExpressMiddlewareType); // MUST BE FIRST
  app.use(nauth.middleware.csrf as ExpressMiddlewareType); // CSRF protection (if cookies/hybrid)
  app.use(nauth.middleware.auth as ExpressMiddlewareType); // Optional authentication
  app.use(nauth.middleware.tokenDelivery as ExpressMiddlewareType); // Token delivery

  // ============================================================================
  // Routes
  // ============================================================================
  // Cast to typed version for route handlers
  type TypedNAuth = NAuthInstance<ExpressMiddlewareType, express.RequestHandler>;
  app.use('/auth', createAuthRoutes(nauth as TypedNAuth));

  // Test routes (only enabled when NAUTH_TEST_MODE=true)
  if (process.env.NAUTH_TEST_MODE === 'true') {
    app.use('/test', createTestRoutes(dataSource));
    logger.warn('⚠️  Test mode endpoints are ENABLED. DO NOT USE in production.');
  }

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ============================================================================
  // Error Handler (MUST BE LAST)
  // ============================================================================
  app.use(errorHandler);

  // ============================================================================
  // Start Server
  // ============================================================================
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, "0.0.0.0",() => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
    logger.info(`API Health: http://0.0.0.0:${PORT}/health`);
  });
}

// Start server
main().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
