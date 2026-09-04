# @nauth-toolkit/oidc-provider

Turn an nauth-toolkit application into an OAuth 2.0 authorization server and OpenID Connect provider, so third parties can offer "Sign in with your app".

The protocol is implemented by [`oidc-provider`](https://github.com/panva/node-oidc-provider) — OpenID Certified, MIT, no commercial tier. This package supplies the three things it needs from nauth and nothing else: **storage**, **accounts**, and a **login and consent flow**. nauth owns no protocol code.

Full guide: <https://nauth.dev>

## Why this shape

nauth stays the sole authority on identity. When the provider needs a user, it redirects to your application; your existing login runs — forced password change, email and phone verification, MFA setup and verification, adaptive risk — and only then does the interaction bridge report a completed login. No challenge component changes.

## Install

```bash
npm install @nauth-toolkit/oidc-provider oidc-provider
```

`oidc-provider` is a peer dependency, so you control its version. It is ESM-only; Node 22.12+ loads it directly, and older versions fall back to a dynamic import automatically.

## Express

```ts
import { createNAuthOIDCProvider, mountOIDCProviderExpress } from '@nauth-toolkit/oidc-provider';

const provider = await createNAuthOIDCProvider({
  issuer: 'https://app.example.com',              // an origin — see the warning below
  pathPrefix: '/oidc',
  interactionUrl: (uid) => `https://app.example.com/interaction/${uid}`,
  storage: nauth.storage,
  userRepository,
  cookieKeys: [process.env.OIDC_COOKIE_SECRET!],
  proxy: true,                                     // behind a reverse proxy
  clients: [
    {
      client_id: 'partner',
      client_secret: process.env.PARTNER_SECRET,
      client_name: 'Partner App',
      redirect_uris: ['https://partner.example.com/callback'],
    },
  ],
});

mountOIDCProviderExpress(app, provider);           // before express.json()
```

## NestJS

```ts
// app.module.ts
imports: [AuthModule.forRoot(authConfig), OIDCProviderModule.forRoot(oidcConfig)]

// main.ts — after create(), before the body parsers and setGlobalPrefix
mountOIDCProviderNest(app, app.get(NAUTH_OIDC_PROVIDER));
```

`OIDCProviderModule.forRoot()` also registers the interaction controller your consent
screen talks to, at `oidc/interaction/:uid` (under any global prefix). Move it or take
it over:

```ts
OIDCProviderModule.forRoot({
  ...oidcConfig,
  interaction: { path: 'identity/interaction' },   // or { enabled: false } to write your own
});
```

Those routes are ordinary nauth routes — full guard chain, full request context —
unlike the provider's own endpoints, which own raw HTTP under `pathPrefix`. Writing
your own means injecting `NAUTH_OIDC_BRIDGE` and calling it; start from
`createOIDCInteractionController`, and note that it applies `@UseGuards(AuthGuard)` at
the class level *and* `@Public()` on every route. That combination is load-bearing:
`AuthGuard` is not global in this toolkit, so without it the session gate reports
`no_session` for everyone, and `@Public()` is what makes it attach a user when there is
one without rejecting the anonymous caller you have to answer.

## The consent screen

The frontend SDK drives all four routes, so there is no hand-written HTTP in your app:

```ts
const state = await client.oidc.getInteraction(uid);

if (state.gate === 'login_required') {
  await client.oidc.setPendingInteraction(uid);   // survives the whole challenge chain
  router.navigate(['/login']);
} else if (state.prompt === 'login') {
  window.location.assign((await client.oidc.completeLogin(uid)).redirectTo);
} else {
  // render state.client and state.missingScopes, then:
  window.location.assign((await client.oidc.approve(uid)).redirectTo);
}
```

Angular apps get `auth.oidc` on `AuthService` and an optional `oidcReturnGuard()` for
routes a freshly logged-in user lands on. See `examples/demo-nestjs` for the backend
wired up and `examples/demo-angular` for the interaction page.

## Errors the frontend has to act on

Bridge failures are `NAuthException`s, so `NAuthHttpExceptionFilter` maps them:

| Code | Status | Meaning |
|---|---|---|
| `OIDC_INTERACTION_NOT_FOUND` | 404 | Expired or already resolved. Start again from the client. |
| `OIDC_LOGIN_REQUIRED` | 401 | Recoverable. `details.uid` says what to come back to. |

A session that lapses while the consent screen sits open is the common case, and it
surfaces as `OIDC_LOGIN_REQUIRED` on the confirm call — re-stash `details.uid`, send the
user through login, and resume.

A **disabled or locked account is not an error.** The bridge resolves the interaction
with `access_denied` and returns an ordinary `redirectTo`, so the relying party gets a
protocol error rather than the user getting a dead browser tab. Follow the redirect as
you would any other.

## What lands in the audit trail

When audit logs are enabled, the bridge records who was released to which application —
something the ordinary `LOGIN_SUCCESS` cannot say, because the authorization request is
still parked when the user types their password.

| Event | When |
|---|---|
| `OIDC_LOGIN_COMPLETED` | A completed login was released to a relying party |
| `OIDC_CONSENT_GRANTED` | The user approved the request |
| `OIDC_CONSENT_DENIED` | The user refused it |
| `OIDC_ACCESS_DENIED` | The account may not be vouched for |

Each carries `authMethod: 'oidc'` and a metadata object with `clientId`,
`interactionUid`, `requestedScopes` and (on a grant) `grantedScopes`. IP address,
geolocation, device and user agent are captured automatically, because these are
ordinary nauth-toolkit routes.

**Scope:** this covers the login and consent decisions. Token issuance, refresh and
introspection happen on the provider's own endpoints, outside the request context, and
are **not** recorded.

## Two things that will bite you

**The issuer must be an origin with no path.** `oidc-provider` builds every endpoint URL as `new URL(absolutePath, issuer)`, so a path on the issuer is silently discarded — `new URL('/auth', 'https://host/oidc')` is `https://host/auth`. Configure `issuer: 'https://host'` and namespace the endpoints with `pathPrefix` instead, which is what this package does for you. Discovery then lands at `/.well-known/openid-configuration`, exactly where OpenID Connect Discovery expects it.

**Mount before your body parsers.** `oidc-provider` reads the raw request stream for `POST /token`. It does fall back to a pre-parsed `req.body`, so it works either way, but mounting first avoids a startup warning and keeps its own request size limit.

## What this package hardens by default

| | Upstream default | Here |
|---|---|---|
| Response types | `code`, `id_token`, `code id_token`, `none` | **`code` only** — no implicit or hybrid |
| PKCE | required for public clients | **required for every client** (RFC 9700) |
| Introspection / revocation | disabled | **enabled**, and a client may only reach **its own** tokens |
| Refresh tokens | require the `offline_access` scope | issued whenever the client registers the grant |
| Artifact lifetimes | warn-on-default | set explicitly |
| Built-in dev login screens | enabled | **disabled** — nauth owns login |

## Storage

Every provider artifact lives in nauth's existing `StorageAdapter`. **No new tables and no migrations.** Use Redis in production; the database adapter is fine for low traffic, and the in-memory one is single-instance only.
