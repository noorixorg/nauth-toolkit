import type Provider from 'oidc-provider';
import type { InteractionResults } from 'oidc-provider';
import { AuthAuditEventType, AuthErrorCode, NAuthException } from '@nauth-toolkit/core';
import type { AuthAuditService, IdpSessionGate } from '@nauth-toolkit/core/internal';
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
/** The unwrapped Node request and response pair the provider works with. */
type RawHttp = ReturnType<typeof toRawHttp>;

/** What `interactionDetails` resolves to, without naming the provider's internals. */
type InteractionDetails = Awaited<ReturnType<Provider['interactionDetails']>>;

/**
 * The error a frontend acts on by sending the user back through login.
 *
 * Carries the interaction id so the caller can stash it before navigating away and
 * return to exactly this request afterwards, and the gate's reason so it can explain
 * itself. Recoverable, unlike `OIDC_ACCESS_DENIED`.
 *
 * @param uid - The pending interaction id
 * @param reason - Why the session gate refused
 * @returns An exception the HTTP layer maps to 401
 */
function loginRequired(uid: string, reason: string): NAuthException {
  return new NAuthException(
    AuthErrorCode.OIDC_LOGIN_REQUIRED,
    'A completed login is required to continue this authorization request',
    { uid, reason },
  );
}

export class OIDCInteractionBridge {
  /**
   * @param provider - The configured `oidc-provider` instance
   * @param sessionGate - nauth's verdict on whether a request may be vouched for
   * @param auditService - Optional. When supplied, every decision is written to nauth's
   *   audit trail with the relying party's identity attached. Omitted when audit logs
   *   are disabled, in which case nothing is recorded
   */
  constructor(
    private readonly provider: Provider,
    private readonly sessionGate: IdpSessionGate,
    private readonly auditService?: AuthAuditService,
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
   * @throws {NAuthException} `OIDC_INTERACTION_NOT_FOUND` when there is no such pending request
   */
  async getState(req: unknown, res: unknown): Promise<InteractionStateDTO> {
    const raw = toRawHttp(req, res);
    const details = await this.loadInteraction(raw);
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
   * @throws {NAuthException} `OIDC_INTERACTION_NOT_FOUND` when the request has expired,
   *   or `OIDC_LOGIN_REQUIRED` when no completed nauth login stands behind it — the
   *   latter carrying `uid` so the frontend can resume after logging in
   */
  async completeLogin(req: unknown, res: unknown): Promise<InteractionRedirectDTO> {
    const raw = toRawHttp(req, res);
    // Loaded before the gate is consulted, so an expired interaction is reported as
    // such rather than as a login problem, and so `uid` is available to the error the
    // frontend has to act on.
    const details = await this.loadInteraction(raw);
    const gate = await this.sessionGate.evaluate();

    if (gate.status === 'denied') {
      this.audit(
        AuthAuditEventType.OIDC_ACCESS_DENIED,
        'FAILURE',
        details,
        { reason: gate.reason },
        undefined,
        gate.sub,
      );
      return this.resolve(raw, {
        error: 'access_denied',
        error_description: `Account unavailable (${gate.reason})`,
      });
    }

    if (gate.status !== 'authenticated') {
      throw loginRequired(details.uid, gate.reason);
    }

    this.audit(AuthAuditEventType.OIDC_LOGIN_COMPLETED, 'SUCCESS', details, {}, gate.user.id);

    return this.resolve(raw, { login: { accountId: gate.user.sub, remember: true } }, false);
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
   * @throws {NAuthException} `OIDC_INTERACTION_NOT_FOUND` when the request has expired,
   *   or `OIDC_LOGIN_REQUIRED` when the session lapsed while the consent screen was open
   */
  async completeConsent(
    req: unknown,
    res: unknown,
    decision: { approve: boolean; scopes?: string[] },
  ): Promise<InteractionRedirectDTO> {
    const raw = toRawHttp(req, res);
    const details = await this.loadInteraction(raw);

    if (!decision.approve) {
      this.audit(AuthAuditEventType.OIDC_CONSENT_DENIED, 'INFO', details);
      return this.resolve(raw, {
        error: 'access_denied',
        error_description: 'The user denied the request',
      });
    }

    // The gate runs here for the same reason it runs on login: a consent screen is
    // somewhere users linger, and the session behind it can lapse — or the account be
    // disabled — between the screen rendering and the button being pressed.
    const gate = await this.sessionGate.evaluate();
    if (gate.status === 'denied') {
      this.audit(
        AuthAuditEventType.OIDC_ACCESS_DENIED,
        'FAILURE',
        details,
        { reason: gate.reason },
        undefined,
        gate.sub,
      );
      return this.resolve(raw, {
        error: 'access_denied',
        error_description: `Account unavailable (${gate.reason})`,
      });
    }
    if (gate.status !== 'authenticated') {
      throw loginRequired(details.uid, gate.reason);
    }

    const accountId = details.session?.accountId;
    if (!accountId) {
      // The provider's own login record is gone even though nauth still has a session:
      // the interaction has to be restarted from the login step.
      throw loginRequired(details.uid, 'no_session');
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
      throw new NAuthException(
        AuthErrorCode.OIDC_INTERACTION_NOT_FOUND,
        'The grant referenced by this authorization request no longer exists',
        { uid: details.uid },
      );
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

    this.audit(AuthAuditEventType.OIDC_CONSENT_GRANTED, 'SUCCESS', details, { grantedScopes: granting }, gate.user.id);

    return this.resolve(raw, { consent: { grantId } }, Boolean(details.grantId));
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
    // Loaded first so that aborting an interaction which has already expired answers
    // 404 like every other route here, rather than surfacing as a server fault.
    await this.loadInteraction(raw);
    return this.resolve(raw, {
      error: 'access_denied',
      error_description: 'End-user aborted the interaction',
    });
  }

  /**
   * Write one decision to nauth's audit trail, with the relying party attached.
   *
   * The ordinary `LOGIN_SUCCESS` recorded when the user typed their password cannot
   * carry this: at that point the authorization request is still parked and nauth has
   * no idea a third party is waiting. Here it does.
   *
   * Fire-and-forget, and never allowed to fail the flow — an audit backend being down
   * must not stop a user signing in. Client info (IP, geolocation, device, user agent)
   * is filled in automatically by the audit service, because these are ordinary nauth
   * routes running inside the request context.
   *
   * @param eventType - Which decision this was
   * @param eventStatus - How it turned out
   * @param details - The interaction the decision belongs to
   * @param metadata - Anything to record beyond the client and scopes
   * @param userId - Internal user id, when the gate has already resolved one
   * @param sub - External identifier, for a refusal where no internal id was resolved
   */
  private audit(
    eventType: AuthAuditEventType,
    eventStatus: 'SUCCESS' | 'FAILURE' | 'INFO',
    details: InteractionDetails,
    metadata: Record<string, unknown> = {},
    userId?: number,
    sub?: string,
  ): void {
    if (!this.auditService) {
      return;
    }

    const clientId = details.params.client_id === undefined ? undefined : String(details.params.client_id);
    // At the login step the provider has not recorded an account yet, so a refusal has
    // to be attributed from the gate's own verdict instead.
    const account = sub ?? details.session?.accountId;

    // Without one of these the audit service cannot resolve a user, and would only log
    // a warning per event.
    if (userId === undefined && !account) {
      return;
    }

    void this.auditService
      .recordEvent({
        ...(userId === undefined ? { sub: account } : { userId }),
        eventType,
        eventStatus,
        authMethod: 'oidc',
        metadata: {
          clientId,
          interactionUid: details.uid,
          requestedScopes: String(details.params.scope ?? '')
            .split(/\s+/)
            .filter(Boolean),
          ...metadata,
        },
      })
      .catch(() => {
        // Auditing must never break the authorization flow.
      });
  }

  /**
   * Read the pending interaction, or say plainly that there isn't one.
   *
   * `interactionDetails` throws `SessionNotFound` for an interaction that has expired,
   * been resolved already, or never existed — all of which are a 404 to the caller, not
   * a server fault.
   *
   * @param raw - The unwrapped Node request and response
   * @returns The provider's view of the pending interaction
   * @throws {NAuthException} `OIDC_INTERACTION_NOT_FOUND` when there is no such interaction
   */
  private async loadInteraction(raw: RawHttp): Promise<InteractionDetails> {
    try {
      return await this.provider.interactionDetails(raw.req, raw.res);
    } catch (error) {
      throw new NAuthException(
        AuthErrorCode.OIDC_INTERACTION_NOT_FOUND,
        'This authorization request has expired or was already completed',
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Resolve the interaction and report where the browser should go.
   *
   * @param raw - The unwrapped Node request and response
   * @param result - What to resolve the interaction with
   * @param mergeWithLastSubmission - Whether to merge into the previous submission
   * @returns The provider's redirect target
   */
  private async resolve(
    raw: RawHttp,
    result: InteractionResults,
    mergeWithLastSubmission = true,
  ): Promise<InteractionRedirectDTO> {
    return {
      redirectTo: await this.provider.interactionResult(raw.req, raw.res, result, {
        mergeWithLastSubmission,
      }),
    };
  }
}
