import type Provider from 'oidc-provider';
import type { IdpSessionGate } from '@nauth-toolkit/core/internal';
import { toRawHttp } from './raw-http';

/** What the consent screen needs in order to ask the user. */
export interface InteractionStateDTO {
  /** The pending interaction id. */
  uid: string;
  /** What the provider is asking for: a login, or consent for scopes. */
  prompt: 'login' | 'consent' | string;
  /** The client making the request, as the user should see it. */
  client: { clientId: string; clientName?: string; logoUri?: string; clientUri?: string };
  /** Scopes the client asked for. */
  scopes: string[];
  /** Scopes still needing consent — the rest are already granted. */
  missingScopes: string[];
  /** nauth's verdict on the current session. */
  gate: 'authenticated' | 'login_required' | 'denied';
  /** Why, when the gate is not `authenticated`. */
  gateReason?: string;
  /** External identifier of the signed-in user, when there is one. */
  sub?: string;
}

/** Where to send the browser after a decision. */
export interface InteractionRedirectDTO {
  /** Absolute URL to navigate to. */
  redirectTo: string;
}

/**
 * The bridge between `oidc-provider`'s interaction flow and nauth's identity.
 *
 * These are the only places the two systems meet at request level, and they are
 * deliberately *ordinary nauth routes* — full guards, full request context — rather
 * than anything mounted under the provider's prefix. They reach the provider through
 * raw Node request and response objects, which is precisely what `NAuthRequest.raw`
 * exists to expose.
 *
 * Every method returns a `redirectTo` as JSON rather than issuing a 302, so a
 * single-page app can drive the flow with `fetch` and navigate itself. That is
 * `interactionResult()` rather than `interactionFinished()`.
 */
export class OIDCInteractionBridge {
  constructor(
    private readonly provider: Provider,
    private readonly sessionGate: IdpSessionGate,
  ) {}

  /**
   * Describe a pending interaction so the frontend can decide what to render.
   *
   * Callable anonymously: the answer for a signed-out user is precisely what tells the
   * frontend to send them to login.
   *
   * @param req - The framework request
   * @param res - The framework response
   * @returns What the interaction needs, and whether nauth considers the caller signed in
   */
  async getState(req: unknown, res: unknown): Promise<InteractionStateDTO> {
    const raw = toRawHttp(req, res);
    const details = await this.provider.interactionDetails(raw.req, raw.res);
    const client = await this.provider.Client.find(details.params.client_id as string);

    const gate = await this.sessionGate.evaluate();
    const promptDetails = details.prompt.details as {
      missingOIDCScope?: string[];
      missingOIDCClaims?: string[];
    };

    const requested = String(details.params.scope ?? '')
      .split(/\s+/)
      .filter(Boolean);

    return {
      uid: details.uid,
      prompt: details.prompt.name,
      client: {
        clientId: String(details.params.client_id),
        clientName: client?.clientName as string | undefined,
        logoUri: client?.logoUri as string | undefined,
        clientUri: client?.clientUri as string | undefined,
      },
      scopes: requested,
      missingScopes: promptDetails.missingOIDCScope ?? [],
      gate: gate.status,
      gateReason: gate.status === 'authenticated' ? undefined : gate.reason,
      sub: gate.status === 'authenticated' ? gate.user.sub : undefined,
    };
  }

  /**
   * Complete the login step for the currently authenticated nauth user.
   *
   * The session gate runs again here, authoritatively. A valid access token only
   * proves the challenge flow completed *when it was issued*; the gate re-reads the
   * account so that a user disabled, locked, or newly required to change their
   * password in the meantime cannot have an id_token minted for a third party.
   *
   * A denied account resolves the interaction with `access_denied` rather than
   * throwing, so the relying party receives a proper protocol error instead of a dead
   * browser tab.
   *
   * @param req - The framework request
   * @param res - The framework response
   * @returns Where to send the browser to resume the authorization request
   * @throws {Error} When no completed nauth login stands behind the request
   */
  async completeLogin(req: unknown, res: unknown): Promise<InteractionRedirectDTO> {
    const raw = toRawHttp(req, res);
    const gate = await this.sessionGate.evaluate();

    if (gate.status === 'denied') {
      return {
        redirectTo: await this.provider.interactionResult(raw.req, raw.res, {
          error: 'access_denied',
          error_description: `Account unavailable (${gate.reason})`,
        }),
      };
    }

    if (gate.status !== 'authenticated') {
      throw new Error(`A completed login is required (${gate.reason})`);
    }

    const redirectTo = await this.provider.interactionResult(
      raw.req,
      raw.res,
      { login: { accountId: gate.user.sub, remember: true } },
      { mergeWithLastSubmission: false },
    );

    return { redirectTo };
  }

  /**
   * Record the user's consent decision.
   *
   * On approval this builds the provider's `Grant` — the durable record of what this
   * user let this client see — and resolves the interaction with its id. On refusal it
   * resolves with `access_denied`.
   *
   * @param req - The framework request
   * @param res - The framework response
   * @param decision - Whether the user approved, and optionally a narrowed scope set
   * @returns Where to send the browser next
   */
  async completeConsent(
    req: unknown,
    res: unknown,
    decision: { approve: boolean; scopes?: string[] },
  ): Promise<InteractionRedirectDTO> {
    const raw = toRawHttp(req, res);

    if (!decision.approve) {
      return {
        redirectTo: await this.provider.interactionResult(raw.req, raw.res, {
          error: 'access_denied',
          error_description: 'The user denied the request',
        }),
      };
    }

    const details = await this.provider.interactionDetails(raw.req, raw.res);
    const accountId = details.session?.accountId;
    if (!accountId) {
      throw new Error('Cannot record consent before a login has been established');
    }

    const promptDetails = details.prompt.details as {
      missingOIDCScope?: string[];
      missingOIDCClaims?: string[];
      missingResourceScopes?: Record<string, string[]>;
    };

    const grant = details.grantId
      ? await this.provider.Grant.find(details.grantId)
      : new this.provider.Grant({ accountId, clientId: String(details.params.client_id) });

    if (!grant) {
      throw new Error('The grant referenced by this interaction no longer exists');
    }

    const granting = decision.scopes ?? promptDetails.missingOIDCScope ?? [];
    if (granting.length > 0) {
      grant.addOIDCScope(granting.join(' '));
    }
    if (promptDetails.missingOIDCClaims?.length) {
      grant.addOIDCClaims(promptDetails.missingOIDCClaims);
    }
    for (const [indicator, scopes] of Object.entries(promptDetails.missingResourceScopes ?? {})) {
      grant.addResourceScope(indicator, scopes.join(' '));
    }

    const grantId = await grant.save();

    return {
      redirectTo: await this.provider.interactionResult(
        raw.req,
        raw.res,
        { consent: { grantId } },
        { mergeWithLastSubmission: Boolean(details.grantId) },
      ),
    };
  }

  /**
   * Abandon a pending interaction.
   *
   * Gives the relying party a clean `access_denied` instead of leaving it waiting on a
   * browser tab the user closed.
   *
   * @param req - The framework request
   * @param res - The framework response
   * @returns Where to send the browser
   */
  async abort(req: unknown, res: unknown): Promise<InteractionRedirectDTO> {
    const raw = toRawHttp(req, res);
    return {
      redirectTo: await this.provider.interactionResult(raw.req, raw.res, {
        error: 'access_denied',
        error_description: 'End-user aborted the interaction',
      }),
    };
  }
}
