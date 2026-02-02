import {
  Controller,
  Post,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { Public, AuthGuard, CurrentUser, IUser } from '@nauth-toolkit/nestjs';
import { TestService } from './test.service';

/**
 * Test Controller
 *
 * Provides endpoints for E2E testing and code fetching:
 * - Reset database/Redis state: POST /test/reset
 * - Retrieve verification codes: GET /test/code/latest, GET /test/code/latest/authenticated
 * - Retrieve TOTP secret: GET /test/totp/secret
 * - Config apply, SMS latest, etc.
 */
@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(
    private readonly testService: TestService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

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
    const isLight = light === 'true' || light === '1';
    await this.testService.reset(isLight);
    return {
      message: 'Test environment reset successfully',
      mode: isLight ? 'light' : 'full',
    };
  }

  /**
   * Get latest verification code for a challenge session or password reset
   *
   * GET /test/code/latest?sessionId=99f45d2b-3834-46d6-8a89-b90c349a9a94
   * GET /test/code/latest?identifier=user@example.com&type=password_reset
   *
   * For challenge sessions: Retrieves the latest verification code from nauth_verification_tokens
   * by finding the challenge session by sessionToken, then the token by challengeSessionId.
   *
   * For password reset: Retrieves the latest password reset code by finding the user by identifier
   * (email, username, or phone), then the password reset token by userId.
   *
   * Returns null if code is not found (instead of empty string) to distinguish
   * between "no code" and "code exists but is empty".
   */
  @Public()
  @Get('code/latest')
  async getLatestCode(
    @Query('sessionId') sessionId?: string,
    @Query('method') method?: string,
    @Query('identifier') identifier?: string,
    @Query('type') type?: string,
  ): Promise<{ code: string | null }> {
    // Handle password reset code request
    if (type === 'password_reset' && identifier) {
      return this.getPasswordResetCode(identifier);
    }

    // Handle challenge session code request (existing logic)
    if (!sessionId || sessionId === 'undefined' || sessionId.trim() === '') {
      this.logger?.warn?.(`Invalid sessionId provided: ${JSON.stringify(sessionId)}`);
      throw new BadRequestException('Invalid sessionId provided');
    }

    // Validate sessionId is a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      this.logger?.warn?.(`SessionId is not a valid UUID: ${sessionId}`);
      throw new BadRequestException('SessionId is not a valid UUID');
    }

    // Get repositories using table names (database-agnostic approach)
    const challengeSessionMetadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === 'nauth_challenge_sessions',
    );
    if (!challengeSessionMetadata) {
      throw new BadRequestException('ChallengeSession entity not found');
    }
    const challengeSessionRepo = this.dataSource.getRepository(challengeSessionMetadata.target);

    const verificationTokenMetadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === 'nauth_verification_tokens',
    );
    if (!verificationTokenMetadata) {
      throw new BadRequestException('VerificationToken entity not found');
    }
    const verificationTokenRepo = this.dataSource.getRepository(verificationTokenMetadata.target);

    // Step 1: Find challenge session by sessionToken
    const challengeSession = await challengeSessionRepo.findOne({
      where: { sessionToken: sessionId } as any,
      order: { id: 'DESC' } as any,
    });

    if (!challengeSession) {
      this.logger?.warn?.(`Challenge session not found for sessionToken: ${sessionId}`);
      throw new BadRequestException(`Challenge session not found for sessionToken: ${sessionId}`);
    }

    const challengeSessionId = (challengeSession as any).id;
    const challengeName = (challengeSession as any).challengeName;
    const challengeSessionUserId = (challengeSession as any).userId;

    this.logger?.debug?.(
      `Found challenge session: id=${challengeSessionId}, challengeName=${challengeName}, userId=${challengeSessionUserId}, sessionToken=${sessionId}`,
    );

    // Step 2: Determine token type based on challenge name
    let tokenType: 'email' | 'phone' | null = null;
    if (challengeName === 'VERIFY_EMAIL') {
      tokenType = 'email';
    } else if (challengeName === 'VERIFY_PHONE') {
      tokenType = 'phone';
    } else if (challengeName === 'MFA_REQUIRED') {
      // For MFA_REQUIRED, method can come from:
      // 1. Query param (when user switches from passkey to SMS/email)
      // 2. Challenge parameters (preferredMethod or method)
      // 3. Metadata (stored in database)
      const params = (challengeSession as any).challengeParameters || {};
      const metadata = (challengeSession as any).metadata || {};
      const mfaMethod =
        method || params['preferredMethod'] || params['method'] || metadata['method'] || metadata['preferredMethod'];

      // Normalize method name (database might store 'SMS' but we need 'sms')
      const normalizedMethod = mfaMethod ? String(mfaMethod).toLowerCase() : null;

      if (normalizedMethod === 'sms') {
        tokenType = 'phone';
      } else if (normalizedMethod === 'email') {
        tokenType = 'email';
      }

      this.logger?.debug?.(
        `MFA_REQUIRED challenge: method=${mfaMethod}, normalizedMethod=${normalizedMethod}, tokenType=${tokenType}`,
      );
    } else if (challengeName === 'MFA_SETUP_REQUIRED') {
      // For MFA_SETUP_REQUIRED, method comes from query param (set by frontend)
      // or from challenge session metadata if available
      const params = (challengeSession as any).challengeParameters || {};
      const metadata = (challengeSession as any).metadata || {};
      const mfaMethod = method || params['method'] || metadata['method'];

      // Normalize method name
      const normalizedMethod = mfaMethod ? String(mfaMethod).toLowerCase() : null;

      if (normalizedMethod === 'sms') {
        tokenType = 'phone';
      } else if (normalizedMethod === 'email') {
        tokenType = 'email';
      }

      this.logger?.debug?.(
        `MFA_SETUP_REQUIRED challenge: method=${mfaMethod}, normalizedMethod=${normalizedMethod}, tokenType=${tokenType}`,
      );
    }

    if (!tokenType) {
      this.logger?.warn?.(`Challenge type ${challengeName} does not use verification codes`);
      throw new BadRequestException(`Challenge type ${challengeName} does not use verification codes`);
    }

    // Step 3: Find most recent verification token by challengeSessionId and type
    if (!challengeSessionId) {
      throw new BadRequestException('Challenge session ID is required');
    }

    // Get most recent unused token with code, ordered by id DESC
    const verificationToken = await verificationTokenRepo.findOne({
      where: {
        challengeSessionId,
        type: tokenType,
        usedAt: IsNull(),
      } as any,
      order: { id: 'DESC' } as any,
    });

    if (!verificationToken?.code) {
      return { code: null };
    }

    return { code: verificationToken.code };
  }

  /**
   * Get latest verification code for authenticated user
   *
   * GET /test/code/latest/authenticated?method=email
   *
   * Retrieves the latest verification code for the currently authenticated user.
   * Uses req.user from authentication context - much safer than relying on userId fallback.
   * Only works for authenticated flows (dashboard MFA setup).
   *
   * Query params:
   *   - method: MFA method ('sms' or 'email') - required
   *
   * Returns null if code is not found.
   */
  @UseGuards(AuthGuard)
  @Get('code/latest/authenticated')
  async getLatestCodeForAuthenticatedUser(
    @CurrentUser() user: IUser,
    @Query('method') method: string,
  ): Promise<{ code: string | null }> {
    if (!method || (method !== 'sms' && method !== 'email')) {
      throw new BadRequestException('Method must be "sms" or "email"');
    }

    // Normalize method to token type
    const tokenType = method === 'sms' ? 'phone' : 'email';

    // Get repository using table name (database-agnostic approach)
    const verificationTokenMetadata = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === 'nauth_verification_tokens',
    );
    if (!verificationTokenMetadata) {
      throw new BadRequestException('VerificationToken entity not found');
    }
    const verificationTokenRepo = this.dataSource.getRepository(verificationTokenMetadata.target);

    // Get user ID from authenticated user
    const userId = (user as any).id || (user as any).sub;
    if (!userId) {
      this.logger?.warn?.('User ID not found in authenticated user object');
      throw new BadRequestException('User ID not found');
    }

    this.logger?.debug?.(
      `Getting latest code for authenticated user: userId=${userId}, method=${method}, tokenType=${tokenType}`,
    );

    // Find latest unused verification token for this user and type
    const tokens = await verificationTokenRepo.find({
      where: {
        userId,
        type: tokenType,
        usedAt: IsNull(), // Only unused tokens
      } as any,
      order: { createdAt: 'DESC' } as any,
    });

    this.logger?.debug?.(`Found ${tokens.length} verification tokens for userId: ${userId}, type: ${tokenType}`);

    // Find token with actual code (code might be null for link-based verification)
    const verificationToken = tokens.find((t) => t.code !== null && t.code !== '' && String(t.code).trim() !== '');

    if (!verificationToken) {
      this.logger?.warn?.(`No verification token with code found for userId: ${userId}, type: ${tokenType}`);
      return { code: null };
    }

    this.logger?.debug?.(
      `Found verification token: id=${verificationToken.id}, createdAt=${verificationToken.createdAt}, code=***`,
    );
    return { code: verificationToken.code };
  }

  /**
   * Get password reset code for an identifier
   *
   * Helper method to retrieve password reset codes by user identifier.
   *
   * @param identifier - User identifier (email, username, or phone)
   * @returns Password reset code or null if not found
   */
  private async getPasswordResetCode(identifier: string): Promise<{ code: string | null }> {
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

    // Step 1: Find user by identifier (email, username, or phone)
    const normalizedIdentifier = identifier.toLowerCase().trim();
    let user: unknown = null;

    // Try email first
    user = await userRepo.findOne({ where: { email: normalizedIdentifier } as any });

    // Try username if not found
    if (!user) {
      user = await userRepo.findOne({
        where: { username: normalizedIdentifier } as any,
      });
    }

    // Try phone if not found
    if (!user) {
      user = await userRepo.findOne({
        where: { phone: identifier } as any, // Phone numbers may have + prefix, don't lowercase
      });
    }

    if (!user) {
      this.logger?.warn?.(`User not found for identifier: ${identifier}`);
      return { code: null };
    }

    const userRow = user as { id?: unknown } | null;
    const userId = userRow?.id;
    if (userId === undefined || userId === null) {
      this.logger?.warn?.(`User ID not found for identifier: ${identifier}`);
      return { code: null };
    }

    // Step 2: Find latest unused password reset token
    const tokens = await verificationTokenRepo.find({
      where: {
        userId,
        type: 'password_reset',
        usedAt: IsNull(),
      } as any,
      order: { createdAt: 'DESC' } as any,
    });

    this.logger?.debug?.(
      `Found ${tokens.length} password reset tokens for userId: ${userId}, identifier: ${identifier}`,
    );

    // Step 3: Find token with actual code
    const verificationToken = tokens.find((t) => t.code !== null && t.code !== '' && String(t.code).trim() !== '');

    if (!verificationToken) {
      this.logger?.warn?.(`No password reset token with code found for userId: ${userId}, identifier: ${identifier}`);
      return { code: null };
    }

    this.logger?.debug?.(
      `Found password reset token: id=${verificationToken.id}, createdAt=${verificationToken.createdAt}, code=***`,
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
    const secret = await this.testService.getTotpSecret(userId);
    return { secret };
  }
}
