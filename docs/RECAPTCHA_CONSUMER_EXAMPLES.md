# reCAPTCHA Consumer App Examples

**Date:** 2026-01-19  
**Purpose:** Show real-world usage in NestJS backend and Angular frontend

---

## Table of Contents

1. [NestJS Backend Examples](#nestjs-backend-examples)
2. [Angular NgModule Frontend Examples](#angular-ngmodule-frontend-examples)
3. [Complete Full-Stack Example](#complete-full-stack-example)

---

## NestJS Backend Examples

### Example 1: Basic Web App (Cookies, v3 reCAPTCHA)

**File:** `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { AuthController } from './auth/auth.controller';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: getNAuthEntities(),
      synchronize: false,
    }),

    // Authentication with reCAPTCHA
    AuthModule.forRoot({
      jwt: {
        secret: process.env.JWT_SECRET!,
        algorithm: 'HS256',
      },
      tokenDelivery: {
        method: 'cookies',
      },
      emailProvider: new NodemailerEmailProvider({
        transport: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        defaults: {
          from: process.env.EMAIL_FROM,
        },
      }),
      
      // ============================================================================
      // reCAPTCHA Configuration
      // ============================================================================
      recaptcha: {
        enabled: true,
        provider: new RecaptchaV3Provider({
          secretKey: process.env.RECAPTCHA_SECRET_KEY!,
        }),
        // Enforce for web (cookies), skip for mobile (JSON)
        enforceFor: ['cookies'],
        minimumScore: 0.5,
        skipInDevelopment: process.env.NODE_ENV !== 'production',
      },
    }),
  ],
  controllers: [AppController, AuthController],
})
export class AppModule {}
```

**File:** `src/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { LoginDTO, SignupDTO, AuthResponse } from '@nauth-toolkit/core';
import { AuthGuard } from '@nauth-toolkit/nestjs';

/**
 * Authentication controller
 * 
 * reCAPTCHA is automatically validated based on config.
 * No changes needed to existing controllers!
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * User signup
   * 
   * reCAPTCHA automatically enforced for cookies mode (web).
   * Token expected in dto.recaptchaToken field.
   */
  @Post('signup')
  async signup(@Body() dto: SignupDTO): Promise<AuthResponse> {
    // reCAPTCHA validation happens automatically in authService.signup()
    return this.authService.signup(dto);
  }

  /**
   * User login
   * 
   * reCAPTCHA automatically enforced for cookies mode (web).
   */
  @Post('login')
  async login(@Body() dto: LoginDTO): Promise<AuthResponse> {
    // reCAPTCHA validation happens automatically in authService.login()
    return this.authService.login(dto);
  }

  /**
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile() {
    return this.authService.getCurrentUser();
  }
}
```

**File:** `.env`

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=myapp

# JWT
JWT_SECRET=your-secret-key-change-in-production

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=My App <noreply@myapp.com>

# Google reCAPTCHA v3
RECAPTCHA_SECRET_KEY=6Lc...your-secret-key

# Environment
NODE_ENV=development
```

---

### Example 2: Hybrid Backend (Web + Mobile)

**File:** `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

@Module({
  imports: [
    AuthModule.forRoot({
      jwt: {
        secret: process.env.JWT_SECRET!,
        algorithm: 'HS256',
      },
      
      // Hybrid token delivery
      tokenDelivery: {
        method: 'hybrid',
        hybridPolicy: 'origin-based',
        originMapping: {
          'https://app.example.com': 'cookies',        // Web app
          'https://admin.example.com': 'cookies',      // Admin panel
          'capacitor://localhost': 'json',             // Mobile app
          'ionic://localhost': 'json',                 // Mobile app
        },
      },
      
      // reCAPTCHA: Skip for mobile (JSON), enforce for web (cookies)
      recaptcha: {
        enabled: true,
        provider: new RecaptchaV3Provider({
          secretKey: process.env.RECAPTCHA_SECRET_KEY!,
        }),
        enforceFor: ['cookies'], // Only web endpoints
        minimumScore: 0.5,
      },
    }),
  ],
  controllers: [WebAuthController, MobileAuthController],
})
export class AppModule {}
```

**File:** `src/auth/web-auth.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { LoginDTO, SignupDTO } from '@nauth-toolkit/core';

/**
 * Web authentication endpoints
 * 
 * Uses cookies delivery → reCAPTCHA enforced automatically
 */
@Controller('auth')
export class WebAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDTO) {
    // reCAPTCHA required (cookies mode)
    return this.authService.signup(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDTO) {
    // reCAPTCHA required (cookies mode)
    return this.authService.login(dto);
  }
}
```

**File:** `src/auth/mobile-auth.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { LoginDTO, SignupDTO } from '@nauth-toolkit/core';
import { TokenDelivery } from '@nauth-toolkit/nestjs';

/**
 * Mobile authentication endpoints
 * 
 * Uses JSON delivery → reCAPTCHA skipped automatically
 */
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @TokenDelivery('json') // Triggers auto-skip for reCAPTCHA
  async signup(@Body() dto: SignupDTO) {
    // reCAPTCHA skipped (JSON mode)
    return this.authService.signup(dto);
  }

  @Post('login')
  @TokenDelivery('json')
  async login(@Body() dto: LoginDTO) {
    // reCAPTCHA skipped (JSON mode)
    return this.authService.login(dto);
  }
}
```

---

### Example 3: Advanced - Custom reCAPTCHA Rules

**File:** `src/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { 
  LoginDTO, 
  SignupDTO,
  SkipRecaptcha,
  RequireRecaptcha,
} from '@nauth-toolkit/core';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Public signup - reCAPTCHA enforced (default)
   */
  @Post('signup')
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  /**
   * Login - reCAPTCHA enforced (default)
   */
  @Post('login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  /**
   * Admin login - Skip reCAPTCHA (trusted network/VPN)
   * 
   * Use case: Internal admin panel, IP-restricted
   */
  @Post('admin/login')
  @SkipRecaptcha() // Explicit skip
  async adminLogin(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  /**
   * High-risk endpoint - Force reCAPTCHA even for mobile
   * 
   * Use case: Password reset, account recovery
   */
  @Post('reset-password')
  @RequireRecaptcha() // Force even if config says skip
  async resetPassword(@Body() dto: { email: string; recaptchaToken?: string }) {
    return this.authService.forgotPassword({ email: dto.email });
  }

  /**
   * Beta signup - Skip reCAPTCHA for invited users
   * 
   * Use case: Invite-only beta, no bots expected
   */
  @Post('beta/signup')
  @SkipRecaptcha()
  async betaSignup(@Body() dto: SignupDTO & { inviteCode: string }) {
    // Validate invite code first
    await this.validateInviteCode(dto.inviteCode);
    return this.authService.signup(dto);
  }

  private async validateInviteCode(code: string): Promise<void> {
    // Custom validation logic
  }
}
```

---

### Example 4: reCAPTCHA v2 (Checkbox)

**File:** `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';

@Module({
  imports: [
    AuthModule.forRoot({
      jwt: {
        secret: process.env.JWT_SECRET!,
        algorithm: 'HS256',
      },
      tokenDelivery: {
        method: 'cookies',
      },
      
      // reCAPTCHA v2 (checkbox)
      recaptcha: {
        enabled: true,
        provider: new RecaptchaV2Provider({
          secretKey: process.env.RECAPTCHA_V2_SECRET_KEY!,
        }),
        enforceFor: ['cookies'],
      },
    }),
  ],
})
export class AppModule {}
```

---

## Angular NgModule Frontend Examples

### Example 1: Web App with v3 (Automatic)

**File:** `src/app/app.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NAuthModule } from '@nauth-toolkit/client-angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './auth/login.component';
import { SignupComponent } from './auth/signup.component';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SignupComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    
    // ============================================================================
    // nauth-toolkit with reCAPTCHA v3 (Automatic)
    // ============================================================================
    NAuthModule.forRoot({
      baseUrl: environment.apiUrl,
      tokenDelivery: 'cookies',
      
      // reCAPTCHA v3 - Invisible, automatic token generation
      recaptcha: {
        enabled: true,
        version: 'v3',
        siteKey: environment.recaptchaSiteKey,
        action: 'auth', // Optional, can be overridden per-action
        autoLoadScript: true, // Load Google script on-demand
      },
      
      redirects: {
        loginSuccess: '/dashboard',
        signupSuccess: '/onboarding',
        sessionExpired: '/login',
      },
    }),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

**File:** `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/auth',
  
  // Google reCAPTCHA v3 (get from https://www.google.com/recaptcha/admin)
  recaptchaSiteKey: '6Lc...your-site-key',
};
```

**File:** `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.myapp.com/auth',
  recaptchaSiteKey: '6Lc...your-production-site-key',
};
```

**File:** `src/app/auth/login.component.ts`

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  /**
   * Handle login
   * 
   * reCAPTCHA token automatically generated and sent!
   * No additional code needed.
   */
  async onLogin(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // reCAPTCHA v3 token auto-generated in background
      await this.authService.login(this.email, this.password);
      
      // Success - redirect handled by NAuthModule config
      // Or handle manually:
      // this.router.navigate(['/dashboard']);
      
    } catch (error: any) {
      this.loading = false;
      
      // Handle reCAPTCHA errors
      if (error.code === 'RECAPTCHA_VALIDATION_FAILED') {
        this.errorMessage = 'Security verification failed. Please try again.';
      } else if (error.code === 'RECAPTCHA_SCORE_TOO_LOW') {
        this.errorMessage = 'Suspicious activity detected. Please contact support.';
      } else {
        this.errorMessage = error.message || 'Login failed';
      }
    }
  }
}
```

**File:** `src/app/auth/login.component.html`

```html
<div class="login-container">
  <h1>Login</h1>
  
  <form (ngSubmit)="onLogin()">
    <div class="form-group">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        [(ngModel)]="email"
        name="email"
        required
        [disabled]="loading"
      />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        [(ngModel)]="password"
        name="password"
        required
        [disabled]="loading"
      />
    </div>

    <div *ngIf="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 
      No reCAPTCHA checkbox needed for v3!
      Token generated automatically in background
    -->

    <button type="submit" [disabled]="loading">
      {{ loading ? 'Logging in...' : 'Login' }}
    </button>
  </form>

  <p class="recaptcha-notice">
    This site is protected by reCAPTCHA and the Google
    <a href="https://policies.google.com/privacy">Privacy Policy</a> and
    <a href="https://policies.google.com/terms">Terms of Service</a> apply.
  </p>
</div>
```

**File:** `src/app/auth/signup.component.ts`

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@nauth-toolkit/client-angular';
import { SignupRequest } from '@nauth-toolkit/client';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
})
export class SignupComponent {
  formData: SignupRequest = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  };
  errorMessage = '';
  loading = false;

  constructor(private authService: AuthService) {}

  /**
   * Handle signup
   * 
   * reCAPTCHA token automatically included
   */
  async onSignup(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // reCAPTCHA v3 token auto-generated with action: 'signup'
      await this.authService.signup(this.formData);
      
      // Success - redirect or show verification message
      
    } catch (error: any) {
      this.loading = false;
      this.errorMessage = error.message || 'Signup failed';
    }
  }
}
```

---

### Example 2: Web App with v2 (Manual Checkbox)

**File:** `src/app/app.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { NAuthModule } from '@nauth-toolkit/client-angular';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    // ... other imports
    
    NAuthModule.forRoot({
      baseUrl: environment.apiUrl,
      tokenDelivery: 'cookies',
      
      // reCAPTCHA v2 - Manual checkbox
      recaptcha: {
        enabled: true,
        version: 'v2',
        siteKey: environment.recaptchaSiteKey,
        manualChallenge: true, // Don't auto-inject, let component handle
        autoLoadScript: true,
      },
    }),
  ],
})
export class AppModule {}
```

**File:** `src/app/auth/login.component.ts`

```typescript
import { Component, AfterViewInit } from '@angular/core';
import { AuthService, RecaptchaService } from '@nauth-toolkit/client-angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent implements AfterViewInit {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  private recaptchaWidgetId?: number;

  constructor(
    private authService: AuthService,
    private recaptchaService: RecaptchaService,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    // Render reCAPTCHA v2 checkbox
    if (this.recaptchaService.isEnabled()) {
      this.recaptchaWidgetId = await this.recaptchaService.renderV2(
        'recaptcha-container'
      );
    }
  }

  async onLogin(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // Get token from checkbox
      const recaptchaToken = this.recaptchaService.getResponseToken(
        this.recaptchaWidgetId
      );

      if (!recaptchaToken) {
        this.errorMessage = 'Please complete the reCAPTCHA challenge';
        this.loading = false;
        return;
      }

      // Pass token explicitly
      await this.authService.login(this.email, this.password, recaptchaToken);
      
      // Success - reset checkbox for next attempt if failed
      
    } catch (error: any) {
      this.loading = false;
      this.errorMessage = error.message || 'Login failed';
      
      // Reset reCAPTCHA checkbox
      this.recaptchaService.reset(this.recaptchaWidgetId);
    }
  }
}
```

**File:** `src/app/auth/login.component.html`

```html
<div class="login-container">
  <h1>Login</h1>
  
  <form (ngSubmit)="onLogin()">
    <div class="form-group">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        [(ngModel)]="email"
        name="email"
        required
      />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        [(ngModel)]="password"
        name="password"
        required
      />
    </div>

    <!-- reCAPTCHA v2 checkbox renders here -->
    <div id="recaptcha-container" class="recaptcha-box"></div>

    <div *ngIf="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <button type="submit" [disabled]="loading">
      {{ loading ? 'Logging in...' : 'Login' }}
    </button>
  </form>
</div>
```

---

### Example 3: Capacitor Mobile App

**File:** `src/app/app.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { NAuthModule } from '@nauth-toolkit/client-angular';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    // ... other imports
    
    NAuthModule.forRoot({
      // Mobile API endpoint (JSON delivery)
      baseUrl: environment.apiUrl,
      tokenDelivery: 'json', // Mobile uses JSON
      
      // reCAPTCHA disabled for native mobile
      // Platform detection will auto-skip in Capacitor native mode
      recaptcha: {
        enabled: false, // Disabled for mobile
      },
      
      storage: undefined, // Use default (localStorage)
    }),
  ],
})
export class AppModule {}
```

**File:** `src/environments/environment.ts` (Mobile)

```typescript
export const environment = {
  production: false,
  // Mobile backend uses JSON delivery (no reCAPTCHA required)
  apiUrl: 'http://localhost:3000/mobile/auth',
};
```

**File:** `src/app/auth/login.component.ts` (Mobile)

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@nauth-toolkit/client-angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(private authService: AuthService) {}

  /**
   * Mobile login - no reCAPTCHA
   * 
   * Backend automatically skips reCAPTCHA for JSON delivery
   */
  async onLogin(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // No reCAPTCHA token - mobile apps use device attestation
      await this.authService.login(this.email, this.password);
      
    } catch (error: any) {
      this.loading = false;
      this.errorMessage = error.message || 'Login failed';
    }
  }
}
```

---

## Complete Full-Stack Example

### Scenario: E-commerce Platform
- **Web:** Public website with login/signup (reCAPTCHA v3)
- **Mobile:** iOS/Android app (Capacitor, no reCAPTCHA)
- **Admin:** Internal admin panel (reCAPTCHA optional, IP-restricted)

---

### Backend Structure

```
backend/
├── src/
│   ├── app.module.ts           # Main module with reCAPTCHA config
│   ├── auth/
│   │   ├── web-auth.controller.ts      # Public web endpoints
│   │   ├── mobile-auth.controller.ts   # Mobile endpoints
│   │   └── admin-auth.controller.ts    # Admin endpoints
│   └── ...
├── .env
└── package.json
```

**File:** `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot(),
    
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: getNAuthEntities(),
      synchronize: false,
    }),

    AuthModule.forRoot({
      jwt: {
        secret: process.env.JWT_SECRET!,
        algorithm: 'HS256',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
      },
      
      // Hybrid delivery for web + mobile
      tokenDelivery: {
        method: 'hybrid',
        hybridPolicy: 'origin-based',
        originMapping: {
          'https://shop.myapp.com': 'cookies',      // Public website
          'https://admin.myapp.com': 'cookies',     // Admin panel
          'capacitor://localhost': 'json',          // Mobile app
          'ionic://localhost': 'json',
        },
      },
      
      // Redis for rate limiting (production)
      storageAdapter: new RedisStorageAdapter(
        new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        })
      ),
      
      // Email notifications
      emailProvider: new NodemailerEmailProvider({
        transport: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        defaults: {
          from: process.env.EMAIL_FROM,
        },
      }),
      
      // reCAPTCHA v3 for web only
      recaptcha: {
        enabled: true,
        provider: new RecaptchaV3Provider({
          secretKey: process.env.RECAPTCHA_SECRET_KEY!,
        }),
        enforceFor: ['cookies'], // Web only, mobile exempt
        minimumScore: 0.5,
        skipInDevelopment: process.env.NODE_ENV !== 'production',
      },
      
      // Security
      security: {
        csrf: {
          enabled: true,
          excludedPaths: ['/auth/mobile'],
        },
      },
      
      // Account lockout
      lockout: {
        maxAttempts: 5,
        lockoutDuration: 900, // 15 minutes
      },
    }),
  ],
})
export class AppModule {}
```

**File:** `backend/src/auth/web-auth.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { LoginDTO, SignupDTO } from '@nauth-toolkit/core';

@Controller('auth')
export class WebAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDTO) {
    // reCAPTCHA enforced (cookies mode)
    return this.authService.signup(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDTO) {
    // reCAPTCHA enforced (cookies mode)
    return this.authService.login(dto);
  }
}
```

**File:** `backend/src/auth/mobile-auth.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { LoginDTO, SignupDTO } from '@nauth-toolkit/core';
import { TokenDelivery } from '@nauth-toolkit/nestjs';

@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @TokenDelivery('json')
  async signup(@Body() dto: SignupDTO) {
    // reCAPTCHA skipped (JSON mode)
    return this.authService.signup(dto);
  }

  @Post('login')
  @TokenDelivery('json')
  async login(@Body() dto: LoginDTO) {
    // reCAPTCHA skipped (JSON mode)
    return this.authService.login(dto);
  }
}
```

**File:** `backend/src/auth/admin-auth.controller.ts`

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';
import { LoginDTO } from '@nauth-toolkit/core';
import { SkipRecaptcha } from '@nauth-toolkit/nestjs';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @SkipRecaptcha() // Admin panel is IP-restricted
  async adminLogin(@Body() dto: LoginDTO) {
    // Additional admin checks here
    return this.authService.login(dto);
  }
}
```

---

### Frontend Structure (Web)

```
frontend-web/
├── src/
│   ├── app/
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   │   ├── login.component.ts
│   │   │   ├── signup.component.ts
│   │   │   └── ...
│   │   └── ...
│   └── environments/
│       ├── environment.ts
│       └── environment.prod.ts
└── package.json
```

**File:** `frontend-web/src/app/app.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NAuthModule } from '@nauth-toolkit/client-angular';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    
    NAuthModule.forRoot({
      baseUrl: environment.apiUrl,
      tokenDelivery: 'cookies',
      
      // reCAPTCHA v3 automatic
      recaptcha: {
        enabled: true,
        version: 'v3',
        siteKey: environment.recaptchaSiteKey,
        autoLoadScript: true,
      },
      
      redirects: {
        loginSuccess: '/shop',
        signupSuccess: '/welcome',
      },
    }),
  ],
})
export class AppModule {}
```

**File:** `frontend-web/src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.myapp.com/auth',
  recaptchaSiteKey: '6Lc...production-site-key',
};
```

---

### Frontend Structure (Mobile)

```
frontend-mobile/
├── src/
│   ├── app/
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   │   ├── login.component.ts
│   │   │   └── ...
│   │   └── ...
│   └── environments/
│       └── environment.ts
├── capacitor.config.ts
└── package.json
```

**File:** `frontend-mobile/src/app/app.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { NAuthModule } from '@nauth-toolkit/client-angular';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    NAuthModule.forRoot({
      baseUrl: environment.apiUrl,
      tokenDelivery: 'json', // Mobile uses JSON
      
      // reCAPTCHA disabled for mobile
      recaptcha: {
        enabled: false,
      },
    }),
  ],
})
export class AppModule {}
```

**File:** `frontend-mobile/src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/mobile/auth',
};
```

---

## Testing the Implementation

### Backend Tests

```bash
# Start backend
cd backend
yarn install
yarn start:dev

# Test web endpoint (requires reCAPTCHA)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}'
# Expected: 401 RECAPTCHA_REQUIRED

# Test mobile endpoint (no reCAPTCHA)
curl -X POST http://localhost:3000/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}'
# Expected: 200 OK (or invalid credentials)
```

### Frontend Tests

```bash
# Web app
cd frontend-web
yarn install
yarn start
# Navigate to http://localhost:4200/login
# reCAPTCHA script loads automatically

# Mobile app
cd frontend-mobile
yarn install
npx cap sync
npx cap open ios  # or android
# No reCAPTCHA in mobile app
```

---

## Summary

### Key Takeaways:

1. **Backend:**
   - Single config in `app.module.ts`
   - No changes to existing controllers
   - Use decorators for edge cases: `@SkipRecaptcha()`, `@RequireRecaptcha()`
   - Automatic detection based on token delivery mode

2. **Frontend (Web):**
   - v3: Zero code changes in components
   - v2: Manual checkbox rendering in component
   - Config in `app.module.ts`
   - Error handling in catch blocks

3. **Frontend (Mobile):**
   - Disable reCAPTCHA in config
   - Backend automatically skips for JSON delivery
   - No code changes in components

4. **Backward Compatible:**
   - Existing apps work without any changes
   - Opt-in via config
   - No breaking changes
