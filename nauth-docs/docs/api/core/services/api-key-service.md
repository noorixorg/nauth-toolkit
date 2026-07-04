---
title: ApiKeyService
description: Create, list, update, revoke, delete, and validate API keys that authenticate as their owning user. Available when apiKeys.enabled is true.
keywords: [service, api key, api-key, machine auth, ip allowlist, validate]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ApiKeyService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Manages the API key lifecycle and validates keys presented on requests. A key authenticates **as its owning user**. Available when [`apiKeys.enabled`](../../../concepts/configuration.md) is `true`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ApiKeyService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ApiKeyService } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ApiKeyService } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

- Keys are stored as SHA-256 hashes; the plaintext is returned **once** at creation.
- Expiry is **mandatory** at creation (a number of days or `null` for never, subject to config).
- Optional per-key IP allowlists (IPs / IPv4 CIDR ranges); an empty list means any IP.
- Route access is opt-in — see the [API Keys guide](../../../guides/api-keys.md) for `@AllowApiKey()` / `@DenyApiKey()`.

:::note Authorization
This service does not enforce endpoint authorization. Protect management routes with your own guard, and use the decorators/helpers to control which routes accept API-key auth.
:::

Every method takes a request DTO and returns a response DTO, and validates the DTO at runtime
so Express/Fastify callers are protected too.

## Self-service methods (identity from auth context)

These act on the **currently authenticated user** — resolved from request context. They take no
user identifier.

### createKey(dto)

Creates a key for the current user and returns the plaintext once.

```typescript
const { key, apiKey } = await apiKeyService.createKey({
  name: 'CI pipeline',
  expiresInDays: 90,               // required: number of days, or null for never
  allowedIps: ['203.0.113.0/24'],  // optional IP allowlist
});
```

`dto` is a [CreateApiKeyDTO](../dto/create-api-key-dto.md). Returns [CreateApiKeyResponseDTO](../dto/create-api-key-response-dto.md) — `{ key, apiKey }` where `key` is the plaintext (shown once).

### listKeys()

Returns [ListApiKeysResponseDTO](../dto/list-api-keys-response-dto.md) — `{ apiKeys }` (sanitized; never the secret).

### updateKey(dto)

Updates the label and/or IP allowlist ([UpdateApiKeyDTO](../dto/update-api-key-dto.md)). The secret and expiry are immutable. Returns [ApiKeyResponseDTO](../dto/api-key-response-dto.md).

### revokeKey(dto)

Soft-disables a key ([RevokeApiKeyDTO](../dto/revoke-api-key-dto.md); retained for audit). Returns `{ success: true }`.

### deleteKey(dto)

Permanently deletes a key ([DeleteApiKeyDTO](../dto/delete-api-key-dto.md)). Returns `{ success: true }`.

## Admin methods (target user by `sub`)

Protect these with admin authentication. They act on a user identified by `sub` and, for creation,
bypass `allowUserCreation`.

```typescript
await apiKeyService.adminCreateKey({ sub, expiresInDays: 90, allowedIps: ['203.0.113.0/24'] });
await apiKeyService.adminListKeys({ sub });
await apiKeyService.adminUpdateKey({ sub, keyId, allowedIps: ['203.0.113.5'] });
await apiKeyService.adminRevokeKey({ sub, keyId });
await apiKeyService.adminDeleteKey({ sub, keyId });
```

- `adminCreateKey(dto)` → [AdminCreateApiKeyDTO](../dto/admin-create-api-key-dto.md), returns `CreateApiKeyResponseDTO`
- `adminUpdateKey(dto)` → [AdminUpdateApiKeyDTO](../dto/admin-update-api-key-dto.md), returns `ApiKeyResponseDTO`
- `adminListKeys` / `adminRevokeKey` / `adminDeleteKey` → [AdminManageApiKeyDTO](../dto/admin-manage-api-key-dto.md)

## Validation (internal)

### validateKey(rawKey, callerIp?)

Validates a presented key by looking up its hash and resolves the owner. Throws a precise
`NAuthException` on failure (invalid/expired/IP-blocked) — used internally by the guard/handler.

```typescript
const { keyId, sub } = await apiKeyService.validateKey(rawKey, callerIp);
```

## Errors

`API_KEY_INVALID` · `API_KEY_EXPIRED` · `API_KEY_IP_NOT_ALLOWED` · `API_KEY_CREATION_DISABLED` · `API_KEY_LIMIT_REACHED` · `API_KEY_EXPIRY_REQUIRED` · `API_KEY_INDEFINITE_NOT_ALLOWED` · `API_KEY_EXPIRY_TOO_LONG` — see the [API Keys guide](../../../guides/api-keys.md#errors).
