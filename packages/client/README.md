# @nauth-toolkit/client

Framework-agnostic frontend SDK for [nauth-toolkit](https://nauth.dev).

Handles authentication flows from the browser — signup, login, token refresh, MFA, social OAuth, session management. Works with React, Vue, Svelte, or any TypeScript/JavaScript frontend. Ships as both CJS and ESM.

## What's included

- **AuthClient** — typed API client for all nauth-toolkit endpoints
- **Token management** — automatic silent refresh, storage abstraction
- **MFA flows** — TOTP enrollment, SMS/email verification, passkey registration and authentication
- **Social OAuth** — redirect and popup flows for Google, Apple, Facebook
- **Session management** — list sessions, revoke sessions, device info

For Angular, use [`@nauth-toolkit/client-angular`](https://www.npmjs.com/package/@nauth-toolkit/client-angular) which builds on this SDK with Angular-specific services and DI.

**Docs:** [nauth.dev](https://nauth.dev) · **Examples:** [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth) · **Live demo:** [demo.nauth.dev](https://demo.nauth.dev)
