/**
 * Hook provider interfaces for extending authentication flows
 *
 * Hooks allow consumer applications to inject custom logic at specific points
 * in the authentication flow. Unlike config-based hooks, provider-based hooks
 * support dependency injection and are registered after bootstrap.
 *
 * @packageDocumentation
 */

/**
 * Pre-signup hook provider interface
 *
 * Validates signup attempts before user creation.
 * Can block signup by throwing NAuthException with PRESIGNUP_FAILED.
 *
 * @remarks
 * This hook is triggered:
 * - **Password signup**: Before user is created in the database
 * - **Social signup**: Before user is created (for both web redirect and native mobile flows)
 * - **Admin signup**: Before user is created (both `adminSignup` and `adminSignupSocial`)
 *
 * @example NestJS implementation
 * ```typescript
 * @Injectable()
 * export class InviteOnlyPreSignupHook implements IPreSignupHookProvider {
 *   constructor(private readonly invitationService: InvitationService) {}
 *
 *   async execute(
 *     data: unknown,
 *     signupType: 'password' | 'social',
 *     provider?: string,
 *     adminSignup?: boolean,
 *   ): Promise<void> {
 *     if (adminSignup) return; // Skip validation for admin signups
 *
 *     if (signupType === 'password') {
 *       const dto = data as SignupDTO;
 *       if (!await this.invitationService.hasValidInvite(dto.email)) {
 *         throw new NAuthException(
 *           AuthErrorCode.PRESIGNUP_FAILED,
 *           'Signup requires an invitation.'
 *         );
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * @example Express implementation
 * ```typescript
 * class InviteOnlyPreSignupHook implements IPreSignupHookProvider {
 *   constructor(private invitationService: InvitationService) {}
 *
 *   async execute(
 *     data: unknown,
 *     signupType: 'password' | 'social',
 *     provider?: string,
 *     adminSignup?: boolean,
 *   ): Promise<void> {
 *     if (adminSignup) return;
 *
 *     if (signupType === 'password') {
 *       const dto = data as SignupDTO;
 *       if (!await this.invitationService.hasValidInvite(dto.email)) {
 *         throw new NAuthException(
 *           AuthErrorCode.PRESIGNUP_FAILED,
 *           'Signup requires an invitation.'
 *         );
 *       }
 *     }
 *   }
 * }
 *
 * // Register after NAuth initialization
 * const inviteHook = new InviteOnlyPreSignupHook(invitationService);
 * nauth.hookRegistry.registerPreSignup(inviteHook);
 * ```
 */
export interface IPreSignupHookProvider {
  /**
   * Execute pre-signup validation
   *
   * @param data - SignupDTO for password signup, OAuthUserProfile for social signup
   * @param signupType - Type of signup
   * @param provider - Social provider name (only for social signups)
   * @param adminSignup - true for admin signups, false for regular signups
   * @throws {NAuthException} with PRESIGNUP_FAILED to block signup
   */
  execute(data: unknown, signupType: 'password' | 'social', provider?: string, adminSignup?: boolean): Promise<void>;
}

/**
 * After-signup hook provider interface
 *
 * Executes actions after user creation (non-blocking).
 * Errors are logged but do not affect signup.
 *
 * @remarks
 * This hook is triggered:
 * - **Password signup**: Immediately after user is created, before email/phone verification challenges
 * - **Social signup**: Immediately after user is created (for both web redirect and native mobile flows)
 * - **Admin signup**: Immediately after user is created (both `adminSignup` and `adminSignupSocial`)
 *
 * The hook is non-blocking. If it throws an error, the error is logged but signup continues.
 * The user account has already been created when the hook is called.
 *
 * @example NestJS implementation
 * ```typescript
 * @Injectable()
 * export class WelcomeEmailAfterSignupHook implements IAfterSignupHookProvider {
 *   constructor(
 *     private readonly emailService: EmailService,
 *     private readonly logger: Logger,
 *   ) {}
 *
 *   async execute(user: unknown, metadata?: SignupMetadata): Promise<void> {
 *     try {
 *       await this.emailService.sendWelcomeEmail(
 *         (user as any).email,
 *         {
 *           signupType: metadata?.signupType,
 *           provider: metadata?.provider,
 *         },
 *       );
 *     } catch (error) {
 *       this.logger.error(`Failed to send welcome email: ${error}`);
 *     }
 *   }
 * }
 * ```
 *
 * @example Express implementation
 * ```typescript
 * class WelcomeEmailAfterSignupHook implements IAfterSignupHookProvider {
 *   constructor(private emailService: EmailService) {}
 *
 *   async execute(user: unknown, metadata?: SignupMetadata): Promise<void> {
 *     try {
 *       await this.emailService.sendWelcomeEmail(
 *         (user as any).email,
 *         {
 *           signupType: metadata?.signupType,
 *           provider: metadata?.provider,
 *         },
 *       );
 *     } catch (error) {
 *       console.error('Failed to send welcome email:', error);
 *     }
 *   }
 * }
 *
 * // Register after NAuth initialization
 * const welcomeHook = new WelcomeEmailAfterSignupHook(emailService);
 * nauth.hookRegistry.registerAfterSignup(welcomeHook);
 * ```
 */
export interface IAfterSignupHookProvider {
  /**
   * Execute post-signup actions
   *
   * @param user - Created user entity (framework-agnostic: TypeORM/Prisma/Mongoose/etc.)
   * @param metadata - Signup metadata
   */
  execute(user: unknown, metadata?: SignupMetadata): Promise<void>;
}

/**
 * Signup metadata passed to afterSignup hook
 *
 * Provides context about the signup event.
 */
export interface SignupMetadata {
  /**
   * Whether user needs to complete verification challenges
   */
  requiresVerification?: boolean;

  /**
   * Type of signup
   */
  signupType?: 'password' | 'social';

  /**
   * Social provider name (only present for social signups)
   *
   * @example 'google' | 'apple' | 'facebook'
   */
  provider?: string;

  /**
   * Whether this is an admin-initiated signup
   *
   * @remarks
   * true for adminSignup() and adminSignupSocial() methods
   * false (or undefined) for regular user signups
   */
  adminSignup?: boolean;
}
