---
title: ClientInfoService
description: Service for accessing client information from request context. Provides transparent access to IP address, user agent, device info, and geolocation data.
keywords: [client, info, ip, user-agent, device, service, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ClientInfoService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Service for accessing client information (IP address, user agent, device info) from the current request context using async local storage.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ClientInfoService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ClientInfoService } from '@nauth-toolkit/core';
// Access via nauth.clientInfoService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ClientInfoService } from '@nauth-toolkit/core';
// Access via nauth.clientInfoService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

The `ClientInfoService` provides transparent access to client metadata that was automatically extracted by framework interceptors and stored in async local storage. This eliminates the need to pass IP addresses and user agents as parameters to authentication methods.

:::note
Auto-injected by framework. No manual instantiation required.
:::

:::warning
This service must be called within the context of an HTTP request. If called outside a request context (e.g., cron jobs, CLI), it will return default values with 'unknown' fields.
:::

:::info Geolocation Data (IP Country, City, Coordinates)
Optional geolocation fields (`ipCountry`, `ipCity`, `ipLatitude`, `ipLongitude`) are only populated when MaxMind GeoIP2 is configured. See the [Geolocation guide](/docs/features/geolocation) for setup instructions.
:::

## Methods

### get()

Get complete client information from the current request context. Returns all available client metadata including IP address, user agent, device info, and optional geolocation data.

```typescript
get(): GetClientInfoResponseDTO
```

**Returns**

- [`GetClientInfoResponseDTO`](../dto/get-client-info-dto) - Contains:
  - `ipAddress: string` - Client IP address (or 'unknown' if no context)
  - `userAgent: string` - User agent string (or 'unknown' if no context)
  - `deviceToken?: string` - Device token for trusted device feature (optional)
  - `deviceName?: string` - Device name (optional)
  - `deviceType?: 'mobile' | 'desktop' | 'tablet'` - Device type (optional)
  - `ipCountry?: string` - IP country from geolocation (optional, requires [MaxMind configuration](/docs/features/geolocation))
  - `ipCity?: string` - IP city from geolocation (optional, requires [MaxMind configuration](/docs/features/geolocation))
  - `ipLatitude?: number` - IP latitude (optional, requires [MaxMind configuration](/docs/features/geolocation))
  - `ipLongitude?: number` - IP longitude (optional, requires [MaxMind configuration](/docs/features/geolocation))
  - `platform?: string` - Platform extracted from user agent (optional)
  - `browser?: string` - Browser extracted from user agent (optional)
  - `sessionId?: number` - Session ID from JWT token (optional, only after authentication)
  - `userId?: number` - User ID from JWT token (optional, only after authentication)

**Behavior**

- If called within an HTTP request context: Returns client info extracted by framework interceptors
- If called outside request context (e.g., cron jobs, CLI): Returns `{ ipAddress: 'unknown', userAgent: 'unknown' }`

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class MyService {
  constructor(private clientInfoService: ClientInfoService) {}

  async example() {
    const result = this.clientInfoService.get();
    console.log('IP:', result.ipAddress);
    console.log('User Agent:', result.userAgent);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/example', async (req, res) => {
  const result = nauth.clientInfoService.get();
  console.log('IP:', result.ipAddress);
  console.log('User Agent:', result.userAgent);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/example',
  nauth.adapter.wrapRouteHandler(async () => {
    const result = nauth.clientInfoService.get();
    console.log('IP:', result.ipAddress);
    console.log('User Agent:', result.userAgent);
    return result;
  }),
);
```

</TabItem>
</Tabs>

---

### getDeviceToken()

Get device token from the current request context. Convenience method for trusted device feature.

```typescript
getDeviceToken(): GetDeviceTokenResponseDTO
```

**Returns**

- [`GetDeviceTokenResponseDTO`](../dto/get-device-token-response-dto) - Contains `{ deviceToken?: string }`

**Behavior**

- Device token is extracted from cookie (`nauth_device_token`) or header (`X-Device-Token`)
- Returns `undefined` if device token is not present

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = this.clientInfoService.getDeviceToken();
if (result.deviceToken) {
  // Device token is present
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = nauth.clientInfoService.getDeviceToken();
if (result.deviceToken) {
  // Device token is present
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = nauth.clientInfoService.getDeviceToken();
if (result.deviceToken) {
  // Device token is present
}
```

</TabItem>
</Tabs>

---

### getIpAddress()

Get IP address from the current request context. Convenience method to get just the IP address without the full ClientInfo object.

```typescript
getIpAddress(): GetIpAddressResponseDTO
```

**Returns**

- [`GetIpAddressResponseDTO`](../dto/get-ip-address-response-dto) - Contains `{ ipAddress: string }`

**Behavior**

- IP address is extracted from `X-Forwarded-For`, `CF-Connecting-IP`, or similar headers
- Automatically handles proxies and load balancers
- Returns `'unknown'` if called outside request context

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = this.clientInfoService.getIpAddress();
console.log('IP:', result.ipAddress);
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = nauth.clientInfoService.getIpAddress();
console.log('IP:', result.ipAddress);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = nauth.clientInfoService.getIpAddress();
console.log('IP:', result.ipAddress);
```

</TabItem>
</Tabs>

---

### getSessionId()

Get session ID from the current request context. Convenience method for session ID extracted from JWT token after authentication.

```typescript
getSessionId(): GetSessionIdResponseDTO
```

**Returns**

- [`GetSessionIdResponseDTO`](../dto/get-session-id-response-dto) - Contains `{ sessionId?: number }`

**Behavior**

- Session ID is extracted from JWT token payload after authentication
- Returns `undefined` if session ID is not available (e.g., unauthenticated request)

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = this.clientInfoService.getSessionId();
if (result.sessionId) {
  console.log('Session ID:', result.sessionId);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = nauth.clientInfoService.getSessionId();
if (result.sessionId) {
  console.log('Session ID:', result.sessionId);
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = nauth.clientInfoService.getSessionId();
if (result.sessionId) {
  console.log('Session ID:', result.sessionId);
}
```

</TabItem>
</Tabs>

---

### getUserAgent()

Get user agent from the current request context. Convenience method to get just the user agent string without the full ClientInfo object.

```typescript
getUserAgent(): GetUserAgentResponseDTO
```

**Returns**

- [`GetUserAgentResponseDTO`](../dto/get-user-agent-response-dto) - Contains `{ userAgent: string }`

**Behavior**

- User agent is extracted from the HTTP request headers
- Returns `'unknown'` if called outside request context

**Errors**

Errors: None. This method never throws errors.

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = this.clientInfoService.getUserAgent();
console.log('User Agent:', result.userAgent);
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = nauth.clientInfoService.getUserAgent();
console.log('User Agent:', result.userAgent);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = nauth.clientInfoService.getUserAgent();
console.log('User Agent:', result.userAgent);
```

</TabItem>
</Tabs>

---

## Related APIs

- [DTOs Overview](../dto/overview) - All available DTOs
