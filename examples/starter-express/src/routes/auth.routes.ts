import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { NAuthInstance, ExpressMiddlewareType, IUser, UserResponseDTO } from '@nauth-toolkit/core';

/**
 * Auth Routes
 *
 * Mirrors NestJS CustomAuthController + MobileAuthController.
 * Mount at /auth in index.ts:       app.use('/auth', createAuthRoutes(nauth))
 * Mount at /mobile/auth in index.ts: app.use('/mobile/auth', createMobileAuthRoutes(nauth))
 */
export function createAuthRoutes(nauth: NAuthInstance<ExpressMiddlewareType, RequestHandler>): Router {
  const router = Router();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { authService, adminAuthService, mfaService: mfaService_, socialAuthService: socialAuthService_ } = nauth;
  const mfaService = mfaService_!;
  const socialAuthService = socialAuthService_!;

  // ── Account Recovery ────────────────────────────────────────────────────────

  router.post('/forgot-password', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // baseUrl used by toolkit to construct the reset link in the email
      res.json(await authService.forgotPassword({ ...req.body, baseUrl: 'https://localhost:4200' }));
    } catch (err) { next(err); }
  });

  router.post('/forgot-password/confirm', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.confirmForgotPassword(req.body));
    } catch (err) { next(err); }
  });

  // ── Primary Auth Flow ────────────────────────────────────────────────────────

  router.post('/signup', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await authService.signup(req.body));
    } catch (err) { next(err); }
  });

  router.post('/login', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.login(req.body));
    } catch (err) { next(err); }
  });

  router.post('/respond-challenge', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.respondToChallenge(req.body));
    } catch (err) { next(err); }
  });

  router.post('/refresh', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Cookies mode: fall back to cookie if body token is absent or empty
      const token = req.body?.refreshToken?.trim() || req.cookies?.['nauth_refresh_token'];
      res.json(await authService.refreshToken({ refreshToken: token }));
    } catch (err) { next(err); }
  });

  // ── Mobile Variants (JSON token delivery) ────────────────────────────────────

  router.post('/signup/mobile', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await authService.signup(req.body));
    } catch (err) { next(err); }
  });

  router.post('/login/mobile', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.login(req.body));
    } catch (err) { next(err); }
  });

  router.post('/respond-challenge/mobile', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.respondToChallenge(req.body));
    } catch (err) { next(err); }
  });

  router.post('/refresh/mobile', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.refreshToken(req.body));
    } catch (err) { next(err); }
  });

  // ── Logout ───────────────────────────────────────────────────────────────────
  // GET avoids CSRF issues for session destruction; csrf: false bypasses the CSRF check

  router.get('/logout', nauth.helpers.requireAuth({ csrf: false }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.logout(req.query));
    } catch (err) { next(err); }
  });

  router.get('/logout/mobile', nauth.helpers.requireAuth({ csrf: false }), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.logout(req.query));
    } catch (err) { next(err); }
  });

  router.post('/logout/all', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.logoutAll(req.body));
    } catch (err) { next(err); }
  });

  // ── Sessions ─────────────────────────────────────────────────────────────────

  router.get('/sessions', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.getUserSessions());
    } catch (err) { next(err); }
  });

  router.delete('/sessions/:sessionId', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.logoutSession(req.params as any));
    } catch (err) { next(err); }
  });

  // ── Trusted Devices ──────────────────────────────────────────────────────────

  router.post('/trust-device', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.trustDevice());
    } catch (err) { next(err); }
  });

  router.get('/is-trusted-device', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.isTrustedDevice());
    } catch (err) { next(err); }
  });

  // ── Challenge Helpers (used during login/signup flow) ────────────────────────

  router.post('/challenge/setup-data', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.getSetupData(req.body));
    } catch (err) { next(err); }
  });

  router.post('/challenge/challenge-data', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.getChallengeData(req.body));
    } catch (err) { next(err); }
  });

  router.post('/challenge/resend', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.resendCode(req.body));
    } catch (err) { next(err); }
  });

  // ── User Profile ─────────────────────────────────────────────────────────────

  router.get('/profile', nauth.helpers.requireAuth(), (_req: Request, res: Response, next: NextFunction) => {
    try {
      const user = nauth.helpers.getCurrentUser() as IUser;
      res.json(UserResponseDTO.fromEntity(user));
    } catch (err) { next(err); }
  });

  router.put('/profile', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.updateUserAttributes(req.body));
    } catch (err) { next(err); }
  });

  router.post('/change-password', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.changePassword(req.body));
    } catch (err) { next(err); }
  });

  router.post('/reset-password/confirm', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.confirmResetPassword(req.body));
    } catch (err) { next(err); }
  });

  // ── MFA Management ────────────────────────────────────────────────────────────

  router.get('/mfa/status', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.getMfaStatus());
    } catch (err) { next(err); }
  });

  router.post('/mfa/setup-data', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.setup(req.body));
    } catch (err) { next(err); }
  });

  router.post('/mfa/verify-setup', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = mfaService.getProvider(req.body.methodName);
      const deviceId = await provider.verifySetup(req.body.setupData);
      res.json({ deviceId });
    } catch (err) { next(err); }
  });

  router.get('/mfa/devices', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.getUserDevices({}));
    } catch (err) { next(err); }
  });

  router.post('/mfa/devices/:deviceId/preferred', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.setPreferredDevice(req.params as any));
    } catch (err) { next(err); }
  });

  router.delete('/mfa/devices/:deviceId', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.removeDevice(req.params as any));
    } catch (err) { next(err); }
  });

  // ── Social Account Linking ────────────────────────────────────────────────────

  router.get('/social/linked', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await socialAuthService.getLinkedAccounts({}));
    } catch (err) { next(err); }
  });

  router.post('/social/link', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await socialAuthService.linkSocialAccount(req.body));
    } catch (err) { next(err); }
  });

  router.post('/social/unlink', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await socialAuthService.unlinkSocialAccount(req.body));
    } catch (err) { next(err); }
  });

  // ── Audit History ─────────────────────────────────────────────────────────────

  router.get('/audit/history', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.getUserAuthHistory(req.query));
    } catch (err) { next(err); }
  });

  // ── Admin Endpoints ───────────────────────────────────────────────────────────
  // NOTE: nauth.helpers.requireAuth() validates a JWT is present (any authenticated user).
  // In production, add your own admin authorization on top of this.

  router.post('/admin/signup', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await adminAuthService.signup(req.body));
    } catch (err) { next(err); }
  });

  router.post('/admin/signup-social', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await adminAuthService.signupSocial(req.body));
    } catch (err) { next(err); }
  });

  router.post('/admin/set-password', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.setPassword(req.body));
    } catch (err) { next(err); }
  });

  router.post('/admin/reset-password/initiate', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.resetPassword(req.body));
    } catch (err) { next(err); }
  });

  router.get('/admin/users', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.getUsers(req.query));
    } catch (err) { next(err); }
  });

  router.get('/admin/users/:sub', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.getUserById(req.params as any));
    } catch (err) { next(err); }
  });

  router.delete('/admin/users/:sub', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.deleteUser(req.params as any));
    } catch (err) { next(err); }
  });

  router.post('/admin/users/:sub/disable', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.disableUser({ ...req.params, reason: req.body?.reason } as any));
    } catch (err) { next(err); }
  });

  router.post('/admin/users/:sub/enable', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.enableUser(req.params as any));
    } catch (err) { next(err); }
  });

  router.post('/admin/users/:sub/force-password-change', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.setMustChangePassword(req.params as any));
    } catch (err) { next(err); }
  });

  router.get('/admin/users/:sub/sessions', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.getUserSessions(req.params as any));
    } catch (err) { next(err); }
  });

  router.post('/admin/users/:sub/logout-all', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adminAuthService.logoutAll({ sub: req.params.sub, forgetDevices: req.body?.forgetDevices }));
    } catch (err) { next(err); }
  });

  // ── Admin MFA ─────────────────────────────────────────────────────────────────

  router.get('/admin/users/:sub/mfa/status', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.adminGetMfaStatus(req.params as any));
    } catch (err) { next(err); }
  });

  router.get('/admin/users/:sub/mfa/devices', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.adminGetUserDevices(req.params as any));
    } catch (err) { next(err); }
  });

  router.delete('/admin/mfa/devices/:deviceId', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.adminRemoveDevice(req.params as any));
    } catch (err) { next(err); }
  });

  router.post('/admin/users/:sub/mfa/devices/:deviceId/preferred', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mfaService.adminSetPreferredDevice(req.params as any));
    } catch (err) { next(err); }
  });

  router.post('/admin/mfa/exemption', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body };
      if (!dto.grantedBy) dto.grantedBy = nauth.helpers.getCurrentUser()?.sub ?? null;
      res.json(await mfaService.setMFAExemption(dto));
    } catch (err) { next(err); }
  });

  router.get('/admin/audit/history', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await nauth.auditService!.getUserAuthHistory(req.query as any));
    } catch (err) { next(err); }
  });

  return router;
}

/**
 * Mobile Auth Routes
 *
 * Mirrors NestJS MobileAuthController.
 * Mount at /mobile/auth in index.ts:  app.use('/mobile/auth', createMobileAuthRoutes(nauth))
 *
 * These endpoints always deliver tokens as JSON (for Capacitor / React Native clients).
 * Playwright's `json` E2E project expects: POST /mobile/auth/signup, /login, /refresh
 */
export function createMobileAuthRoutes(nauth: NAuthInstance<ExpressMiddlewareType, RequestHandler>): Router {
  const router = Router();
  const { authService } = nauth;

  router.post('/signup', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await authService.signup(req.body));
    } catch (err) { next(err); }
  });

  router.post('/login', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.login(req.body));
    } catch (err) { next(err); }
  });

  router.post('/refresh', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await authService.refreshToken(req.body));
    } catch (err) { next(err); }
  });

  return router;
}
