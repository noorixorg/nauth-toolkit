---
title: "Set Up the OpenID Connect Provider"
description: "Install @nauth-toolkit/oidc-provider, configure NAuthOIDCOptions (issuer, pathPrefix, interactionUrl, cookieKeys, jwks, proxy), mount it before the body parsers, and rate limit its endpoints"
sidebar_position: 1
keywords: [openid connect, oidc setup, oauth2 server, issuer, jwks, discovery, nestjs]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Set Up the OpenID Connect Provider

By the end of this guide your application serves a discovery document, a JWKS, and a working authorization-code flow, and the consent screen has routes to talk to.

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/.well-known/openid-configuration` | GET | Public | Discovery document |
| `/oidc/auth` | GET | Public | Authorization endpoint |
| `/oidc/token` | POST | Client | Token endpoint |
| `/oidc/jwks` | GET | Public | Signing keys |
| `/oidc/me` | GET | Bearer | UserInfo |
| `/oidc/token/introspection` | POST | Client | Introspection |
| `/oidc/token/revocation` | POST | Client | Revocation |
| `/oidc/session/end` | GET, POST | Public | RP-initiated logout |

The interaction routes the consent screen calls are separate — they are ordinary routes in *your* application, at `oidc/interaction/:uid` under any global prefix. See [Step 5](#step-5--the-interaction-routes).

:::tip[Sample apps]
`examples/demo-nestjs` in the [nauth-toolkit repository](https://github.com/noorixorg/nauth-toolkit) has all of this wired up, including rate limiting and two registered clients.
:::

## Prerequisites

You have completed the [Basic Auth Flows](/docs/guides/basic-auth) guide and have working signup, login, and challenge endpoints. You also need a place for the provider to store artifacts — see [Storage](/docs/concepts/storage). Redis in production, please.

Read [How the OpenID Connect Provider Works](/docs/guides/oauth-provider/how-oauth-provider-works) first if you have not.

:::warning[This is for third-party integrations]
Your own application should keep signing in through [`AuthService`](/docs/api/core/services/auth-service) and the [frontend SDK](/docs/frontend-sdk/overview). The provider's protocol endpoints do not carry nauth-toolkit's granular rate limiting or account lockout — see [when to use this, and when not to](/docs/guides/oauth-provider/how-oauth-provider-works#when-to-use-this--and-when-not-to).
:::

## Step 1 — Install

```bash npm2yarn
npm install @nauth-toolkit/oidc-provider oidc-provider
```

`oidc-provider` is a peer dependency, so you control its version. It is ESM-only, and the package loads it for you on every supported Node.js version — nothing to configure.

## Step 2 — Configure

```typescript title="src/config/oidc.config.ts"
import type { OIDCProviderModuleOptions } from '@nauth-toolkit/oidc-provider/nestjs';

/**
 * The public origin of this deployment. This is the OIDC issuer, and it must be an
 * origin with **no path** — see the warning below.
 */
const ORIGIN = process.env.PUBLIC_ORIGIN ?? 'https://auth.example.com';
const FRONTEND = process.env.FRONTEND_BASE_URL ?? 'https://auth.example.com';

export const oidcConfig: OIDCProviderModuleOptions = {
  issuer: ORIGIN,
  pathPrefix: '/oidc',

  // Where the browser goes when the provider needs the user to do something.
  interactionUrl: (uid: string) => `${FRONTEND}/interaction/${uid}`,

  // Signs the provider's own cookies. Unrelated to nauth-toolkit's JWT secrets.
  // Rotate by prepending a new key and keeping a short history.
  cookieKeys: [process.env.OIDC_COOKIE_SECRET!],

  // Required behind a reverse proxy, or every generated URL is http:// and the
  // secure cookies are refused.
  proxy: true,

  clients: [
    {
      client_id: 'partner',
      client_secret: process.env.PARTNER_CLIENT_SECRET!,
      client_name: 'Partner App',
      redirect_uris: ['https://myapp.com/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    },
  ],
};
```

:::warning[The issuer must be an origin with no path]
`oidc-provider` builds every endpoint URL as `new URL(absolutePath, issuer)`, so a path on the issuer is silently discarded — `new URL('/auth', 'https://host/oidc')` is `https://host/auth`. The discovery document then advertises endpoints that 404. Set `issuer` to the bare origin and namespace the endpoints with `pathPrefix`, which is what this package does for you. Discovery still lands at `/.well-known/openid-configuration`, exactly where OpenID Connect Discovery expects it for an origin issuer.
:::

### Signing keys

Omit `jwks` and a development key is generated at startup, with a warning. That key changes on every restart, which invalidates every id_token you have issued. Generate a persistent key set for anything beyond local development and pass it in:

```typescript title="src/config/oidc.config.ts"
export const oidcConfig: OIDCProviderModuleOptions = {
  // ...
  jwks: JSON.parse(process.env.OIDC_JWKS!),
};
```

### Full option reference

See [`NAuthOIDCOptions`](/docs/api/oidc-provider/create-provider#options) for every option, including `secureCookies` and the `extraConfiguration` escape hatch.

## Step 3 — Register the module

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.module.ts"
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { OIDCProviderModule } from '@nauth-toolkit/oidc-provider/nestjs';
import { authConfig } from '../config/auth.config';
import { oidcConfig } from '../config/oidc.config';

@Module({
  imports: [AuthModule.forRoot(authConfig), OIDCProviderModule.forRoot(oidcConfig)],
})
export class CustomAuthModule {}
```

`OIDCProviderModule.forRoot()` also registers the interaction controller at `oidc/interaction/:uid`, under any global prefix. See [Step 5](#step-5--the-interaction-routes).

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/oidc.ts"
import { createNAuthOIDCProvider } from '@nauth-toolkit/oidc-provider';
import { oidcConfig } from './config/oidc.config';
import { dataSource } from './data-source';
import { User } from './entities/user.entity';
import { nauth } from './nauth';

export const provider = await createNAuthOIDCProvider({
  ...oidcConfig,
  storage: nauth.storage,
  userRepository: dataSource.getRepository(User),
});
```

Outside NestJS, type the config object as `NAuthOIDCOptions` (from `@nauth-toolkit/oidc-provider`) instead of `OIDCProviderModuleOptions`, and supply `storage` and `userRepository` yourself — those are the two fields the Nest module fills in.

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/oidc.ts"
import { createNAuthOIDCProvider } from '@nauth-toolkit/oidc-provider';
import { oidcConfig } from './config/oidc.config';
import { dataSource } from './data-source';
import { User } from './entities/user.entity';
import { nauth } from './nauth';

export const provider = await createNAuthOIDCProvider({
  ...oidcConfig,
  storage: nauth.storage,
  userRepository: dataSource.getRepository(User),
});
```

Type the config object as `NAuthOIDCOptions` (from `@nauth-toolkit/oidc-provider`) rather than `OIDCProviderModuleOptions`, and supply `storage` and `userRepository` yourself. Fastify owns its own HTTP server, so the mount in the next step reaches for that rather than Fastify's router.

</TabItem>
</Tabs>

## Step 4 — Mounting

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

Nothing to do. `OIDCProviderModule.forRoot()` attaches the provider during module
initialisation, so `main.ts` needs no OpenID Connect code at all:

```typescript title="src/main.ts"
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  app.use(cookieParser());
  app.useGlobalFilters(new NAuthHttpExceptionFilter());
  app.useGlobalPipes(new NAuthValidationPipe());
  app.setGlobalPrefix('api');
  await app.listen(3000);
}
```

The provider is attached to the platform instance rather than Nest's router, so
`setGlobalPrefix('api')` does not apply to its endpoints — they sit at the origin root exactly
where the discovery document advertises them. The mount inspects the running driver and picks
the matching mechanism, so the Fastify driver works the same way.

:::note[One caveat on Express]
Nest registers its body parser before modules initialise, so the provider sees an
already-parsed body on `POST /oidc/token`. `oidc-provider` falls back to `req.body`, so this
works — but the request-size limit becomes Nest's rather than the provider's. The Fastify driver
does not share this caveat; its `onRequest` hook runs before body parsing.
:::

Set `mount: { enabled: false }` and use
[`mountOIDCProviderNest`](/docs/api/oidc-provider/mounting) if you need to control the ordering
yourself.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/main.ts"
import { createOIDCRateLimiter, mountOIDCProviderExpress } from '@nauth-toolkit/oidc-provider';

const app = express();

// Rate limit ahead of the provider — see Step 6.
app.use(createOIDCRateLimiter(nauth.storage, { token: { max: 60, windowSeconds: 60 } }));
mountOIDCProviderExpress(app, provider, { pathPrefix: '/oidc' });

// Body parsers come after, so the provider keeps its own request-size limit.
app.use(express.json());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/main.ts"
import { isProviderPath } from '@nauth-toolkit/oidc-provider';

const callback = provider.callback();

fastify.addHook('onRequest', (request, reply, done) => {
  if (isProviderPath({ url: request.url }, '/oidc')) {
    reply.hijack();
    callback(request.raw, reply.raw);
    return;
  }
  done();
});
```

Register the hook at **root scope** — Fastify hooks are encapsulated, and one registered inside
`fastify.register()` would silently miss `/.well-known/*`. `reply.hijack()` hands the socket to
the provider, so do not call `done()` afterwards.

</TabItem>
</Tabs>

## Step 5 — The interaction routes

`OIDCProviderModule.forRoot()` registers them for you at `oidc/interaction/:uid`. With `setGlobalPrefix('api')` that is `/api/oidc/interaction/:uid`. Whatever path you end up with must match the frontend SDK's `oidc.basePath`, which defaults to `{baseUrl}/oidc/interaction`.

Move them, or take them over entirely:

```typescript title="src/auth/auth.module.ts"
OIDCProviderModule.forRoot({
  ...oidcConfig,
  interaction: { path: 'identity/interaction' },
});

// or write your own controller and inject NAUTH_OIDC_BRIDGE:
OIDCProviderModule.forRoot({ ...oidcConfig, interaction: { enabled: false } });
```

:::warning[If you write your own controller]
It needs `@UseGuards(AuthGuard)` at the class level **and** `@Public()` on every route. `AuthGuard` is not a global guard in this toolkit, so without it `CURRENT_USER` is never populated and the session gate reports `no_session` for everyone, forever. `@Public()` is what then makes the guard optional — attaching a user when there is one, never rejecting — which is required because an anonymous caller is the case that has to work. Start from [`createOIDCInteractionController`](/docs/api/oidc-provider/interaction-controller).
:::

Express and Fastify have no shipped controller. Wire the four routes to [`OIDCInteractionBridge`](/docs/api/oidc-provider/interaction-bridge) yourself, inside your ordinary auth middleware chain so the request context is populated — see the [bridge reference](/docs/api/oidc-provider/interaction-bridge#constructing-it-yourself) for how to construct it.

## Step 6 — Rate limit the provider

`oidc-provider` ships no rate limiting, and the provider sits outside nauth-toolkit's guard
chain, so nothing else covers these paths. `POST /token` is an unauthenticated brute-force
surface against client secrets and authorization codes.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

Configuration, not middleware — the limiter is built from your storage adapter and registered
ahead of the provider automatically:

```typescript title="src/config/oidc.config.ts"
export const oidcConfig: OIDCProviderModuleOptions = {
  issuer: ORIGIN,
  pathPrefix: '/oidc',
  rateLimit: {
    authorize: { max: 60, windowSeconds: 60 },
    token: { max: 60, windowSeconds: 60 },
    introspection: { max: 600, windowSeconds: 60 },
  },
};
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/main.ts"
app.use(
  createOIDCRateLimiter(
    nauth.storage,
    {
      authorize: { max: 60, windowSeconds: 60 },
      token: { max: 60, windowSeconds: 60 },
      introspection: { max: 600, windowSeconds: 60 },
    },
    { pathPrefix: '/oidc' },
  ),
);
```

Register it immediately before `mountOIDCProviderExpress`.

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/main.ts"
const limiter = createOIDCRateLimiter(nauth.storage, { token: { max: 60, windowSeconds: 60 } }, { pathPrefix: '/oidc' });

fastify.addHook('onRequest', (request, reply, done) => {
  if (!isProviderPath({ url: request.url }, '/oidc')) return done();
  reply.hijack();
  limiter(request.raw, reply.raw, () => callback(request.raw, reply.raw));
});
```

</TabItem>
</Tabs>

Limits are counted per source IP in your storage adapter, so they hold across instances.
Endpoints you do not list are unlimited, and a rejected request gets a `429` with `Retry-After`.
See [`createOIDCRateLimiter`](/docs/api/oidc-provider/rate-limiter).

## Checkpoint

```bash
curl https://auth.example.com/.well-known/openid-configuration
```

You should see a JSON document whose `authorization_endpoint`, `token_endpoint` and `jwks_uri` all carry your `pathPrefix`. If they do not, your `issuer` has a path on it — re-read the warning in Step 2.

```bash
curl https://auth.example.com/oidc/jwks
```

You should see at least one key. Then start an authorization request in a browser and confirm it redirects to your `interactionUrl`.

## What's Next

- [Register clients](/docs/guides/oauth-provider/registering-clients) — confidential and public clients, redirect URIs, scopes
- [Build the consent screen](/docs/guides/oauth-provider/consent-screen) — what the redirect lands on
- [Single logout](/docs/guides/oauth-provider/single-logout) — the one thing most adopters forget
- [Storage](/docs/concepts/storage) — pick an adapter that survives a restart
