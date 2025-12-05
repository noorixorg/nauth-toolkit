import { Controller, Post, Get, Query, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { Public } from '@nauth-toolkit/nestjs';
import { TestService } from './test.service';

/**
 * Test Mode Controller
 *
 * Provides endpoints for E2E testing:
 * - Reset database/Redis state (optional, not used by default)
 * - Retrieve test data (email codes, SMS codes, TOTP secrets)
 *
 * ⚠️ ONLY ENABLED when NAUTH_TEST_MODE=true
 * ⚠️ DO NOT USE in production
 *
 * Note: Configuration changes require manual edits to auth.config.ts and app restart.
 * The app auto-restarts on file changes when using yarn start:dev.
 */
@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(
    private readonly testService: TestService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    // Verify test mode is enabled
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      this.logger.warn('⚠️  Test mode endpoints are DISABLED. Set NAUTH_TEST_MODE=true to enable.');
    }
  }

  /**
   * Reset test environment
   * - Drops and recreates database schema (full reset)
   * - Or truncates tables (light reset, faster, preserves schema)
   * - Flushes Redis
   *
   * POST /test/reset?light=true
   * Query params:
   *   - light: If true, only truncates tables (faster). If false or omitted, drops and recreates tables.
   */
  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Query('light') light?: string): Promise<{ message: string; mode: string }> {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      throw new BadRequestException('Test mode is not enabled');
    }

    const isLight = light === 'true' || light === '1';
    await this.testService.reset(isLight);
    return {
      message: 'Test environment reset successfully',
      mode: isLight ? 'light' : 'full',
    };
  }

  /**
   * Get latest SMS code for a phone number
   *
   * GET /test/sms/latest?phone=+1234567890
   *
   * Retrieves the latest verification code from nauth_verification_tokens
   * by finding the user by phone, then the token by userId.
   * Follows the same pattern as PhoneVerificationService.verifyPhoneWithCode()
   */
  @Public()
  @Get('sms/latest')
  async getLatestSMS(@Query('phone') phone: string): Promise<{ code: string }> {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      throw new BadRequestException('Test mode is not enabled');
    }

    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }

    // Get repositories using table names (database-agnostic approach)
    const userMetadata = this.dataSource.entityMetadatas.find((m) => m.tableName === 'nauth_users');
    if (!userMetadata) {
      throw new BadRequestException('User entity not found');
    }
    const userRepo = this.dataSource.getRepository(userMetadata.target);

    const verificationTokenMetadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === 'nauth_verification_tokens',
    );
    if (!verificationTokenMetadata) {
      throw new BadRequestException('VerificationToken entity not found');
    }
    const verificationTokenRepo = this.dataSource.getRepository(verificationTokenMetadata.target);

    // Step 1: Find user by phone (same as PhoneVerificationService)
    const user = await userRepo.findOne({ where: { phone } as any });
    if (!user) {
      this.logger?.warn?.(`User not found for phone: ${phone}`);
      return { code: '' };
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
      this.logger?.warn?.(`No verification token with code found for user: ${userId}, phone: ${phone}, type: phone`);
      return { code: '' };
    }

    return { code: verificationToken.code };
  }

  /**
   * Get latest email code for an email address
   *
   * GET /test/email/latest?email=user@example.com
   *
   * Retrieves the latest verification code from nauth_verification_tokens
   * by finding the user by email, then the token by userId.
   * Follows the same pattern as EmailVerificationService.verifyEmailWithCode()
   */
  @Public()
  @Get('email/latest')
  async getLatestEmail(@Query('email') email: string): Promise<{ code: string }> {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      throw new BadRequestException('Test mode is not enabled');
    }

    if (!email) {
      throw new BadRequestException('Email address is required');
    }

    // Get repositories using table names (database-agnostic approach)
    const userMetadata = this.dataSource.entityMetadatas.find((m) => m.tableName === 'nauth_users');
    if (!userMetadata) {
      throw new BadRequestException('User entity not found');
    }
    const userRepo = this.dataSource.getRepository(userMetadata.target);

    const verificationTokenMetadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === 'nauth_verification_tokens',
    );
    if (!verificationTokenMetadata) {
      throw new BadRequestException('VerificationToken entity not found');
    }
    const verificationTokenRepo = this.dataSource.getRepository(verificationTokenMetadata.target);

    // Step 1: Find user by email (normalized to lowercase, same as EmailVerificationService)
    const normalizedEmail = email.toLowerCase().trim();
    const user = await userRepo.findOne({ where: { email: normalizedEmail } as any });
    if (!user) {
      this.logger?.warn?.(`User not found for email: ${email} (normalized: ${normalizedEmail})`);
      return { code: '' };
    }

    const userId = (user as any).id;
    this.logger?.debug?.(`Found user: id=${userId}, email=${(user as any).email}, sub=${(user as any).sub}`);

    // Step 2: Find latest unused verification token for this user (same pattern as verification service)
    // Order by createdAt DESC to get the most recent token first
    const tokens = await verificationTokenRepo.find({
      where: {
        userId, // User's internal ID
        type: 'email', // Email verification tokens only
        usedAt: IsNull(), // Only unused tokens
      } as any,
      order: { createdAt: 'DESC' } as any,
    });

    this.logger?.debug?.(`Found ${tokens.length} unused email verification tokens for user ${userId}`);

    // Step 3: Find token with actual code (code might be null for link-based verification)
    const verificationToken = (tokens as any[]).find((t) => t.code !== null && t.code !== '');

    if (!verificationToken) {
      this.logger?.warn?.(
        `No verification token with code found for user: ${userId}, email: ${email}, type: email. Tokens found: ${tokens.length}, codes: ${tokens.map((t) => (t.code ? '***' : 'null')).join(', ')}`,
      );
      return { code: '' };
    }

    this.logger?.debug?.(
      `Found verification token: id=${verificationToken.id}, createdAt=${verificationToken.createdAt}, code=***`,
    );
    return { code: verificationToken.code };
  }

  /**
   * Get TOTP secret for a user
   *
   * GET /test/totp/secret?userId=user-id
   */
  @Public()
  @Get('totp/secret')
  async getTotpSecret(@Query('userId') userId: string): Promise<{ secret: string }> {
    if (process.env.NAUTH_TEST_MODE !== 'true') {
      throw new BadRequestException('Test mode is not enabled');
    }

    const secret = await this.testService.getTotpSecret(userId);
    return { secret };
  }
}
