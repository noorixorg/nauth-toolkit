import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { NAuthInstance, ExpressMiddlewareType, SocialRedirectHandler } from '@nauth-toolkit/core';

/**
 * Social Auth Routes
 *
 * Mirrors NestJS SocialRedirectController.
 * Mount at /auth/social in index.ts:  app.use('/auth/social', createSocialRoutes(nauth, socialRedirect))
 *
 * Redirect flow:
 *   1. GET  /:provider/redirect          → start() → 302 to provider
 *   2. GET  /:provider/callback          → callback() → 302 to frontend
 *   3. POST /exchange { exchangeToken }  → exchange() → tokens in body/cookies
 *
 * Mobile variant routes append /mobile and force JSON delivery.
 */
export function createSocialRoutes(
  nauth: NAuthInstance<ExpressMiddlewareType, RequestHandler>,
  socialRedirect: SocialRedirectHandler,
): Router {
  const router = Router();

  // ── Native Mobile Token Verification ─────────────────────────────────────────
  // Used by Capacitor/React Native apps that receive tokens directly from native SDKs

  router.post('/:provider/verify', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = req.body.provider ?? req.params.provider;

      if (provider === 'google') {
        if (!nauth.googleAuth) return res.status(400).json({ error: 'Google OAuth is not configured' });
        return res.json(await nauth.googleAuth.verifyToken(req.body));
      }

      res.status(400).json({ error: `Unsupported provider: ${provider}` });
    } catch (err) { next(err); }
  });

  // ── Redirect-First Web OAuth Flow ─────────────────────────────────────────────

  router.get('/:provider/redirect', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = await socialRedirect.start(req.params.provider, req.query);
      res.redirect(url);
    } catch (err) { next(err); }
  });

  router.get('/:provider/callback', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = await socialRedirect.callback(req.params.provider, req.query);
      res.redirect(url);
    } catch (err) { next(err); }
  });

  // Exchange exchangeToken → tokens (JSON/hybrid mode)
  router.post('/exchange', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await socialRedirect.exchange(req.body.exchangeToken));
    } catch (err) { next(err); }
  });

  // ── Mobile / JSON-Mode Variants ───────────────────────────────────────────────

  router.get('/:provider/redirect/mobile', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = await socialRedirect.start(req.params.provider, req.query);
      res.redirect(url);
    } catch (err) { next(err); }
  });

  router.get('/:provider/callback/mobile', nauth.helpers.public(), nauth.helpers.tokenDelivery('json'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = await socialRedirect.callback(req.params.provider, req.query);
      res.redirect(url);
    } catch (err) { next(err); }
  });

  // ── Legacy: Google-specific verify endpoint ───────────────────────────────────

  router.post('/google/verify', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!nauth.googleAuth) return res.status(400).json({ error: 'Google OAuth is not configured' });
      res.json(await nauth.googleAuth.verifyToken(req.body));
    } catch (err) { next(err); }
  });

  return router;
}
