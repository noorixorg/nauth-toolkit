---
title: ClientInfoService
description: Service for accessing client information from request context. Provides transparent access to IP address, user agent, device info, and geolocation data.
sidebar_position: 11
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

## Methods

### get()

Get client information from the current request context.

```typescript
get(): GetClientInfoResponseDTO
```

**Response DTO:** [GetClientInfoResponseDTO](../dto/get-client-info-dto)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class MyService {
  constructor(private clientInfoService: ClientInfoService) {}

  async example() {
    const result = await this.clientInfoService.get();
    console.log('IP:', result.ipAddress);
    console.log('User Agent:', result.userAgent);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/example', async (req, res) => {
  const result = await nauth.clientInfoService.get();
  console.log('IP:', result.ipAddress);
  console.log('User Agent:', result.userAgent);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get('/example', nauth.adapter.wrapRouteHandler(async () => {
  const result = await nauth.clientInfoService.get();
  console.log('IP:', result.ipAddress);
  console.log('User Agent:', result.userAgent);
  return result;
}));
```

</TabItem>
</Tabs>

---

### getDeviceToken()

Get device token from the current request context. Convenience method for trusted device feature.

```typescript
getDeviceToken(): GetDeviceTokenResponseDTO
```

**Response DTO:** [GetDeviceTokenResponseDTO](../dto/get-device-token-response-dto)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.clientInfoService.getDeviceToken();
if (result.deviceToken) {
  // Device token is present
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.clientInfoService.getDeviceToken();
if (result.deviceToken) {
  // Device token is present
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.clientInfoService.getDeviceToken();
if (result.deviceToken) {
  // Device token is present
}
```

</TabItem>
</Tabs>

---

### getIpAddress()

Get IP address from the current request context. Convenience method to get just the IP address.

```typescript
getIpAddress(): GetIpAddressResponseDTO
```

**Response DTO:** [GetIpAddressResponseDTO](../dto/get-ip-address-response-dto)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.clientInfoService.getIpAddress();
console.log('IP:', result.ipAddress);
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.clientInfoService.getIpAddress();
console.log('IP:', result.ipAddress);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.clientInfoService.getIpAddress();
console.log('IP:', result.ipAddress);
```

</TabItem>
</Tabs>

---

### getSessionId()

Get session ID from the current request context. Convenience method for session ID (extracted from JWT token after authentication).

```typescript
getSessionId(): GetSessionIdResponseDTO
```

**Response DTO:** [GetSessionIdResponseDTO](../dto/get-session-id-response-dto)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.clientInfoService.getSessionId();
if (result.sessionId) {
  console.log('Session ID:', result.sessionId);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.clientInfoService.getSessionId();
if (result.sessionId) {
  console.log('Session ID:', result.sessionId);
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.clientInfoService.getSessionId();
if (result.sessionId) {
  console.log('Session ID:', result.sessionId);
}
```

</TabItem>
</Tabs>

---

### getUserAgent()

Get user agent from the current request context. Convenience method to get just the user agent string.

```typescript
getUserAgent(): GetUserAgentResponseDTO
```

**Response DTO:** [GetUserAgentResponseDTO](../dto/get-user-agent-response-dto)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.clientInfoService.getUserAgent();
console.log('User Agent:', result.userAgent);
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.clientInfoService.getUserAgent();
console.log('User Agent:', result.userAgent);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.clientInfoService.getUserAgent();
console.log('User Agent:', result.userAgent);
```

</TabItem>
</Tabs>

---

## Related APIs

- [DTOs Overview](../dto/overview) - All available DTOs
