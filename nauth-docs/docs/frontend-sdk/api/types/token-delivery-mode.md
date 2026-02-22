---
title: TokenDeliveryMode
description: Type alias for token delivery modes (json or cookies)
keywords: [token, delivery, mode, type, api]
image: /img/api-social-card.png
---

# TokenDeliveryMode

**Package:** `@nauth-toolkit/client`
**Type:** Type Alias

Type alias for token delivery modes. Determines how tokens are exchanged between client and server.

```typescript
import { TokenDeliveryMode } from '@nauth-toolkit/client';
```

## Values

| Value       | Description                                          | Use Case           |
| ----------- | ---------------------------------------------------- | ------------------ |
| `'cookies'` | Tokens stored in HTTP-only cookies by backend        | Web applications   |
| `'json'`    | Tokens returned in response body, stored client-side | Mobile/native apps |

## Example

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies', // or 'json'
  onSessionExpired: () => {},
});
```

## Token Delivery Details

### Cookies Mode

- Tokens stored in HTTP-only cookies (server-managed)
- Requires `withCredentials: true` in requests
- CSRF protection required
- Most secure for web browsers

### JSON Mode

- Tokens returned in response body
- Stored in provided storage adapter
- Sent via `Authorization: Bearer` header
- Required for mobile/native apps

:::info Hybrid Backend
"Hybrid" is a backend deployment pattern, not a frontend mode. When your backend supports both web and mobile, it exposes separate endpoints. The frontend chooses ONE mode based on the platform.
:::

## Used By

- [NAuthClientConfig](../nauth-client-config) - `tokenDelivery` property uses [`TokenDeliveryMode`](./token-delivery-mode)

## Related Types

- [`NAuthClientConfig`](../nauth-client-config) - Client configuration
- [Token Management](../../concepts/token-management) - Complete token management guide
