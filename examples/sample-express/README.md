# NAuth Toolkit - Express Example

Express.js example application demonstrating nauth-toolkit integration.

## Features

- Complete authentication system using `@nauth-toolkit/express`
- Email/password authentication
- Email and phone verification
- Multi-factor authentication (TOTP, SMS, Email, Passkey)
- Social login (Google, Apple, Facebook)
- Session management with device tracking
- CSRF protection
- Rate limiting
- Adaptive MFA (risk-based authentication)

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis server (for session storage)
- SMTP server (for email)

## Installation

```bash
# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
```

## Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE nauth_db;
```

2. Run the application (it will auto-sync tables in development):
```bash
yarn start:dev
```

## Configuration

Edit `src/config/auth.config.ts` to customize:

- JWT settings
- Token delivery mode (JSON, cookies, hybrid)
- MFA enforcement
- Session policies
- Email/SMS providers
- Social auth providers

## Running

```bash
# Development mode with auto-reload
yarn start:dev

# Production build
yarn build
yarn start
```

## API Endpoints

### Public Endpoints

- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/respond-challenge` - Complete verification challenges
- `POST /auth/refresh` - Refresh access token
- `POST /auth/password/reset-request` - Request password reset
- `POST /auth/password/reset` - Reset password

### Protected Endpoints

- `GET /auth/profile` - Get current user
- `POST /auth/logout` - Logout
- `POST /auth/password/change` - Change password

### Social Auth Endpoints

- `GET /auth/social/google` - Get Google OAuth URL
- `POST /auth/social/google/callback` - Google OAuth callback
- `POST /auth/social/google/verify` - Verify Google token (mobile)

## Key Differences from NestJS

This example demonstrates how to use nauth-toolkit with pure Express:

1. **No Decorators** - Use middleware helpers instead:
   ```typescript
   // Mark route as public
   router.post('/signup', nauth.helpers.public(), handler);

   // Require authentication
   router.get('/profile', nauth.helpers.requireAuth(), handler);

   // Override token delivery
   router.post('/login', nauth.helpers.tokenDelivery('cookies'), handler);
   ```

2. **Manual Service Initialization** - Use `createNAuth()` factory:
   ```typescript
   const nauth = await createNAuth(authConfig, dataSource);
   ```

3. **Explicit Middleware** - Apply middleware in correct order:
   ```typescript
   app.use(nauth.middleware.clientInfo);  // MUST BE FIRST
   app.use(nauth.middleware.csrf);
   app.use(nauth.middleware.auth);
   app.use(nauth.middleware.tokenDelivery);
   ```

4. **Helper Functions** - Use helper functions instead of decorators:
   ```typescript
   const user = nauth.helpers.getCurrentUser(req);
   const clientInfo = nauth.helpers.getClientInfo(req);
   ```

## Architecture

```
src/
├── index.ts              # Main Express server
├── config/
│   └── auth.config.ts    # NAuth configuration
├── routes/
│   └── auth.routes.ts    # Authentication endpoints
└── utils/
    └── error-handler.ts  # Error handling middleware
```

## Learn More

- [NAuth Core Documentation](../../docs/ARCHITECTURE.md)
- [Express Adapter Documentation](../../packages/express/README.md)
- [Configuration Reference](../../docs/NESTJS_AUTH_TOOLKIT_REQUIREMENTS.md)



