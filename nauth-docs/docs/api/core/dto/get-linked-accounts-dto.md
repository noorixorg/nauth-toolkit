---
title: GetLinkedAccountsDTO
description: Request DTO for getting linked social accounts. User is resolved from authenticated JWT context — no body fields required.
keywords: [social, auth, dto, request, accounts, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetLinkedAccountsDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting linked social accounts. This class has no body fields — the user is resolved from the authenticated JWT context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

This DTO has no request body fields. The user's identity is resolved from the authenticated JWT token.

## Example

```json
{}
```

## Used By

- [SocialAuthService.getLinkedAccounts()](../services/social-auth-service#getlinkedaccounts)

