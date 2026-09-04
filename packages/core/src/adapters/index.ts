/**
 * Platform Adapters
 *
 * Framework-specific adapters that implement NAuthAdapter interface.
 */

// Platform interfaces (for custom adapter development)
export * from '../platform/interfaces';

// Built-in adapters
export { ExpressAdapter, ExpressMiddlewareType } from './express.adapter';
export { FastifyAdapter, FastifyMiddlewareType } from './fastify.adapter';

// Legacy export for backward compatibility (deprecated)
// TODO: Remove in next major version
