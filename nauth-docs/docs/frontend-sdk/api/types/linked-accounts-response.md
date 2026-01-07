---
title: LinkedAccountsResponse
description: Response containing user's linked social authentication accounts
sidebar_position: 190
keywords: [social, linked, accounts, response, api]
image: /img/api-social-card.png
---

# LinkedAccountsResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response containing list of social authentication providers linked to the user's account.

```typescript
import { LinkedAccountsResponse } from '@nauth-toolkit/client';
```

## Properties

| Property    | Type               | Required | Description                    |
| ----------- | ------------------ | -------- | ------------------------------ |
| `providers` | `SocialProvider[]` | Yes      | Array of linked provider names |

## SocialProvider Type

`SocialProvider` is a type alias: `'google' | 'apple' | 'facebook'`

## Example

```json
{
  "providers": ["google", "apple"]
}
```

## Used By

- [NAuthClient.getLinkedAccounts()](../nauth-client#getlinkedaccounts) - Returns [`LinkedAccountsResponse`](./linked-accounts-response)

## Related Types

- [`SocialLoginOptions`](./social-login-options) - Web redirect-first options
