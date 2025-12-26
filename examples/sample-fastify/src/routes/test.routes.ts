/**
 * Test Routes for Fastify
 *
 * Provides endpoints for E2E testing:
 * - Retrieve test data (email codes, SMS codes)
 *
 * WARNING: ONLY ENABLED when NAUTH_TEST_MODE=true
 * WARNING: DO NOT USE in production
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DataSource, IsNull } from 'typeorm';

/**
 * Create test routes for Fastify
 *
 * @param fastify - Fastify instance
 * @param dataSource - TypeORM DataSource instance
 */
export function createTestRoutes(fastify: FastifyInstance, dataSource: DataSource): void {
  /**
   * Get latest email code for an email address
   *
   * GET /test/email/latest?email=user@example.com
   */
  fastify.get('/email/latest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      return reply.code(400).send({ error: 'Test mode is not enabled' });
    }

    const { email } = request.query as { email?: string };
    if (!email || typeof email !== 'string') {
      return reply.code(400).send({ error: 'Email address is required' });
    }

    try {
      // Get repositories using table names (database-agnostic approach)
      const userMetadata = dataSource.entityMetadatas.find((m) => m.tableName === 'nauth_users');
      if (!userMetadata) {
        return reply.code(500).send({ error: 'User entity not found' });
      }
      const userRepo = dataSource.getRepository(userMetadata.target);

      const verificationTokenMetadata = dataSource.entityMetadatas.find(
        (m) => m.tableName === 'nauth_verification_tokens',
      );
      if (!verificationTokenMetadata) {
        return reply.code(500).send({ error: 'VerificationToken entity not found' });
      }
      const verificationTokenRepo = dataSource.getRepository(verificationTokenMetadata.target);

      // Step 1: Find user by email (normalized to lowercase, same as EmailVerificationService)
      const normalizedEmail = email.toLowerCase().trim();
      const user = await userRepo.findOne({ where: { email: normalizedEmail } as any });
      if (!user) {
        return { code: '' };
      }

      const userId = (user as any).id;

      // Step 2: Find latest unused verification token for this user
      const tokens = await verificationTokenRepo.find({
        where: {
          userId,
          type: 'email',
          usedAt: IsNull(),
        } as any,
        order: { createdAt: 'DESC' } as any,
      });

      // Step 3: Find token with actual code
      const verificationToken = (tokens as any[]).find((t) => t.code !== null && t.code !== '');

      if (!verificationToken) {
        return { code: '' };
      }

      return { code: verificationToken.code };
    } catch (error) {
      // Intentionally avoid console.* per project rules (tests mode endpoint).
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get latest SMS code for a phone number
   *
   * GET /test/sms/latest?phone=+1234567890
   */
  fastify.get('/sms/latest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      return reply.code(400).send({ error: 'Test mode is not enabled' });
    }

    const { phone } = request.query as { phone?: string };
    if (!phone || typeof phone !== 'string') {
      return reply.code(400).send({ error: 'Phone number is required' });
    }

    try {
      // Get repositories using table names (database-agnostic approach)
      const userMetadata = dataSource.entityMetadatas.find((m) => m.tableName === 'nauth_users');
      if (!userMetadata) {
        return reply.code(500).send({ error: 'User entity not found' });
      }
      const userRepo = dataSource.getRepository(userMetadata.target);

      const verificationTokenMetadata = dataSource.entityMetadatas.find(
        (m) => m.tableName === 'nauth_verification_tokens',
      );
      if (!verificationTokenMetadata) {
        return reply.code(500).send({ error: 'VerificationToken entity not found' });
      }
      const verificationTokenRepo = dataSource.getRepository(verificationTokenMetadata.target);

      // Step 1: Find user by phone
      const user = await userRepo.findOne({ where: { phone } as any });
      if (!user) {
        return { code: '' };
      }

      const userId = (user as any).id;

      // Step 2: Find latest unused verification token
      const tokens = await verificationTokenRepo.find({
        where: {
          userId,
          type: 'phone',
          usedAt: IsNull(),
        } as any,
        order: { createdAt: 'DESC' } as any,
      });

      // Step 3: Find token with actual code
      const verificationToken = (tokens as any[]).find((t) => t.code !== null && t.code !== '');

      if (!verificationToken) {
        return { code: '' };
      }

      return { code: verificationToken.code };
    } catch (error) {
      // Intentionally avoid console.* per project rules (tests mode endpoint).
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

