import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  NAuthInstance,
  LogoutDTO,
  LogoutAllDTO,
  RefreshTokenDTO,
  ResendCodeDTO,
  RespondChallengeDTO,
  SetMustChangePasswordDTO,
  LinkSocialAccountDTO,
  GetLinkedAccountsDTO,
  UnlinkSocialAccountDTO,
  GetMFAStatusResponseDTO,
  IUser,
  IMFADevice,
} from '@nauth-toolkit/core';

/**
 * Create Auth Routes for Fastify
 *
 * Registers all authentication endpoints.
 * Adapts NAuth services to Fastify route handlers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAuthRoutes(fastify: FastifyInstance, nauth: NAuthInstance<any, any>) {
  const {
    authService,
    socialAuthService,
    passwordService,
    emailVerificationService,
    phoneVerificationService,
    mfaService,
    clientInfoService,
  } = nauth;

  // Helper to wrap async handlers and catch errors
  // Wrap handlers to ensure ContextStorage is available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (fn: (req: any, reply: any) => Promise<any>): any => {
    return nauth.adapter.wrapRouteHandler(async (nauthReq, nauthRes) => {
      // Prefer the platform-agnostic wrappers, but keep access to Fastify objects when needed.
      const req = nauthReq.raw as FastifyRequest;
      const reply = nauthRes.raw as FastifyReply;
      try {
        const result = await fn(req, reply);
        if (result !== undefined) {
          // If handler returns result, send it. If it calls reply.send(), it returns undefined or response object.
          return result;
        }
      } catch (error) {
        // Pass to Fastify error handler
        throw error;
      }
    });
  };

  // ============================================================================
  // Public Routes
  // ============================================================================

  // Signup
  fastify.post(
    '/signup',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const dto = req.body as any;
      const result = await authService.signup(dto);
      // Set status code before returning (Fastify preserves it through onSend hook)
      reply.code(201);
      return result;
    }),
  );

  // Login
  fastify.post(
    '/login',
    {
      preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('cookies')],
    },
    handler(async (req, reply) => {
      // NAuth expects a LoginDTO-like object or just plain object
      const result = await authService.login(req.body as any);
      return result; // TokenDeliveryInterceptor will handle tokens if configured
    }),
  );

  // Logout
  // Uses GET request to avoid CSRF token issues
  fastify.get(
    '/logout',
    {
      preHandler: nauth.helpers.requireAuth({ csrf: false }), // Explicitly disable CSRF for logout (session destruction)
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      // Session ID is automatically extracted from JWT token context by the library
      const dto = new LogoutDTO();
      const forgetMe = (req.query as any)?.forgetMe;
      if (forgetMe === 'true' || forgetMe === '1') {
        dto.forgetMe = true;
      }
      // Optional: validate user sub matches authenticated user
      // requireAuth guarantees user exists, so use non-null assertion like Express
      dto.sub = user!.sub;

      // AuthService handles cookie clearing via ContextStorage -> ClientInfoService -> HTTP_RESPONSE
      await authService.logout(dto);

      reply.code(200); // Match Express status code
      return { message: 'Logged out successfully' };
    }),
  );

  // ... other routes would follow similar pattern ...
  // For POC, login/signup/logout/me is enough.

  // Get Current User (Me)
  fastify.get(
    '/me',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      return user;
    }),
  );

  // Get User Profile (alias for me, matching Express sample)
  fastify.get(
    '/profile',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      return user;
    }),
  );

  // MFA Challenge Setup Data
  fastify.post(
    '/challenge/setup-data',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const { session, method } = req.body as any;

      if (!session || !method) {
        return reply.code(400).send({ error: 'Session and method are required' });
      }

      if (!mfaService) {
        return reply.code(400).send({ error: 'MFA service is not available' });
      }

      const result = await mfaService.getSetupData({ session, method });
      return result;
    }),
  );

  // MFA Challenge Data
  fastify.post(
    '/challenge/challenge-data',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const { session, method } = req.body as any;

      if (!session || !method) {
        return reply.code(400).send({ error: 'Session and method are required' });
      }

      if (!mfaService) {
        return reply.code(400).send({ error: 'MFA service is not available' });
      }

      const result = await mfaService.getChallengeData({ session, method });
      return result;
    }),
  );

  // Resend Code
  fastify.post(
    '/challenge/resend',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const { session } = req.body as any;

      if (!session) {
        reply.code(400);
        return { error: 'Session is required' };
      }

      const dto = new ResendCodeDTO();
      dto.session = session;
      const result = await authService.resendCode(dto);
      return result;
    }),
  );

  // Respond Challenge
  fastify.post(
    '/respond-challenge',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const dto = req.body as RespondChallengeDTO;
      const result = await authService.respondToChallenge(dto);
      return result;
    }),
  );

  // Refresh Token
  fastify.post(
    '/refresh',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      // Try body first (if provided and not empty), then cookies
      const token =
        (req.body as any)?.refreshToken && (req.body as any).refreshToken.trim() !== ''
          ? (req.body as any).refreshToken
          : (req.cookies as any)?.['nauth_refresh_token'];

      if (!token) {
        reply.code(400);
        return { error: 'Refresh token is required' };
      }

      const dto = new RefreshTokenDTO();
      dto.refreshToken = token;
      const result = await authService.refreshToken(dto);
      return result;
    }),
  );

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * POST /auth/logout/all
   *
   * Global signout (revoke all sessions)
   * Requires authentication - user must be logged in.
   * Optionally revokes all trusted devices if forgetDevices flag is set in request body.
   *
   * @body { forgetDevices?: boolean } - Optional flag to also revoke all trusted devices
   */
  fastify.post(
    '/logout/all',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      const dto = new LogoutAllDTO();
      dto.sub = user!.sub;
      if ((req.body as { forgetDevices?: boolean })?.forgetDevices !== undefined) {
        dto.forgetDevices = (req.body as { forgetDevices?: boolean }).forgetDevices;
      }
      const result = await authService.logoutAll(dto);

      const message = dto.forgetDevices
        ? `All sessions and trusted devices revoked successfully (${result.revokedCount} session(s))`
        : `All sessions revoked successfully (${result.revokedCount} session(s))`;

      return {
        message,
        revokedCount: result.revokedCount,
      };
    }),
  );

  // Trust Device
  fastify.post(
    '/trust-device',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      // Session ID is automatically extracted from JWT token context by the library
      const result = await authService.trustDevice();
      return result;
    }),
  );

  // ============================================================================
  // User Profile
  // ============================================================================

  // Request Password Change
  fastify.post(
    '/request-password-change',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      const dto = new SetMustChangePasswordDTO();
      dto.userId = user!.sub;
      await authService.setMustChangePassword(dto);

      return { message: 'You will be required to change your password on your next login' };
    }),
  );

  // Change Password
  fastify.post(
    '/password/change',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      await authService.changePassword({ sub: user!.sub, ...(req.body as any) });
      return { message: 'Password changed successfully' };
    }),
  );

  // ============================================================================
  // MFA Management Endpoints
  // ============================================================================

  // Get MFA Status
  fastify.get(
    '/mfa/status',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!mfaService) {
        reply.code(400);
        return { error: 'MFA service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const status = await (mfaService as unknown as { getMfaStatus(): Promise<GetMFAStatusResponseDTO> }).getMfaStatus();

      return {
        enabled: status.enabled,
        required: status.required,
        methods: status.configuredMethods,
        availableMethods: status.availableMethods,
        hasBackupCodes: status.hasBackupCodes,
        preferredMethod: status.preferredMethod,
        mfaExempt: status.mfaExempt,
        mfaExemptReason: status.mfaExemptReason,
        mfaExemptGrantedAt: status.mfaExemptGrantedAt,
      };
    }),
  );

  // Get MFA Setup Data (protected)
  fastify.post(
    '/mfa/setup-data',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!mfaService) {
        reply.code(400);
        return { error: 'MFA service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const provider = mfaService.getProvider((req.body as any).method);
      const result = await provider.setup(user!);

      return result;
    }),
  );

  // Verify MFA Setup (protected)
  fastify.post(
    '/mfa/verify-setup',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!mfaService) {
        reply.code(400);
        return { error: 'MFA service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const { method, setupData, deviceName } = req.body as any;

      const provider = mfaService.getProvider(method);
      const result = await provider.verifySetup(user!, setupData, deviceName);

      return result;
    }),
  );

  // Get MFA Devices
  fastify.get(
    '/mfa/devices',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!mfaService) {
        reply.code(400);
        return { error: 'MFA service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const devicesResponse = await mfaService.getUserDevices({});
      const result = devicesResponse.devices.map((device) => ({
        id: device.id,
        type: device.type,
        name: device.name,
        isPreferred: device.isPreferred,
        isActive: device.isActive,
        createdAt: device.createdAt,
      }));

      return result;
    }),
  );

  // Set Preferred MFA Method
  fastify.post(
    '/mfa/preferred-method',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!mfaService) {
        reply.code(400);
        return { error: 'MFA service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      await mfaService.setPreferredMethod({ userSub: user!.sub, methodType: (req.body as any).method });

      return { message: 'Preferred MFA method updated successfully' };
    }),
  );

  // MFA Exemption
  fastify.post(
    '/mfa/exemption',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const user = nauth.helpers.getCurrentUser();
      const { exempt, reason } = req.body as any;

      if (!mfaService) {
        reply.code(400);
        return { error: 'MFA service is not available' };
      }

      await mfaService.setMFAExemption({
        userSub: user!.sub,
        exempt,
        reason: reason || undefined,
        grantedBy: user!.email || undefined,
      });

      const status = await (mfaService as unknown as { getMfaStatus(): Promise<GetMFAStatusResponseDTO> }).getMfaStatus();

      return {
        message: exempt ? 'MFA exemption granted successfully' : 'MFA exemption revoked successfully',
        mfaExempt: status.mfaExempt,
        mfaExemptReason: status.mfaExemptReason,
        mfaExemptGrantedAt: status.mfaExemptGrantedAt,
      };
    }),
  );

  // ============================================================================
  // Social Authentication Endpoints
  // ============================================================================

  // Get Social Auth URL
  fastify.post(
    '/social/auth-url',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const { provider, state } = (req.body as any) || {};
      if (!provider) {
        reply.code(400);
        return { error: 'provider is required' };
      }
      const auth = (nauth as any)[`${provider}Auth`];
      if (!auth) {
        reply.code(400);
        return { error: `Provider ${provider} is not configured` };
      }
      const url = await auth.getAuthUrl(state);
      return { url };
    }),
  );

  // Social Callback (GET - OAuth redirect)
  fastify.get(
    '/social/:provider/callback',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const { provider } = req.params as { provider: string };
      const { code, state } = req.query as { code?: string; state?: string };
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

      // Check if user is authenticated (linking scenario)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        // Authenticated user - redirect to frontend for linking
        const redirectUrl = `${frontendUrl}/auth/callback?provider=${provider}&code=${code}&state=${state}&action=link`;
        return reply.redirect(302, redirectUrl);
      }

      // Not authenticated - login flow
      const redirectUrl = `${frontendUrl}/auth/callback?provider=${provider}&code=${encodeURIComponent(code || '')}&state=${encodeURIComponent(state || '')}`;
      return reply.redirect(302, redirectUrl);
    }),
  );

  // Social Callback (POST)
  fastify.post(
    '/social/callback',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      const { provider, code, state } = (req.body as any) || {};
      if (!provider || !code || !state) {
        reply.code(400);
        return { error: 'provider, code, and state are required' };
      }
      const auth = (nauth as any)[`${provider}Auth`];
      if (!auth) {
        reply.code(400);
        return { error: `Provider ${provider} is not configured` };
      }
      const result = await auth.handleCallback({ code, state });
      return result;
    }),
  );

  // Google OAuth - Get Auth URL (legacy)
  fastify.get(
    '/social/google',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.googleAuth) {
        reply.code(404);
        return { error: 'Google OAuth not configured' };
      }
      const authUrl = await nauth.googleAuth.getAuthUrl();
      return { authUrl };
    }),
  );

  // Google OAuth - Callback (legacy)
  fastify.post(
    '/social/google/callback',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.googleAuth) {
        reply.code(404);
        return { error: 'Google OAuth not configured' };
      }
      const { code, state } = req.body as any;
      const result = await nauth.googleAuth.handleCallback({ code, state });
      return result;
    }),
  );

  // Google OAuth - Verify Token (Mobile)
  fastify.post(
    '/social/google/verify',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.googleAuth) {
        reply.code(404);
        return { error: 'Google OAuth not configured' };
      }
      const { idToken, accessToken } = req.body as any;
      const result = await nauth.googleAuth.verifyToken({ idToken, accessToken });
      return result;
    }),
  );

  // Apple Sign-In - Get Auth URL (legacy)
  fastify.get(
    '/social/apple',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.appleAuth) {
        reply.code(404);
        return { error: 'Apple Sign-In not configured' };
      }
      const authUrl = await nauth.appleAuth.getAuthUrl();
      return { authUrl };
    }),
  );

  // Apple Sign-In - Callback (legacy)
  fastify.post(
    '/social/apple/callback',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.appleAuth) {
        reply.code(404);
        return { error: 'Apple Sign-In not configured' };
      }
      const { code, state } = req.body as any;
      const result = await nauth.appleAuth.handleCallback({ code, state });
      return result;
    }),
  );

  // Facebook OAuth - Get Auth URL (legacy)
  fastify.get(
    '/social/facebook',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.facebookAuth) {
        reply.code(404);
        return { error: 'Facebook OAuth not configured' };
      }
      const authUrl = await nauth.facebookAuth.getAuthUrl();
      return { authUrl };
    }),
  );

  // Facebook OAuth - Callback (legacy)
  fastify.post(
    '/social/facebook/callback',
    {
      preHandler: nauth.helpers.public(),
    },
    handler(async (req, reply) => {
      if (!nauth.facebookAuth) {
        reply.code(404);
        return { error: 'Facebook OAuth not configured' };
      }
      const { code, state } = req.body as any;
      const result = await nauth.facebookAuth.handleCallback({ code, state });
      return result;
    }),
  );

  // ============================================================================
  // Social Account Management Endpoints
  // ============================================================================

  // Get Linked Social Accounts
  fastify.get(
    '/social/linked',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!socialAuthService) {
        reply.code(400);
        return { error: 'Social auth service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const dto = Object.assign(new GetLinkedAccountsDTO(), { userId: user!.sub });
      const accounts = await socialAuthService.getLinkedAccounts(dto);

      return {
        providers: accounts.accounts.map(
          (account: { provider: string; providerEmail?: string; linkedAt: Date; lastUsedAt?: Date }) =>
            account.provider,
        ),
      };
    }),
  );

  // Link Social Account
  fastify.post(
    '/social/link',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!socialAuthService) {
        reply.code(400);
        return { error: 'Social auth service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const dto = Object.assign(new LinkSocialAccountDTO(), {
        userId: user!.sub,
        ...(req.body as any),
      });

      const result = await socialAuthService.linkSocialAccount(dto);
      return result;
    }),
  );

  // Unlink Social Account
  fastify.post(
    '/social/unlink',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!socialAuthService) {
        reply.code(400);
        return { error: 'Social auth service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const dto = Object.assign(new UnlinkSocialAccountDTO(), {
        userId: user!.sub,
        provider: (req.body as any).provider,
      });
      await socialAuthService.unlinkSocialAccount(dto);

      return { message: 'Social account unlinked successfully' };
    }),
  );

  // ============================================================================
  // Audit Trail Endpoints
  // ============================================================================

  // Get Audit History
  fastify.get(
    '/audit/history',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      if (!nauth.auditService) {
        reply.code(400);
        return { error: 'Audit service is not available' };
      }

      const user = nauth.helpers.getCurrentUser();
      const { page, limit, startDate, endDate, eventTypes, eventStatus } = req.query as any;

      const history = await nauth.auditService.getUserAuthHistory({
        userSub: user!.sub,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        eventTypes: eventTypes ? (eventTypes.split(',') as any) : undefined,
        eventStatus: eventStatus ? (eventStatus.split(',') as any) : undefined,
      });

      return {
        data: history.data,
        total: history.total,
        page: history.page,
        limit: history.limit,
        totalPages: history.totalPages,
      };
    }),
  );

  // Trust Device (User Opt-In)
  fastify.post(
    '/trust-device',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const result = await authService.trustDevice();
      return result;
    }),
  );

  // Check if Device is Trusted
  fastify.get(
    '/is-trusted-device',
    {
      preHandler: nauth.helpers.requireAuth(),
    },
    handler(async (req, reply) => {
      const result = await authService.isTrustedDevice();
      return result;
    }),
  );
}
