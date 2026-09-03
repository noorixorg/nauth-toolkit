import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';
import {
  NAUTH_OIDC_BRIDGE,
  type OIDCInteractionBridge,
  type InteractionStateDTO,
  type InteractionRedirectDTO,
} from '@nauth-toolkit/oidc-provider/nestjs';

/**
 * The bridge between the OpenID Connect provider and nauth's login.
 *
 * These are ordinary nauth routes — they run inside the guard chain and the request
 * context, unlike the provider's own endpoints, which own raw HTTP under `/oidc`. The
 * split is deliberate: the provider needs no nauth context, and these need all of it.
 *
 * Every route returns a `redirectTo` as JSON rather than a 302, so the single-page app
 * can drive the flow with `fetch` and navigate itself.
 */
@Controller('oidc/interaction')
export class OIDCInteractionController {
  constructor(@Inject(NAUTH_OIDC_BRIDGE) private readonly bridge: OIDCInteractionBridge) {}

  /**
   * Describe a pending interaction.
   *
   * Public on purpose: a signed-out caller is exactly the case the frontend needs an
   * answer for. `AuthGuard` still attaches the user when a valid session cookie is
   * present, so the session gate can report `authenticated`.
   */
  @Public()
  @Get(':uid')
  async state(
    @Param('uid') uid: string,
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<InteractionStateDTO> {
    void uid;
    return this.bridge.getState(req, res);
  }

  /**
   * Complete the login step for the currently authenticated user.
   */
  @Public()
  @Post(':uid/login')
  async login(
    @Param('uid') uid: string,
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<InteractionRedirectDTO> {
    void uid;
    return this.bridge.completeLogin(req, res);
  }

  /**
   * Record the user's consent decision.
   */
  @Public()
  @Post(':uid/confirm')
  async confirm(
    @Param('uid') uid: string,
    @Body() body: { approve?: boolean; scopes?: string[] },
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<InteractionRedirectDTO> {
    void uid;
    return this.bridge.completeConsent(req, res, {
      approve: body?.approve !== false,
      scopes: body?.scopes,
    });
  }

  /**
   * Abandon a pending interaction, so the relying party gets a clean protocol error.
   */
  @Public()
  @Post(':uid/abort')
  async abort(
    @Param('uid') uid: string,
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<InteractionRedirectDTO> {
    void uid;
    return this.bridge.abort(req, res);
  }
}
