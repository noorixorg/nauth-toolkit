import { FastifyInstance } from 'fastify';
import { NAuthInstance } from '@nauth-toolkit/core';
import { IUser, UserResponseDTO } from '@nauth-toolkit/core';

type FastifyPreHandler = (request: unknown, reply: unknown) => Promise<void>;
type TypedNAuth = NAuthInstance<FastifyPreHandler, FastifyPreHandler>;

/**
 * Auth Routes
 *
 * Mirrors Express createAuthRoutes. Mount at /auth.
 */
export async function registerAuthRoutes(fastify: FastifyInstance, nauth: TypedNAuth): Promise<void> {
  const { authService, adminAuthService, mfaService: mfaService_, socialAuthService: socialAuthService_ } = nauth;
  const mfaService = mfaService_!;
  const socialAuthService = socialAuthService_!;

  // ── Account Recovery ────────────────────────────────────────────────────────

  fastify.post(
    '/auth/forgot-password',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.forgotPassword({ ...(req.body as object), baseUrl: 'https://localhost:4200' } as any));
    }) as any
  );

  fastify.post(
    '/auth/forgot-password/confirm',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.confirmForgotPassword(req.body as any));
    }) as any
  );

  // ── Primary Auth Flow ────────────────────────────────────────────────────────

  fastify.post(
    '/auth/signup',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await authService.signup(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/login',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.login(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/respond-challenge',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.respondToChallenge(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/refresh',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const token = (req.body as { refreshToken?: string })?.refreshToken?.trim() || req.cookies?.['nauth_refresh_token'];
      res.json(await authService.refreshToken({ refreshToken: token }));
    }) as any
  );

  // ── Logout ───────────────────────────────────────────────────────────────────

  fastify.get(
    '/auth/logout',
    { preHandler: [nauth.helpers.requireAuth({ csrf: false })] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.logout(req.query as any));
    }) as any
  );

  fastify.post(
    '/auth/logout/all',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.logoutAll(req.body as any));
    }) as any
  );

  // ── Sessions ─────────────────────────────────────────────────────────────────

  fastify.get(
    '/auth/sessions',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await authService.getUserSessions());
    }) as any
  );

  fastify.delete(
    '/auth/sessions/:sessionId',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.logoutSession(req.params as any));
    }) as any
  );

  // ── Trusted Devices ──────────────────────────────────────────────────────────

  fastify.post(
    '/auth/trust-device',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await authService.trustDevice());
    }) as any
  );

  fastify.get(
    '/auth/is-trusted-device',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await authService.isTrustedDevice());
    }) as any
  );

  // ── Challenge Helpers ─────────────────────────────────────────────────────────

  fastify.post(
    '/auth/challenge/setup-data',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.getSetupData(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/challenge/challenge-data',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.getChallengeData(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/challenge/resend',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.resendCode(req.body as any));
    }) as any
  );

  // ── User Profile ─────────────────────────────────────────────────────────────

  fastify.get(
    '/auth/profile',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      const user = nauth.helpers.getCurrentUser() as IUser;
      res.json(UserResponseDTO.fromEntity(user));
    }) as any
  );

  fastify.put(
    '/auth/profile',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.updateUserAttributes(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/change-password',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.changePassword(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/reset-password/confirm',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.confirmResetPassword(req.body as any));
    }) as any
  );

  // ── MFA Management ───────────────────────────────────────────────────────────

  fastify.get(
    '/auth/mfa/status',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await mfaService.getMfaStatus());
    }) as any
  );

  fastify.post(
    '/auth/mfa/setup-data',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.setup(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/mfa/verify-setup',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const body = req.body as any;
      const provider = mfaService.getProvider(body.methodName);
      const deviceId = await provider.verifySetup(body.setupData);
      res.json({ deviceId });
    }) as any
  );

  fastify.get(
    '/auth/mfa/devices',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await mfaService.getUserDevices({}));
    }) as any
  );

  fastify.post(
    '/auth/mfa/devices/:deviceId/preferred',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.setPreferredDevice(req.params as any));
    }) as any
  );

  fastify.delete(
    '/auth/mfa/devices/:deviceId',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.removeDevice(req.params as any));
    }) as any
  );

  // ── Social Account Linking ─────────────────────────────────────────────────────

  fastify.get(
    '/auth/social/linked',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await socialAuthService.getLinkedAccounts({}));
    }) as any
  );

  fastify.post(
    '/auth/social/link',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await socialAuthService.linkSocialAccount(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/social/unlink',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await socialAuthService.unlinkSocialAccount(req.body as any));
    }) as any
  );

  // ── Audit History ─────────────────────────────────────────────────────────────

  fastify.get(
    '/auth/audit/history',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.getUserAuthHistory(req.query as any));
    }) as any
  );

  // ── Admin Endpoints ───────────────────────────────────────────────────────────

  fastify.post(
    '/auth/admin/signup',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await adminAuthService.signup(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/signup-social',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await adminAuthService.signupSocial(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/set-password',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.setPassword(req.body as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/reset-password/initiate',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.resetPassword(req.body as any));
    }) as any
  );

  fastify.get(
    '/auth/admin/users',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.getUsers(req.query as any));
    }) as any
  );

  fastify.get(
    '/auth/admin/users/:sub',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.getUserById(req.params as any));
    }) as any
  );

  fastify.delete(
    '/auth/admin/users/:sub',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.deleteUser(req.params as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/users/:sub/disable',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.disableUser({ ...req.params, reason: (req.body as any)?.reason } as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/users/:sub/enable',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.enableUser(req.params as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/users/:sub/force-password-change',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.setMustChangePassword(req.params as any));
    }) as any
  );

  fastify.get(
    '/auth/admin/users/:sub/sessions',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.getUserSessions(req.params as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/users/:sub/logout-all',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.logoutAll({ sub: req.params.sub, forgetDevices: (req.body as any)?.forgetDevices } as any));
    }) as any
  );

  // ── Admin MFA ─────────────────────────────────────────────────────────────────

  fastify.get(
    '/auth/admin/users/:sub/mfa/status',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminGetMfaStatus(req.params as any));
    }) as any
  );

  fastify.get(
    '/auth/admin/users/:sub/mfa/devices',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminGetUserDevices(req.params as any));
    }) as any
  );

  fastify.delete(
    '/auth/admin/mfa/devices/:deviceId',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminRemoveDevice(req.params as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/users/:sub/mfa/devices/:deviceId/preferred',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminSetPreferredDevice(req.params as any));
    }) as any
  );

  fastify.post(
    '/auth/admin/mfa/exemption',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const dto = { ...(req.body as object), grantedBy: (req.body as any).grantedBy ?? nauth.helpers.getCurrentUser()?.sub ?? null };
      res.json(await mfaService.setMFAExemption(dto as any));
    }) as any
  );

  fastify.get(
    '/auth/admin/audit/history',
    { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await nauth.auditService!.getUserAuthHistory(req.query as any));
    }) as any
  );
}

/**
 * Mobile Auth Routes
 *
 * Mirrors Express createMobileAuthRoutes. Mount at /mobile/auth.
 */
export async function registerMobileAuthRoutes(fastify: FastifyInstance, nauth: TypedNAuth): Promise<void> {
  const { authService } = nauth;

  fastify.post(
    '/mobile/auth/signup',
    { preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await authService.signup(req.body as any));
    }) as any
  );

  fastify.post(
    '/mobile/auth/login',
    { preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.login(req.body as any));
    }) as any
  );

  fastify.post(
    '/mobile/auth/refresh',
    { preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.refreshToken(req.body as any));
    }) as any
  );

  fastify.get(
    '/mobile/auth/logout',
    { preHandler: [nauth.helpers.requireAuth({ csrf: false }), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await authService.logout(req.query as any));
    }) as any
  );
}
