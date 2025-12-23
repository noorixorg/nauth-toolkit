/**
 * Test Routes
 *
 * Provides endpoints for E2E testing:
 * - Retrieve test data (email codes, SMS codes)
 *
 * WARNING: ONLY ENABLED when NAUTH_TEST_MODE=true
 * WARNING: DO NOT USE in production
 */

import { Router, Request, Response } from 'express';
import { DataSource, IsNull } from 'typeorm';

/**
 * Create test routes
 *
 * @param dataSource - TypeORM DataSource instance
 * @returns Express router with test endpoints
 */
export function createTestRoutes(dataSource: DataSource): Router {
  const router = Router();

  /**
   * Get latest email code for an email address
   *
   * GET /test/email/latest?email=user@example.com
   *
   * Retrieves the latest verification code from nauth_verification_tokens
   * by finding the user by email, then the token by userId.
   */
  router.get('/email/latest', async (req: Request, res: Response) => {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      return res.status(400).json({ error: 'Test mode is not enabled' });
    }

    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    try {
      // Get repositories using table names (database-agnostic approach)
      const userMetadata = dataSource.entityMetadatas.find((m) => m.tableName === 'nauth_users');
      if (!userMetadata) {
        return res.status(500).json({ error: 'User entity not found' });
      }
      const userRepo = dataSource.getRepository(userMetadata.target);

      const verificationTokenMetadata = dataSource.entityMetadatas.find(
        (m) => m.tableName === 'nauth_verification_tokens',
      );
      if (!verificationTokenMetadata) {
        return res.status(500).json({ error: 'VerificationToken entity not found' });
      }
      const verificationTokenRepo = dataSource.getRepository(verificationTokenMetadata.target);

      // Step 1: Find user by email (normalized to lowercase, same as EmailVerificationService)
      const normalizedEmail = email.toLowerCase().trim();
      const user = await userRepo.findOne({ where: { email: normalizedEmail } as any });
      if (!user) {
        return res.json({ code: '' });
      }

      const userId = (user as any).id;

      // Step 2: Find latest unused verification token for this user
      // Order by createdAt DESC to get the most recent token first
      const tokens = await verificationTokenRepo.find({
        where: {
          userId, // User's internal ID
          type: 'email', // Email verification tokens only
          usedAt: IsNull(), // Only unused tokens
        } as any,
        order: { createdAt: 'DESC' } as any,
      });

      // Step 3: Find token with actual code (code might be null for link-based verification)
      const verificationToken = (tokens as any[]).find((t) => t.code !== null && t.code !== '');

      if (!verificationToken) {
        return res.json({ code: '' });
      }

      return res.json({ code: verificationToken.code });
    } catch (error) {
      console.error('Error retrieving email code:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get latest SMS code for a phone number
   *
   * GET /test/sms/latest?phone=+1234567890
   *
   * Retrieves the latest verification code from nauth_verification_tokens
   * by finding the user by phone, then the token by userId.
   */
  router.get('/sms/latest', async (req: Request, res: Response) => {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      return res.status(400).json({ error: 'Test mode is not enabled' });
    }

    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
      // Get repositories using table names (database-agnostic approach)
      const userMetadata = dataSource.entityMetadatas.find((m) => m.tableName === 'nauth_users');
      if (!userMetadata) {
        return res.status(500).json({ error: 'User entity not found' });
      }
      const userRepo = dataSource.getRepository(userMetadata.target);

      const verificationTokenMetadata = dataSource.entityMetadatas.find(
        (m) => m.tableName === 'nauth_verification_tokens',
      );
      if (!verificationTokenMetadata) {
        return res.status(500).json({ error: 'VerificationToken entity not found' });
      }
      const verificationTokenRepo = dataSource.getRepository(verificationTokenMetadata.target);

      // Step 1: Find user by phone (same as PhoneVerificationService)
      const user = await userRepo.findOne({ where: { phone } as any });
      if (!user) {
        return res.json({ code: '' });
      }

      const userId = (user as any).id;

      // Step 2: Find latest unused verification token (same pattern as verification service)
      // Order by createdAt DESC to get the most recent token first
      const tokens = await verificationTokenRepo.find({
        where: {
          userId, // User's internal ID
          type: 'phone', // Phone verification tokens only
          usedAt: IsNull(), // Only unused tokens
        } as any,
        order: { createdAt: 'DESC' } as any,
      });

      // Step 3: Find token with actual code (code might be null for link-based verification)
      const verificationToken = (tokens as any[]).find((t) => t.code !== null && t.code !== '');

      if (!verificationToken) {
        return res.json({ code: '' });
      }

      return res.json({ code: verificationToken.code });
    } catch (error) {
      console.error('Error retrieving SMS code:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

