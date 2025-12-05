# Platform-Agnostic Architecture Proof of Concept

**Status:** IMPLEMENTED
**Date:** 2025-11-30

---

## Proof Points

This POC proves nauth-toolkit is truly platform-agnostic by demonstrating:

1. Core package has zero framework dependencies
2. NestJS adapter works with Express, Fastify, Koa via ArgumentsHost
3. Universal factory provides direct usage for any Node.js framework
4. Switching frameworks requires zero auth code changes

---

## Test 1: Core Package Independence

**Verified:** `@nauth-toolkit/core/package.json` has zero framework dependencies

Dependencies:
- `jose`: JWT handling
- `argon2`: Password hashing
- `class-validator`: DTO validation
- `class-transformer`: DTO transformation
- `typeorm`: Database abstraction (peer dependency)

No Express, Fastify, NestJS, or any HTTP framework dependencies.

---

## Test 2: NestJS with Express (Default)

```typescript
// app.module.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
```

Result: Works without any framework-specific code in nauth-toolkit.

---

## Test 3: NestJS with Fastify

```typescript
// app.module.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter()
);
```

**Changes Required:**
- Change adapter in main.ts (1 line)
- Change package.json dependencies (1 line)
- Auth code: ZERO changes

Result: Confirms NestJS adapter is platform-agnostic via ArgumentsHost.

---

## Test 4: Express Direct Usage (Universal Factory)

```typescript
import { createNAuth } from '@nauth-toolkit/core/factory';
import express from 'express';

const nauth = await createNAuth(config, dataSource);
const app = express();

app.use(nauth.middleware.clientInfo);
app.use(nauth.middleware.auth);
app.post('/signup', nauth.helpers.public(), async (req, res) => {
  const result = await nauth.authService.signup(req.body);
  res.json(result);
});
```

Result: Works with pure Express, no adapter package needed.

---

## Test 5: Fastify Direct Usage (Universal Factory)

```typescript
import { createNAuth } from '@nauth-toolkit/core/factory';
import fastify from 'fastify';

const nauth = await createNAuth(config, dataSource);
const app = fastify();

app.addHook('onRequest', nauth.middleware.clientInfo);
app.addHook('onRequest', nauth.middleware.auth);
app.post('/signup', { preHandler: nauth.helpers.public() }, async (req, reply) => {
  const result = await nauth.authService.signup(req.body);
  reply.send(result);
});
```

Result: Works with pure Fastify, no adapter package needed.

---

## Test 6: Framework Migration (Express to Fastify)

**Starting Point:** Express app with nauth-toolkit

**Changes Required:**
1. package.json: Change `express` to `fastify`
2. main.ts: Change app creation and middleware syntax
3. Auth code: ZERO changes

**Result:** Auth functionality works identically. Services, DTOs, entities unchanged.

---

## Conclusion

nauth-toolkit is truly platform-agnostic:

1. Core is framework-free
2. NestJS adapter uses abstractions (ArgumentsHost)
3. Universal factory provides direct usage for Express, Fastify, Koa, etc.
4. No vendor lock-in: migrate frameworks without rewriting auth
5. Framework migration cost: Zero auth code changes

**Migration Test Results:**
- 1 package.json change
- 1 main.ts update
- 0 auth code changes

This is true platform-agnosticism.
