---
title: SetPreferredDeviceDTO
description: DTO for setting a user's preferred MFA device
sidebar_position: 90
---

# SetPreferredDeviceDTO

DTO for setting a user's preferred MFA device. This updates which specific device is used by default during MFA challenges.

## Properties

### deviceId

```typescript
deviceId: number
```

MFA device ID to set as preferred.

**Validation:**
- Must be a positive integer
- Automatically converted from string (useful for path parameters)

**Example:**
```typescript
{ deviceId: 123 }
```

## Response

### SetPreferredDeviceResponseDTO

```typescript
{
  message: string
}
```

Success message confirming the preferred device was updated.

**Example:**
```typescript
{
  message: "Preferred MFA device updated"
}
```

## Usage

### NestJS

```typescript
@Post('mfa/devices/:deviceId/preferred')
@HttpCode(HttpStatus.OK)
async setPreferredDevice(@Param() dto: SetPreferredDeviceDTO) {
  return await this.mfaService.setPreferredDevice(dto);
}
```

### Express

```typescript
app.post('/mfa/devices/:deviceId/preferred', requireAuth(), async (req, res) => {
  const result = await nauth.mfaService.setPreferredDevice({
    deviceId: parseInt(req.params.deviceId),
  });
  res.json(result);
});
```

### Fastify

```typescript
fastify.post(
  '/mfa/devices/:deviceId/preferred',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    return nauth.mfaService.setPreferredDevice({
      deviceId: parseInt(req.params.deviceId),
    });
  }),
);
```

## Frontend SDK

### @nauth-toolkit/client

```typescript
// Set preferred MFA device
await client.setPreferredMfaDevice(deviceId);
```

### @nauth-toolkit/client-angular

```typescript
// Inject AuthService
constructor(private auth: AuthService) {}

// Set preferred device
await this.auth.setPreferredMfaDevice(deviceId);
```

## Validation

The DTO performs the following validations:

- `deviceId` must be an integer
- `deviceId` must be positive (greater than 0)
- String values are automatically converted to numbers (path params)

## Errors

| Code            | When                                         | Details                                  |
| --------------- | -------------------------------------------- | ---------------------------------------- |
| `NOT_FOUND`     | Device does not exist or doesn't belong to user | `{ deviceId: number }`                |
| `VALIDATION_FAILED` | Invalid deviceId (not an integer or negative) | `{ validationErrors: {...} }`         |

### Example Error Handling

```typescript
try {
  await this.mfaService.setPreferredDevice({ deviceId });
} catch (error) {
  if (error instanceof NAuthException) {
    if (error.code === AuthErrorCode.NOT_FOUND) {
      console.log('MFA device not found');
    }
  }
}
```

## Behavior

When a device is set as preferred:

1. The device's `isPrimary` flag is set to `true`
2. All other devices for the user have `isPrimary` set to `false`
3. The user's `preferredMfaMethod` is updated to match the device's method
4. During login, this device is auto-selected for MFA challenges
5. Frontend displays a "Preferred" badge on this device

## Use Cases

- **Multiple TOTP devices**: User has "Google Authenticator" and "Microsoft Authenticator", prefers one
- **Multiple passkeys**: User has phone, laptop, and security key registered, prefers phone
- **User preference**: Allow users to choose which device is used by default during login

## Related

- [MFAService.setPreferredDevice()](../services/mfa-service#setpreferreddevice)
- [RemoveDeviceDTO](./remove-device-dto) - Remove individual devices
- [GetUserDevicesDTO](./get-user-devices-dto) - List user's MFA devices
