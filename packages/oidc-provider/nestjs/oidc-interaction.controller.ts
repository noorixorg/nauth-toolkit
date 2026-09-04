import { Body, Controller, Get, Inject, Post, Req, Res, Type, UseGuards } from '@nestjs/common';
import { AuthGuard, Public } from '@nauth-toolkit/nestjs';
import { NAUTH_OIDC_BRIDGE } from './tokens';
import type { OIDCInteractionBridge, InteractionStateDTO, InteractionRedirectDTO } from '../src/interaction-bridge';

/** The path the interaction routes are served under when nothing else is asked for. */
export const DEFAULT_INTERACTION_PATH = 'oidc/interaction';

/** What the consent screen sends when the user decides. */
export interface OIDCConsentBody {
  /** Whether the user approved. Anything but an explicit `false` is an approval. */
  approve?: boolean;
  /** A narrowed set of scopes to grant. Omit to grant everything that was asked for. */
  scopes?: string[];
}

/**
 * Build the controller that bridges the OpenID Connect provider and nauth's login.
 *
 * These four routes are the same in every deployment, so the package ships them rather
 * than leaving each consumer to write them. They are ordinary nauth routes — full
 * request context, full guard chain — unlike the provider's own endpoints, which own
 * raw HTTP under the provider's own path prefix. The split is deliberate: the
 * provider needs no nauth context, and these need all of it.
 *
 * Every route answers with a `redirectTo` as JSON rather than issuing a 302, so a
 * single-page app can drive the flow with `fetch` and navigate itself.
 *
 * A factory rather than an exported class because Nest's `@Controller` decorator is
 * static: taking the path as an argument is the only way to let a consumer mount these
 * somewhere other than the default. `OIDCProviderModule.forRoot()` calls this for you;
 * call it directly only if you are registering the controller in your own module.
 *
 * @param path - Path to serve the routes under, relative to any global prefix
 * @returns A Nest controller class, ready to list in a module's `controllers`
 *
 * @example
 * ```typescript
 * @Module({
 *   controllers: [createOIDCInteractionController('identity/interaction')],
 * })
 * export class MyOIDCModule {}
 * ```
 */
export function createOIDCInteractionController(path: string = DEFAULT_INTERACTION_PATH): Type<unknown> {
  // AuthGuard is applied at the controller level, and every route is also @Public().
  //
  // That combination is deliberate: in this toolkit AuthGuard is not a global guard, so
  // without it `CURRENT_USER` is never populated and the session gate would report
  // `no_session` for everyone, forever. @Public() then makes the guard *optional* — it
  // attaches the user when a valid session is present and never rejects — which is
  // exactly what these routes need, since an anonymous caller is the case that has to
  // work in order to send someone to the login page.
  @UseGuards(AuthGuard)
  @Controller(path)
  class OIDCInteractionController {
    constructor(@Inject(NAUTH_OIDC_BRIDGE) private readonly bridge: OIDCInteractionBridge) {}

    /**
     * Describe a pending interaction so the frontend can decide what to render.
     *
     * Public on purpose: a signed-out caller is exactly the case the frontend needs an
     * answer for.
     *
     * @param req - The incoming request
     * @param res - The outgoing response, in passthrough mode
     * @returns What the interaction needs, and nauth's verdict on the caller's session
     */
    @Public()
    @Get(':uid')
    async state(@Req() req: unknown, @Res({ passthrough: true }) res: unknown): Promise<InteractionStateDTO> {
      return this.bridge.getState(req, res);
    }

    /**
     * Complete the login step for the currently authenticated user.
     *
     * @param req - The incoming request
     * @param res - The outgoing response, in passthrough mode
     * @returns Where to send the browser to resume the authorization request
     */
    @Public()
    @Post(':uid/login')
    async login(@Req() req: unknown, @Res({ passthrough: true }) res: unknown): Promise<InteractionRedirectDTO> {
      return this.bridge.completeLogin(req, res);
    }

    /**
     * Record the user's consent decision.
     *
     * @param body - Whether the user approved, and optionally a narrowed scope set
     * @param req - The incoming request
     * @param res - The outgoing response, in passthrough mode
     * @returns Where to send the browser next
     */
    @Public()
    @Post(':uid/confirm')
    async confirm(
      @Body() body: OIDCConsentBody,
      @Req() req: unknown,
      @Res({ passthrough: true }) res: unknown,
    ): Promise<InteractionRedirectDTO> {
      return this.bridge.completeConsent(req, res, {
        approve: body?.approve !== false,
        scopes: body?.scopes,
      });
    }

    /**
     * Abandon a pending interaction, so the relying party gets a clean protocol error.
     *
     * @param req - The incoming request
     * @param res - The outgoing response, in passthrough mode
     * @returns Where to send the browser
     */
    @Public()
    @Post(':uid/abort')
    async abort(@Req() req: unknown, @Res({ passthrough: true }) res: unknown): Promise<InteractionRedirectDTO> {
      return this.bridge.abort(req, res);
    }
  }

  return OIDCInteractionController;
}
