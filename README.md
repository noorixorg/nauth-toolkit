# nauth-toolkit

Drop-in authentication services for NestJS and Node backends. Service-first, framework-agnostic, and designed to plug into your own controllers, routes, and deployment model.

> **Early Access:** Free to use in development and production during preview. Transitioning to open source (MIT/Apache 2.0) at v1.0 GA. Core features will remain free forever. See `LICENSE` for full terms.

## Overview

- Core services for auth, MFA, sessions, risk signals, and token delivery
- Storage abstraction (memory, Redis, database adapters)
- Works with Express/Fastify/GraphQL/WebSockets via NestJS adapters
- Type-safe TypeScript with strict linting and testing standards

## Documentation

Full docs and guides live at **https://nauth.dev**. Start there for setup, usage patterns, and API references.

## Quick Start

```bash
yarn install
yarn build
```

Then import the services you need, configure storage, and wire into your own controllers or routes. Examples for NestJS, Express, and Fastify are in the docs.

## Contributing

- Yarn only (no npm/pnpm)
- Follow the documented coding standards (JSDoc required, no `any`, tests required)
- Conventional commits are enforced via Husky + commitlint

## License & Use

Early Access License - free to use, transitioning to open source. See `LICENSE` for full terms.
