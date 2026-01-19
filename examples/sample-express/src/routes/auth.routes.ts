/**
 * Authentication Routes
 *
 * Defines all authentication-related endpoints.
 * Mirrors the NestJS sample app implementation exactly.
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { NAuthInstance, IMFADevice, ExpressMiddlewareType } from '@nauth-toolkit/core';
import {
  LogoutDTO,
  LogoutAllDTO,
  RefreshTokenDTO,
  ResendCodeDTO,
  RespondChallengeDTO,
  SetMustChangePasswordDTO,
  LinkSocialAccountDTO,
  GetLinkedAccountsDTO,
  UnlinkSocialAccountDTO,
} from '@nauth-toolkit/core';

/**
 * Create authentication routes
 *
 * @param nauth - NAuth Express instance
 * @returns Express router
 */
export function createAuthRoutes(nauth: NAuthInstance<ExpressMiddlewareType, RequestHandler>): Router {
  const router = Router();

  // ============================================================================
  // PRIMARY FLOW (5 endpoints)
  // ============================================================================

  /**
   * User signup
   *
   * Creates a new user account. May return a challenge if verification is required.
   * When recaptcha is enabled (RECAPTCHA_SECRET_KEY), tokens are validated per enforceFor.
   * To explicitly require reCAPTCHA: add nauth.helpers.requireRecaptcha() to the middleware chain.
   *
   * POST /auth/signup
   * Body: { email, password, recaptchaToken? }
   */
  router.post('/signup', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await nauth.authService.signup(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * User login
   *
   * Authenticates user with email/password. May return a challenge if verification/MFA is required.
   *
   * POST /auth/login
   * Body: { identifier, password }
   */
  router.post(
    '/login',
    nauth.helpers.public(),
    nauth.helpers.tokenDelivery('cookies'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await nauth.authService.login(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Mobile login (JSON token delivery).
   *
   * Example: nauth.helpers.skipRecaptcha() exempts this route from reCAPTCHA.
   * With enforceFor: ['cookies'], JSON is already exempt; skipRecaptcha makes it explicit.
   *
   * POST /auth/login/mobile
   * Body: { identifier, password }
   */
  router.post(
    '/login/mobile',
    nauth.helpers.public(),
    nauth.helpers.tokenDelivery('json'),
    // skipRecaptcha: part of nauth.helpers when using @nauth-toolkit/core with reCAPTCHA support
    (nauth.helpers as unknown as { skipRecaptcha: () => RequestHandler }).skipRecaptcha(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await nauth.authService.login(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Respond to authentication challenge (UNIFIED API)
   *
   * Single endpoint for completing ANY challenge type:
   * - VERIFY_EMAIL: Verify email with code
   * - VERIFY_PHONE: Collect phone or verify phone with code
   * - MFA_REQUIRED: Verify MFA (SMS/TOTP/Passkey/Backup)
   * - FORCE_CHANGE_PASSWORD: Change password
   * - MFA_SETUP_REQUIRED: Set up MFA device
   *
   * POST /auth/respond-challenge
   * Body: { session, type, ... }
   */
  router.post('/respond-challenge', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as RespondChallengeDTO;
      const result = await nauth.authService.respondToChallenge(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Refresh access token
   *
   * Issues a new access token using a valid refresh token.
   * Supports both body and cookie-based refresh tokens.
   *
   * POST /auth/refresh
   * Body: { refreshToken?: string } (optional if in cookie)
   */
  router.post('/refresh', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try body first (if provided and not empty), then cookies
      const token =
        req.body?.refreshToken && req.body.refreshToken.trim() !== ''
          ? req.body.refreshToken
          : req.cookies?.['nauth_refresh_token'];

      if (!token) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const dto = new RefreshTokenDTO();
      dto.refreshToken = token;
      const result = await nauth.authService.refreshToken(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * User logout
   *
   * Uses GET request to avoid CSRF token issues.
   * Invalidates the current session and clears auth cookies.
   * Cookies are automatically cleared by AuthService.logout()
   *
   * GET /auth/logout?forgetMe=true
   */
  router.get(
    '/logout',
    nauth.helpers.requireAuth({ csrf: false }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = nauth.helpers.getCurrentUser();
        // Session ID is automatically extracted from JWT token context by the library
        const dto = new LogoutDTO();
        const forgetMe = req.query.forgetMe;
        if (forgetMe === 'true' || forgetMe === '1') {
          dto.forgetMe = true;
        }
        // Optional: validate user sub matches authenticated user
        dto.sub = user!.sub;

        await nauth.authService.logout(dto);

        res.status(200).json({ message: 'Logged out successfully' });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Global signout (revoke all user sessions)
   *
   * Revokes all active sessions for the current user across all devices.
   *
   * POST /auth/logout/all
   */
  /**
   * POST /auth/logout/all
   *
   * Global signout (revoke all sessions)
   * Requires authentication - user must be logged in.
   * Optionally revokes all trusted devices if forgetDevices flag is set in request body.
   *
   * @body { forgetDevices?: boolean } - Optional flag to also revoke all trusted devices
   */
  router.post('/logout/all', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = nauth.helpers.getCurrentUser();
      const dto = new LogoutAllDTO();
      dto.sub = user!.sub;
      if (req.body?.forgetDevices !== undefined) {
        dto.forgetDevices = req.body.forgetDevices;
      }
      const result = await nauth.authService.logoutAll(dto);

      const message = dto.forgetDevices
        ? `All sessions and trusted devices revoked successfully (${result.revokedCount} session(s))`
        : `All sessions revoked successfully (${result.revokedCount} session(s))`;

      res.json({
        message,
        revokedCount: result.revokedCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Trust current device (user opt-in)
   *
   * Creates a trusted device token for the current session's device.
   * Only available when rememberDevices === 'user_opt_in'.
   *
   * POST /auth/trust-device
   */
  router.post('/trust-device', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Session ID is automatically extracted from JWT token context by the library
      const result = await nauth.authService.trustDevice();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Check if current device is trusted
   *
   * Returns whether the device associated with the current authenticated session
   * is trusted. Works for both cookies mode (reads from httpOnly cookie) and
   * JSON mode (reads from X-Device-Token header).
   *
   * GET /auth/is-trusted-device
   */
  router.get(
    '/is-trusted-device',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await nauth.authService.isTrustedDevice();
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // ============================================================================
  // HELPER ENDPOINTS (3 endpoints)
  // ============================================================================

  /**
   * Get MFA setup data during MFA_SETUP_REQUIRED challenge
   *
   * Returns provider-specific setup data:
   * - TOTP: QR code, secret, manual entry key
   * - SMS: Masked phone number
   * - Passkey: WebAuthn registration options
   *
   * POST /auth/challenge/setup-data
   * Body: { session, method }
   */
  router.post(
    '/challenge/setup-data',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { session, method } = req.body;

        if (!session || !method) {
          return res.status(400).json({ error: 'Session and method are required' });
        }

        if (!nauth.mfaService) {
          return res.status(400).json({ error: 'MFA service is not available' });
        }

        const result = await nauth.mfaService.getSetupData({ session, method });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Get MFA challenge data during MFA_REQUIRED challenge
   *
   * Currently only used for passkey authentication to get WebAuthn options.
   * SMS/TOTP codes are sent automatically when the challenge is created.
   *
   * POST /auth/challenge/challenge-data
   * Body: { session, method: 'passkey' }
   */
  router.post(
    '/challenge/challenge-data',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { session, method } = req.body;

        if (!session || !method) {
          return res.status(400).json({ error: 'Session and method are required' });
        }

        if (!nauth.mfaService) {
          return res.status(400).json({ error: 'MFA service is not available' });
        }

        const result = await nauth.mfaService.getChallengeData({ session, method });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Resend verification code for current challenge
   *
   * Determines challenge type from session and resends the appropriate code:
   * - VERIFY_EMAIL: Resends email verification code
   * - VERIFY_PHONE: Resends SMS verification code
   * - MFA_REQUIRED: Resends MFA code (for SMS MFA only)
   *
   * POST /auth/challenge/resend
   * Body: { session }
   */
  router.post('/challenge/resend', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({ error: 'Session is required' });
      }

      const dto = new ResendCodeDTO();
      dto.session = session;
      const result = await nauth.authService.resendCode(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // User Profile
  // ============================================================================

  /**
   * Get current user profile
   *
   * GET /auth/profile
   */
  router.get('/profile', nauth.helpers.requireAuth(), (req: Request, res: Response) => {
    const user = nauth.helpers.getCurrentUser();
    res.json(user!);
  });

  /**
   * Request password change on next login
   *
   * Sets the mustChangePassword flag for the current user.
   * User will be required to change their password on next login.
   *
   * POST /auth/request-password-change
   */
  router.post(
    '/request-password-change',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = nauth.helpers.getCurrentUser();
        const dto = new SetMustChangePasswordDTO();
        dto.userId = user!.sub;
        await nauth.authService.setMustChangePassword(dto);

        res.json({ message: 'You will be required to change your password on your next login' });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Change Password
   *
   * POST /auth/password/change
   * Body: { oldPassword, newPassword }
   */
  router.post(
    '/password/change',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = nauth.helpers.getCurrentUser();
        await nauth.authService.changePassword({ sub: user!.sub, ...req.body });
        res.json({ message: 'Password changed successfully' });
      } catch (error) {
        next(error);
      }
    },
  );

  // ============================================================================
  // MFA Management Endpoints
  // ============================================================================

  /**
   * Get MFA status for current user
   *
   * GET /auth/mfa/status
   */
  router.get('/mfa/status', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.mfaService) {
        return res.status(400).json({ error: 'MFA service is not available' });
      }

      const user = nauth.helpers.getCurrentUser();
      const status = await nauth.mfaService.getMfaStatus();

      res.json({
        enabled: status.enabled,
        required: status.required,
        methods: status.configuredMethods,
        availableMethods: status.availableMethods,
        hasBackupCodes: status.hasBackupCodes,
        preferredMethod: status.preferredMethod,
        mfaExempt: status.mfaExempt,
        mfaExemptReason: status.mfaExemptReason,
        mfaExemptGrantedAt: status.mfaExemptGrantedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get MFA setup data for authenticated user (protected endpoint)
   *
   * Used when authenticated users want to add MFA devices from dashboard.
   *
   * POST /auth/mfa/setup-data
   * Body: { method: 'sms' | 'email' | 'totp' | 'passkey' }
   */
  router.post(
    '/mfa/setup-data',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.mfaService) {
          return res.status(400).json({ error: 'MFA service is not available' });
        }

        const user = nauth.helpers.getCurrentUser();
        const provider = nauth.mfaService.getProvider(req.body.method);
        const result = await provider.setup(user!);

        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Verify and complete MFA setup for authenticated user (protected endpoint)
   *
   * POST /auth/mfa/verify-setup
   * Body: { method, setupData, deviceName? }
   */
  router.post(
    '/mfa/verify-setup',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.mfaService) {
          return res.status(400).json({ error: 'MFA service is not available' });
        }

        const user = nauth.helpers.getCurrentUser();
        const { method, setupData, deviceName } = req.body;

        const provider = nauth.mfaService.getProvider(method);
        const result = await provider.verifySetup(user!, setupData, deviceName);

        // result may include deviceId and backupCodes (for first MFA device)
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Get MFA devices for current user
   *
   * GET /auth/mfa/devices
   */
  router.get('/mfa/devices', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.mfaService) {
        return res.status(400).json({ error: 'MFA service is not available' });
      }

      const user = nauth.helpers.getCurrentUser();

      const devicesResponse = await nauth.mfaService.getUserDevices({ sub: user!.sub });
      const result = devicesResponse.devices.map((device: IMFADevice) => ({
        id: device.id,
        type: device.type,
        name: device.name,
        isPrimary: device.isPrimary || false,
        isActive: device.isActive,
        createdAt: device.createdAt,
      }));

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Set preferred MFA method
   *
   * POST /auth/mfa/preferred-method
   * Body: { method }
   */
  router.post(
    '/mfa/preferred-method',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.mfaService) {
          return res.status(400).json({ error: 'MFA service is not available' });
        }

        const user = nauth.helpers.getCurrentUser();
        await nauth.mfaService.setPreferredMethod({ userSub: user!.sub, methodType: req.body.method });

        res.json({ message: 'Preferred MFA method updated successfully' });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Grant or revoke MFA exemption for current user
   *
   * SECURITY NOTE: In production, this should be an admin-only operation.
   *
   * POST /auth/mfa/exemption
   * Body: { exempt: boolean, reason?: string }
   */
  router.post(
    '/mfa/exemption',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = nauth.helpers.getCurrentUser();
        const { exempt, reason } = req.body;

        // Get updated MFA status to return exemption fields
        if (!nauth.mfaService) {
          return res.status(400).json({ error: 'MFA service is not available' });
        }

        await nauth.mfaService.setMFAExemption({
          userSub: user!.sub,
          exempt,
          reason: reason || undefined,
          grantedBy: user!.email || undefined,
        });

        const status = await nauth.mfaService.getMfaStatus();

        res.json({
          message: exempt ? 'MFA exemption granted successfully' : 'MFA exemption revoked successfully',
          mfaExempt: status.mfaExempt,
          mfaExemptReason: status.mfaExemptReason,
          mfaExemptGrantedAt: status.mfaExemptGrantedAt,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ============================================================================
  // Social Authentication Endpoints
  // ============================================================================

  /**
   * Get social authentication URL
   *
   * Returns the OAuth authorization URL for the specified provider.
   *
   * POST /auth/social/auth-url
   * Body: { provider, state? }
   */
  router.post('/social/auth-url', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.socialAuthService) {
        return res.status(400).json({ error: 'Social auth service is not available' });
      }

      const dto = Object.assign(new GetSocialAuthUrlDTO(), req.body);
      const { url } = await nauth.socialAuthService.getSocialAuthUrl(dto);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Handle social authentication callback (GET - OAuth redirect)
   *
   * OAuth providers redirect to this endpoint with code and state in query params.
   * This endpoint then redirects to the frontend with the same parameters.
   *
   * GET /auth/social/:provider/callback
   */
  router.get(
    '/social/:provider/callback',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { provider } = req.params;
        const { code, state } = req.query;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

        // Check if user is authenticated (linking scenario)
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          // Authenticated user - redirect to frontend for linking
          const redirectUrl = `${frontendUrl}/auth/callback?provider=${provider}&code=${code}&state=${state}&action=link`;
          return res.redirect(302, redirectUrl);
        }

        // Not authenticated - login flow
        const redirectUrl = `${frontendUrl}/auth/callback?provider=${provider}&code=${encodeURIComponent(code as string)}&state=${encodeURIComponent(state as string)}`;
        res.redirect(302, redirectUrl);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Handle social authentication callback (POST)
   *
   * Processes the OAuth callback and authenticates the user.
   * Returns unified auth response (tokens or challenge).
   *
   * POST /auth/social/callback
   * Body: { provider, code, state }
   */
  router.post('/social/callback', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.socialAuthService) {
        return res.status(400).json({ error: 'Social auth service is not available' });
      }

      const dto = Object.assign(new HandleSocialCallbackDTO(), req.body);
      const result = await nauth.socialAuthService.handleSocialCallback(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Google OAuth - Get Authorization URL (legacy endpoint for backward compatibility)
   *
   * GET /auth/social/google
   */
  router.get('/social/google', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.googleAuth) {
        return res.status(404).json({ error: 'Google OAuth not configured' });
      }
      const authUrl = await nauth.googleAuth.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Google OAuth - Callback (legacy endpoint for backward compatibility)
   *
   * POST /auth/social/google/callback
   * Body: { code, state }
   */
  router.post(
    '/social/google/callback',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.googleAuth) {
          return res.status(404).json({ error: 'Google OAuth not configured' });
        }
        const { code, state } = req.body;
        const result = await nauth.googleAuth.handleCallback(code, state);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Google OAuth - Verify Token (Mobile)
   *
   * POST /auth/social/google/verify
   * Body: { idToken, accessToken? }
   */
  router.post(
    '/social/google/verify',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.googleAuth) {
          return res.status(404).json({ error: 'Google OAuth not configured' });
        }
        const { idToken, accessToken } = req.body;
        const result = await nauth.googleAuth.verifyToken(idToken, accessToken);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Apple Sign-In - Get Authorization URL (legacy endpoint for backward compatibility)
   *
   * GET /auth/social/apple
   */
  router.get('/social/apple', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.appleAuth) {
        return res.status(404).json({ error: 'Apple Sign-In not configured' });
      }
      const authUrl = await nauth.appleAuth.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Apple Sign-In - Callback (legacy endpoint for backward compatibility)
   *
   * POST /auth/social/apple/callback
   * Body: { code, state }
   */
  router.post(
    '/social/apple/callback',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.appleAuth) {
          return res.status(404).json({ error: 'Apple Sign-In not configured' });
        }
        const { code, state } = req.body;
        const result = await nauth.appleAuth.handleCallback(code, state);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Facebook OAuth - Get Authorization URL (legacy endpoint for backward compatibility)
   *
   * GET /auth/social/facebook
   */
  router.get('/social/facebook', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.facebookAuth) {
        return res.status(404).json({ error: 'Facebook OAuth not configured' });
      }
      const authUrl = await nauth.facebookAuth.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Facebook OAuth - Callback (legacy endpoint for backward compatibility)
   *
   * POST /auth/social/facebook/callback
   * Body: { code, state }
   */
  router.post(
    '/social/facebook/callback',
    nauth.helpers.public(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.facebookAuth) {
          return res.status(404).json({ error: 'Facebook OAuth not configured' });
        }
        const { code, state } = req.body;
        const result = await nauth.facebookAuth.handleCallback(code, state);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // ============================================================================
  // Social Account Management Endpoints
  // ============================================================================

  /**
   * Get linked social accounts for current user
   *
   * GET /auth/social/linked
   */
  router.get('/social/linked', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.socialAuthService) {
        return res.status(400).json({ error: 'Social auth service is not available' });
      }

      const user = nauth.helpers.getCurrentUser();
      const dto = Object.assign(new GetLinkedAccountsDTO(), { userId: user!.sub });
      const accounts = await nauth.socialAuthService.getLinkedAccounts(dto);

      res.json({
        providers: accounts.accounts.map(
          (account: { provider: string; providerEmail?: string; linkedAt: Date; lastUsedAt?: Date }) =>
            account.provider,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Link social account to current user
   *
   * POST /auth/social/link
   * Body: { provider, code, state }
   */
  router.post('/social/link', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.socialAuthService) {
        return res.status(400).json({ error: 'Social auth service is not available' });
      }

      const user = nauth.helpers.getCurrentUser();
      const dto = Object.assign(new LinkSocialAccountDTO(), {
        userId: user!.sub,
        ...req.body,
      });

      const result = await nauth.socialAuthService.linkSocialAccount(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Unlink social account from current user
   *
   * POST /auth/social/unlink
   * Body: { provider }
   */
  router.post(
    '/social/unlink',
    nauth.helpers.requireAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!nauth.socialAuthService) {
          return res.status(400).json({ error: 'Social auth service is not available' });
        }

        const user = nauth.helpers.getCurrentUser();
        const dto = Object.assign(new UnlinkSocialAccountDTO(), {
          userId: user!.sub,
          provider: req.body.provider,
        });
        await nauth.socialAuthService.unlinkSocialAccount(dto);

        res.json({ message: 'Social account unlinked successfully' });
      } catch (error) {
        next(error);
      }
    },
  );

  // ============================================================================
  // Audit Trail Endpoints
  // ============================================================================

  /**
   * Get authentication audit history for current user
   *
   * GET /auth/audit/history
   * Query: ?page=1&limit=50&startDate=...&endDate=...&eventTypes=...&eventStatus=...
   */
  router.get('/audit/history', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.auditService) {
        return res.status(400).json({ error: 'Audit service is not available' });
      }

      const user = nauth.helpers.getCurrentUser();
      const { page, limit, startDate, endDate, eventTypes, eventStatus } = req.query;

      const history = await nauth.auditService.getUserAuthHistory({
        userSub: user!.sub,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        eventTypes: eventTypes ? ((eventTypes as string).split(',') as any) : undefined,
        eventStatus: eventStatus ? ((eventStatus as string).split(',') as any) : undefined,
      });

      res.json({
        data: history.data,
        total: history.total,
        page: history.page,
        limit: history.limit,
        totalPages: history.totalPages,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
