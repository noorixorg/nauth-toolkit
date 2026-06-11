import { FastifyInstance } from 'fastify';
import { NAuthInstance, SocialRedirectHandler } from '@nauth-toolkit/core';

type FastifyPreHandler = (request: unknown, reply: unknown) => Promise<void>;
type TypedNAuth = NAuthInstance<FastifyPreHandler, FastifyPreHandler>;

/**
 * Social Auth Routes
 *
 * Mirrors Express createSocialRoutes. Mount at /auth/social (paths are full).
 */
export async function registerSocialRoutes(
  fastify: FastifyInstance,
  nauth: TypedNAuth,
  socialRedirect: SocialRedirectHandler,
): Promise<void> {
  // ── Native Mobile Token Verification ─────────────────────────────────────────

  fastify.post(
    '/auth/social/:provider/verify',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler( async (req, res) => {
      const body = req.body as { provider?: string };
      const params = req.params as { provider: string };
      const provider = body.provider ?? params.provider;

      if (provider === 'google') {
        if (!nauth.googleAuth) {
          res.status(400).json({ error: 'Google OAuth is not configured' });
          return;
        }
        res.json(await nauth.googleAuth.verifyToken(req.body as any));
        return;
      }

      res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }) as any
  );

  // ── Redirect-First Web OAuth Flow ─────────────────────────────────────────

  fastify.get(
    '/auth/social/:provider/redirect',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const params = req.params as { provider: string };
      const { url } = await socialRedirect.start(String(params.provider), req.query);
      (res.raw as { redirect: (url: string, code?: number) => void }).redirect(url, 302);
    }) as any
  );

  fastify.get(
    '/auth/social/:provider/callback',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const params = req.params as { provider: string };
      const { url } = await socialRedirect.callback(String(params.provider), req.query);
      (res.raw as { redirect: (url: string, code?: number) => void }).redirect(url, 302);
    }) as any
  );

  // Exchange exchangeToken -> tokens (JSON/hybrid mode)
  fastify.post(
    '/auth/social/exchange',
    { preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler( async (req, res) => {
      const body = req.body as { exchangeToken?: string };
      res.json(await socialRedirect.exchange(body.exchangeToken ?? ''));
    }) as any
  );

  // ── Mobile / JSON-Mode Variants ─────────────────────────────────────────────

  fastify.get(
    '/auth/social/:provider/redirect/mobile',
    { preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const params = req.params as { provider: string };
      const { url } = await socialRedirect.start(String(params.provider), req.query);
      (res.raw as { redirect: (url: string, code?: number) => void }).redirect(url, 302);
    }) as any
  );

  fastify.get(
    '/auth/social/:provider/callback/mobile',
    { preHandler: [nauth.helpers.public(), nauth.helpers.tokenDelivery('json')] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const params = req.params as { provider: string };
      const { url } = await socialRedirect.callback(String(params.provider), req.query);
      (res.raw as { redirect: (url: string, code?: number) => void }).redirect(url, 302);
    }) as any
  );

  // ── Legacy: Google-specific verify endpoint ─────────────────────────────────

  fastify.post(
    '/auth/social/google/verify',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler( async (req, res) => {
      if (!nauth.googleAuth) {
        res.status(400).json({ error: 'Google OAuth is not configured' });
        return;
      }
      res.json(await nauth.googleAuth.verifyToken(req.body as any));
    }) as any
  );
}
