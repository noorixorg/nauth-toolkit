---
title: "API Keys"
description: "Enable API key authentication, let users or admins generate keys with expiry and per-key IP restrictions, and protect routes with the AllowApiKey / DenyApiKey decorators"
sidebar_position: 5
keywords: [api keys, api-key, machine auth, service account, X-API-Key, ip allowlist, allowApiKey, denyApiKey]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# API Keys

Issue long-lived API keys that authenticate **as a user** — for scripts, services, and machine-to-machine calls. Keys can be created by end users (self-service) or only by admins, carry a mandatory expiry, and optionally restrict the source IPs that may use them.

By the end of this guide you will have user and admin key-management endpoints plus routes that accept API-key auth.

## How it works

- A key is presented in a configurable header (default `X-API-Key`).
- **Single mechanism per request:** when the header is present it is the *only* credential considered. A valid key authenticates as the owning user; on a protected route an invalid, expired, revoked, or IP-blocked key is **denied (401/403)** with no fallback to cookies/bearer.
- **Optional identification on public routes:** on a `@Public()` route a valid key still identifies the caller (just like a valid JWT would), so `@CurrentUser()` is populated — but a missing or invalid key is tolerated and the request proceeds unauthenticated. Public routes are never made to fail by a stray key.
- Only a SHA-256 hash of the key is stored. The plaintext is returned **once** at creation.
- **Opt-in route access (least privilege):** keys only work on routes explicitly marked with `@AllowApiKey()` (or globally via `apiKeys.globalAllowlist`). `@DenyApiKey()` always wins.

## Prerequisites

Enable the feature in your NAuth config. Ensure the `ApiKey` entity is registered — it is included automatically by `getNAuthEntities()`.

```typescript title="src/config/auth.config.ts"
export const authConfig = {
  // ...jwt, etc.
  apiKeys: {
    enabled: true,
    allowUserCreation: false, // false = only admins create keys; true = users self-serve
    header: 'X-API-Key',      // header carrying the key (default)
    maxKeysPerUser: 10,
    maxExpiryDays: 365,       // caps finite expiries; omit for no cap
    allowIndefinite: true,    // allow never-expiring keys
    trackUsageIp: true,       // record the IP of each key's last use
    ipRestrictions: {
      enabled: true,          // allow per-key IP allowlists
      requireForNewKeys: false,
      maxIpsPerKey: 20,
    },
  },
};
```

The `nauth_api_keys` table ships as a bundled migration in the database packages
(`@nauth-toolkit/database-typeorm-postgres` / `-mysql`). NAuth runs its bundled migrations
automatically on startup, so the table is created for you the first time you boot with the
feature enabled — no manual migration step is required.

## Protect a route

Mark any route or controller that should accept API keys with `@AllowApiKey()`. Use `@DenyApiKey()` to exclude a sensitive route even under a controller-level opt-in.

```typescript title="src/reports/reports.controller.ts"
import { Controller, Get, Delete, UseGuards } from '@nestjs/common';
import { AuthGuard, AllowApiKey, DenyApiKey, CurrentUser, IUser } from '@nauth-toolkit/nestjs';

@AllowApiKey() // whole controller accepts API keys...
@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  @Get()
  async list(@CurrentUser() user: IUser) {
    return this.reportsService.listFor(user.id);
  }

  @DenyApiKey() // ...but this one requires an interactive session
  @Delete('all')
  async purge(@CurrentUser() user: IUser) {
    return this.reportsService.purge(user.id);
  }
}
```

**Precedence (deny wins):** route `@DenyApiKey` → route `@AllowApiKey` → controller `@DenyApiKey` → controller `@AllowApiKey` → `apiKeys.globalAllowlist`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

Use the decorators above with the exported `AuthGuard`.

</TabItem>
<TabItem value="express" label="Express / Fastify">

Use the framework-neutral helpers. `requireAuth()` enforces the opt-in.

```typescript
app.get('/reports', nauth.helpers.allowApiKey(), nauth.helpers.requireAuth(), listHandler);
app.delete('/reports/all', nauth.helpers.denyApiKey(), nauth.helpers.requireAuth(), purgeHandler);
```

Register the `apiKey` middleware before `auth` in your pipeline: `clientInfo → apiKey → auth → csrf`.

</TabItem>
</Tabs>

## Self-service key management

When `allowUserCreation: true`, let users manage their own keys. Inject [`ApiKeyService`](../api/core/services/api-key-service.md).

Each self-service method takes a DTO and returns a response DTO. The **acting user is resolved
from the auth context** — you never pass a user id.

```typescript title="src/api-keys/api-keys.controller.ts"
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  AuthGuard,
  ApiKeyService,
  CreateApiKeyDTO,
  UpdateApiKeyDTO,
  CreateApiKeyResponseDTO,
  ApiKeyResponseDTO,
  ListApiKeysResponseDTO,
  RevokeApiKeyResponseDTO,
  DeleteApiKeyResponseDTO,
} from '@nauth-toolkit/nestjs';

@UseGuards(AuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Post()
  create(@Body() dto: CreateApiKeyDTO): Promise<CreateApiKeyResponseDTO> {
    // Returns the plaintext key ONCE — deliver it securely.
    return this.apiKeys.createKey(dto);
  }

  @Get()
  list(): Promise<ListApiKeysResponseDTO> {
    return this.apiKeys.listKeys();
  }

  @Patch(':keyId')
  update(@Param('keyId') keyId: string, @Body() dto: UpdateApiKeyDTO): Promise<ApiKeyResponseDTO> {
    return this.apiKeys.updateKey({ keyId, name: dto.name, allowedIps: dto.allowedIps });
  }

  @Post(':keyId/revoke')
  revoke(@Param('keyId') keyId: string): Promise<RevokeApiKeyResponseDTO> {
    return this.apiKeys.revokeKey({ keyId });
  }

  @Delete(':keyId')
  remove(@Param('keyId') keyId: string): Promise<DeleteApiKeyResponseDTO> {
    return this.apiKeys.deleteKey({ keyId });
  }
}
```

## Admin key management

Admins manage keys on behalf of any user with the `admin*` methods on [`ApiKeyService`](../api/core/services/api-key-service.md), which take the target user's **`sub`** — and work even when `allowUserCreation` is `false`. Protect these routes with your admin guard.

```typescript
// Create a key for a user (bypasses allowUserCreation)
await apiKeys.adminCreateKey({ sub, expiresInDays: 90, allowedIps: ['203.0.113.0/24'] });

await apiKeys.adminListKeys({ sub });
await apiKeys.adminUpdateKey({ sub, keyId, allowedIps: ['203.0.113.5'] });
await apiKeys.adminRevokeKey({ sub, keyId });
await apiKeys.adminDeleteKey({ sub, keyId });
```

## Using a key

A key is a single opaque token generated by the server (users/admins never supply their own).
Send it, whole, in the configured header:

```bash
curl https://api.example.com/reports -H "X-API-Key: Zdh-wUDorVIDtYEiW2q1fT5m9jdXxss-cmyZbIZ73Qg"
```

From the frontend SDK, attach the header or use the management methods:

```typescript
import { NAuthClient, apiKeyHeader } from '@nauth-toolkit/client';

// Machine client authenticating with a key
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'json',
  headers: apiKeyHeader(process.env.NAUTH_API_KEY!),
});

// Or manage keys for the signed-in user
const { key } = await client.apiKeys.create({ expiresInDays: 90, allowedIps: ['203.0.113.0/24'] });
const keys = await client.apiKeys.list();
await client.apiKeys.update(keyId, { allowedIps: ['203.0.113.5'] });
await client.apiKeys.revoke(keyId);
```

## IP restrictions

Each key may carry an allowlist of IPs and IPv4 CIDR ranges. An **empty allowlist means any IP**. Requests from a source IP outside the allowlist are rejected with `API_KEY_IP_NOT_ALLOWED` (403). Set or change the allowlist on create or update.

## Errors

| Code | Status | Meaning |
| --- | --- | --- |
| `API_KEY_INVALID` | 401 | Key unknown or malformed |
| `API_KEY_EXPIRED` | 401 | Key past its expiry |
| `API_KEY_IP_NOT_ALLOWED` | 403 | Source IP not on the key's allowlist |
| `API_KEY_CREATION_DISABLED` | 403 | User creation disabled; use the admin API |
| `API_KEY_LIMIT_REACHED` | 409 | `maxKeysPerUser` reached |
| `API_KEY_EXPIRY_REQUIRED` | 400 | Expiry omitted at creation |
| `API_KEY_INDEFINITE_NOT_ALLOWED` | 400 | Never-expiry requested but disallowed |
| `API_KEY_EXPIRY_TOO_LONG` | 400 | Expiry exceeds `maxExpiryDays` |

## Related reference

Everything the API-key feature touches, linked in one place.

**Service & config**

- [ApiKeyService](../api/core/services/api-key-service.md) — self-service (`createKey`, …) + admin (`adminCreateKey`, …) + validation
- [Configuration → API Keys](../concepts/configuration.md#api-keys) — the full `apiKeys` config block
- [NAuthConfig](../api/core/interfaces/nauth-config.md) — top-level config interface

**Request DTOs**

- [CreateApiKeyDTO](../api/core/dto/create-api-key-dto.md) · [UpdateApiKeyDTO](../api/core/dto/update-api-key-dto.md) · [RevokeApiKeyDTO](../api/core/dto/revoke-api-key-dto.md) · [DeleteApiKeyDTO](../api/core/dto/delete-api-key-dto.md)
- Admin: [AdminCreateApiKeyDTO](../api/core/dto/admin-create-api-key-dto.md) · [AdminUpdateApiKeyDTO](../api/core/dto/admin-update-api-key-dto.md) · [AdminManageApiKeyDTO](../api/core/dto/admin-manage-api-key-dto.md)

**Response DTOs**

- [ApiKeyResponseDTO](../api/core/dto/api-key-response-dto.md) · [CreateApiKeyResponseDTO](../api/core/dto/create-api-key-response-dto.md)

**Enums**

- [AuthErrorCode](../api/core/enums/auth-error-code.md) — the `API_KEY_*` error codes
- [AuthAuditEventType](../api/core/enums/auth-audit-event-type.md) — the `API_KEY_*` audit events

## What's next

- [Configuration](../concepts/configuration.md) — the full `apiKeys` config block
- [Admin Operations](./admin-operations.md) — build the admin surface
