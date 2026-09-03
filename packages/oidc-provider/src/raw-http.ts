import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Recover the Node request and response from whatever a framework handed us.
 *
 * `oidc-provider`'s interaction API takes raw Node objects. Express request and
 * response objects *are* `IncomingMessage`/`ServerResponse` subclasses, so they pass
 * through unchanged; Fastify wraps them, exposing the originals as `.raw`. nauth's own
 * `NAuthRequest.raw` / `NAuthResponse.raw` hold the *framework* object, so a value
 * taken from there unwraps correctly here too.
 *
 * @param req - An Express request, Fastify request, or `NAuthRequest.raw`
 * @param res - An Express response, Fastify reply, or `NAuthResponse.raw`
 * @returns The underlying Node request and response
 *
 * @example
 * ```typescript
 * const { req: rawReq, res: rawRes } = toRawHttp(nauthReq.raw, nauthRes.raw);
 * const details = await provider.interactionDetails(rawReq, rawRes);
 * ```
 */
export function toRawHttp(req: unknown, res: unknown): { req: IncomingMessage; res: ServerResponse } {
  const reqObj = req as Record<string, unknown>;
  const resObj = res as Record<string, unknown>;

  const rawReq = reqObj?.raw as Record<string, unknown> | undefined;
  const rawRes = resObj?.raw as Record<string, unknown> | undefined;

  return {
    req: (rawReq && typeof rawReq.headers === 'object' ? rawReq : reqObj) as unknown as IncomingMessage,
    res: (rawRes && typeof rawRes.setHeader === 'function' ? rawRes : resObj) as unknown as ServerResponse,
  };
}
