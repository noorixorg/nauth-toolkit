# reCAPTCHA Quick Reference

**Quick copy-paste examples for common scenarios**

---

## NestJS Backend

### Basic Setup (Web Only)

```typescript
// app.module.ts
import { AuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

AuthModule.forRoot({
  jwt: { secret: process.env.JWT_SECRET!, algorithm: 'HS256' },
  tokenDelivery: { method: 'cookies' },
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV3Provider({
      secretKey: process.env.RECAPTCHA_SECRET_KEY!,
    }),
    enforceFor: ['cookies'],
    minimumScore: 0.5,
  },
})
```

### Hybrid Setup (Web + Mobile)

```typescript
AuthModule.forRoot({
  tokenDelivery: {
    method: 'hybrid',
    originMapping: {
      'https://app.example.com': 'cookies',
      'capacitor://localhost': 'json',
    },
  },
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV3Provider({
      secretKey: process.env.RECAPTCHA_SECRET_KEY!,
    }),
    enforceFor: ['cookies'], // Skip for mobile (JSON)
  },
})
```

### Controller (No Changes Needed!)

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto); // reCAPTCHA auto-validated
  }
}
```

### Controller with Overrides

```typescript
import { SkipRecaptcha, RequireRecaptcha } from '@nauth-toolkit/nestjs';

@Post('admin/login')
@SkipRecaptcha() // Skip for trusted endpoint
async adminLogin(@Body() dto: LoginDTO) { }

@Post('reset-password')
@RequireRecaptcha() // Force even for mobile
async resetPassword() { }
```

---

## Angular Frontend (NgModule)

### v3 Automatic (Recommended)

```typescript
// app.module.ts
import { NAuthModule } from '@nauth-toolkit/client-angular';

NAuthModule.forRoot({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  recaptcha: {
    enabled: true,
    version: 'v3',
    siteKey: '6Lc...your-site-key',
    autoLoadScript: true, // Lazy loads script
  },
})
```

```typescript
// login.component.ts
async onLogin() {
  // reCAPTCHA token auto-generated and sent
  await this.authService.login(this.email, this.password);
}
```

### v2 Manual (Checkbox)

```typescript
// app.module.ts
NAuthModule.forRoot({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  recaptcha: {
    enabled: true,
    version: 'v2',
    siteKey: '6Lc...your-site-key',
    manualChallenge: true, // Don't auto-inject
  },
})
```

```typescript
// login.component.ts
import { RecaptchaService } from '@nauth-toolkit/client-angular';

async ngAfterViewInit() {
  this.widgetId = await this.recaptchaService.renderV2('recaptcha-container');
}

async onLogin() {
  const token = this.recaptchaService.getResponseToken(this.widgetId);
  await this.authService.login(this.email, this.password, token);
}
```

```html
<!-- login.component.html -->
<div id="recaptcha-container"></div>
```

### Mobile (Capacitor)

```typescript
// app.module.ts - Mobile build
NAuthModule.forRoot({
  baseUrl: 'https://api.example.com/mobile/auth',
  tokenDelivery: 'json',
  recaptcha: {
    enabled: false, // Disabled for mobile
  },
})
```

```typescript
// login.component.ts - Same code as web!
async onLogin() {
  await this.authService.login(this.email, this.password);
}
```

---

## Environment Variables

```bash
# Backend .env
RECAPTCHA_SECRET_KEY=6Lc...your-secret-key
NODE_ENV=production

# Frontend environment.ts
export const environment = {
  recaptchaSiteKey: '6Lc...your-site-key',
};
```

---

## Error Handling

```typescript
try {
  await this.authService.login(email, password);
} catch (error: any) {
  if (error.code === 'RECAPTCHA_REQUIRED') {
    // Server requires reCAPTCHA but client doesn't have it
  } else if (error.code === 'RECAPTCHA_VALIDATION_FAILED') {
    // Token validation failed
  } else if (error.code === 'RECAPTCHA_SCORE_TOO_LOW') {
    // v3 score too low (likely bot)
  }
}
```

---

## Common Patterns

| Scenario | Backend Config | Frontend Config |
|----------|---------------|-----------------|
| **Web only** | `enforceFor: ['cookies']` | `version: 'v3'` |
| **Mobile only** | `enforceFor: []` | `enabled: false` |
| **Web + Mobile** | `enforceFor: ['cookies']` | Web: `enabled: true`, Mobile: `enabled: false` |
| **Admin (skip)** | Use `@SkipRecaptcha()` | Same as web |
| **High security** | Use `@RequireRecaptcha()` | Same as web |

---

## Migration from Existing App

**Zero breaking changes! Just add config:**

```typescript
// Before (still works)
AuthModule.forRoot({
  jwt: { ... },
  tokenDelivery: { ... },
  // No recaptcha config
})

// After (opt-in)
AuthModule.forRoot({
  jwt: { ... },
  tokenDelivery: { ... },
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV3Provider({ secretKey: '...' }),
    enforceFor: ['cookies'],
  },
})
```

No controller changes needed!

---

## Testing

```bash
# Backend
yarn workspace @nauth-toolkit/core test
yarn workspace @nauth-toolkit/recaptcha test

# Test login without token (should fail for web)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@test.com","password":"pass123"}'

# Test mobile endpoint (should work)
curl -X POST http://localhost:3000/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@test.com","password":"pass123"}'
```

---

## Get reCAPTCHA Keys

1. Visit: https://www.google.com/recaptcha/admin
2. Register your site
3. Choose v2 or v3
4. Get:
   - **Site Key** → Frontend config
   - **Secret Key** → Backend config
