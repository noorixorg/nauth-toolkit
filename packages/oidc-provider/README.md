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

Then expose the interaction bridge as an ordinary controller. Unlike the provider's own endpoints, these are normal nauth routes with the full guard chain and request context:

```ts
@Controller('oidc/interaction')
export class OIDCInteractionController {
  constructor(@Inject(NAUTH_OIDC_BRIDGE) private readonly bridge: OIDCInteractionBridge) {}

  @Public() @Get(':uid')          state(@Req() q, @Res({ passthrough: true }) s) { return this.bridge.getState(q, s); }
  @Public() @Post(':uid/login')   login(@Req() q, @Res({ passthrough: true }) s) { return this.bridge.completeLogin(q, s); }
  @Public() @Post(':uid/confirm') confirm(@Req() q, @Res({ passthrough: true }) s, @Body() b) {
    return this.bridge.completeConsent(q, s, { approve: b.approve !== false });
  }
}
```

See `examples/demo-nestjs` for the whole thing wired up, and `examples/demo-angular` for the interaction page.

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
