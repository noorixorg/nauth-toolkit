# nauth-toolkit

**A drop-in authentication toolkit for NestJS backends**

Add complete auth functionality to your existing or new NestJS application without external dependencies or vendor lock-in.

---

## 🚀 Project Status: Phase 1 COMPLETE!

### ✅ Phase 1 Complete
- **Password Service** - Argon2id hashing with policy validation
- **JWT Service** - Token generation, validation, and rotation
- **Auth Service** - Signup, login, logout, password management
- **Session Service** - Session tracking and management
- **Guards & Decorators** - @UseAuthGuard, @Public, @CurrentUser
- **Auth Module** - forRoot/forRootAsync configuration
- **Database Entities** - User, Session, TokenBlacklist, LoginAttempt
- **Storage Layer** - Memory adapter (Redis interface ready)
- **Sample App** - Basic NestJS app without nauth (test integration yourself)

---

## 💡 What Is This?

### ✅ This IS:
- **Services-Only Library** - Provides authentication services, NOT controllers
- **Framework Agnostic** - Works with Express, Fastify, WebSockets, GraphQL, etc.
- **Database Tables** - Creates auth tables in YOUR database
- **NestJS Module** - Standard `@Module()` you import
- **Your Backend** - Auth logic runs in your application server
- **Full Control** - You own the code, data, and deployment
- **TypeORM Integration** - Works with your existing TypeORM setup

### ❌ This IS NOT:
- **Controller Provider** - Does NOT include pre-built REST controllers (you build your own!)
- **Standalone Service** - NOT like Cognito/Auth0/Keycloak (separate servers)
- **Directory Service** - NOT LDAP/Active Directory replacement
- **OAuth Provider** - NOT an OAuth server for 3rd party apps (unless you configure it)
- **SaaS** - NOT a hosted service you call via API
- **Separate Backend** - NOT microservice you deploy independently

**Think of it as:** `@nestjs/typeorm` or `@nestjs/jwt` - a library that provides services you use to build YOUR controllers, not pre-built endpoints.

---

## 🏗️ Architecture Highlights

### Services-Only Approach (Framework Agnostic)
The toolkit provides **services**, not controllers. You build your own endpoints:

```typescript
import { AuthService, AuthGuard, CurrentUser, User } from '@nauth-toolkit/core';

@Controller('auth')
export class MyAuthController {
  constructor(private authService: AuthService) {}

  // ✅ YOU control the routes and logic
  @Public()
  @Post('signup')  // Or '/register', '/create-account', etc.
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);  // Service handles the auth logic
  }

  // ✅ Works with Express, Fastify, WebSockets, GraphQL
  @UseGuards(AuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: User) {
    return user;  // Guard and decorator provided by nauth
  }
}
```

**Why services-only?**
- ✅ Works with **any** NestJS adapter (Express, Fastify, etc.)
- ✅ Works with **REST, GraphQL, WebSockets, gRPC**
- ✅ **Full control** over routes, middleware, validation
- ✅ **No Express dependency** in core package
- ✅ **Clean separation** of concerns

### Structured Error Handling
Framework-agnostic exceptions with consistent error codes:

```typescript
// Services throw NAuthException (framework-agnostic)
throw new NAuthException(
  AuthErrorCode.INVALID_CREDENTIALS,
  'Invalid username or password'
);

// Use provided HTTP exception filter for automatic conversion
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/core';

app.useGlobalFilters(new NAuthHttpExceptionFilter());

// Or handle manually for WebSocket/GraphQL
try {
  await authService.login(credentials);
} catch (error) {
  if (error instanceof NAuthException) {
    // Access structured error data
    console.log(error.code, error.message, error.details);
  }
}
```

### No Passport Dependency in Core
The core package works standalone with native guards. Passport compatibility will be a separate package.

### Storage Abstraction for Production Clusters
Critical for multi-server deployments:

```typescript
// Development (single server)
storage: {
  tokenBlacklist: 'memory',
}

// Production (cluster)
storage: {
  tokenBlacklist: 'redis',  // Shared across servers
}
```

### Comprehensive Security
- **Argon2id** password hashing (2025 standards)
- **RS256/HS256** JWT signing
- **Token rotation** with reuse detection
- **Password history** tracking
- **Rate limiting** support
- **Account lockout** support

---

## 📦 Package Structure

```
nauth-toolkit/
├── packages/
│   ├── core/                    # Main package (50% complete)
│   │   ├── interfaces/          # ✅ Complete
│   │   ├── storage/             # ✅ Complete
│   │   ├── services/            # 🚧 40% complete
│   │   ├── entities/            # ✅ Complete
│   │   ├── dto/                 # ✅ Complete
│   │   ├── guards/              # ⏳ Pending
│   │   ├── decorators/          # ⏳ Pending
│   │   └── auth.module.ts       # ⏳ Pending
│   │
│   ├── adapter-postgresql/      # ⏳ Pending (Phase 1)
│   ├── adapter-mysql/           # ⏳ Future
│   ├── adapter-sqlite/          # ⏳ Future
│   │
│   ├── passport/                # ⏳ Future (optional)
│   ├── provider-ses/            # ⏳ Future
│   ├── provider-sendgrid/       # ⏳ Future
│   ├── provider-twilio/         # ⏳ Future
│   │
│   ├── cli/                     # ⏳ Pending
│   └── testing/                 # ⏳ Pending
│
├── examples/
│   └── sample-app/              # ⏳ Pending
│
└── docs/
    ├── ARCHITECTURE.md          # ✅ Complete
    ├── IMPLEMENTATION_REQUIREMENTS.md  # ✅ Complete
    └── PROGRESS.md              # ✅ Updated
```

---

## 🔧 Development Setup

### Prerequisites
- **Node.js**: 22+ (required)
- **NestJS**: 11+ (required)
- **Yarn**: 1.22+ (required - we use Yarn, not npm/pnpm)
- **PostgreSQL**: 12+ (recommended for development)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd nauth-toolkit

# Install dependencies with Yarn
yarn install

# Build all packages
yarn build
```

### Yarn Workspace Commands

```bash
# Build all packages
yarn workspaces run build

# Run tests
yarn workspaces run test

# Lint code
yarn workspaces run lint

# Work with specific package
yarn workspace @nauth-toolkit/core build
yarn workspace sample-app dev
```

---

## 📚 Documentation

### Core Documentation
- [**Architecture**](./docs/ARCHITECTURE.md) - System design and patterns
- [**Implementation Requirements**](./docs/IMPLEMENTATION_REQUIREMENTS.md) - Coding standards
- [**Progress Tracker**](./docs/PROGRESS.md) - Current implementation status

### Code Quality Standards
- ✅ **JSDoc comments** on all public APIs
- ✅ **Inline comments** for complex logic
- ✅ **Zero `any` types** - full type safety
- ✅ **Argon2id** for passwords (2025 standard)
- ✅ **RS256** support for production
- ✅ **Token rotation** and reuse detection

---

## 🎯 Roadmap

### Phase 1: Core Foundation (Current - 50% Complete)
- [x] Project scaffolding
- [x] Database entities
- [x] PostgreSQL adapter (basic structure)
- [x] Password hashing (Argon2id)
- [x] JWT service (generation + validation)
- [x] Storage abstractions
- [ ] Auth service (signup, login, logout)
- [ ] Session service
- [ ] Guards and decorators
- [ ] Auth module
- [ ] Unit tests
- [ ] Sample app
- [ ] Documentation

**Target**: 2-3 weeks (currently end of week 1)

### Future Phases
- **Phase 2**: Email/Phone verification
- **Phase 3**: Social login (Google, Apple, Facebook)
- **Phase 4**: Multi-factor authentication (TOTP, SMS, Passkey)
- **Phase 5**: Advanced session management
- **Phase 6**: Security features (rate limiting, IP blocking)
- **Phase 7**: Advanced token features
- **Phase 8**: Database adapters (MySQL, SQLite)
- **Phase 9**: Developer experience (CLI, testing utilities)

---

## 🤝 Contributing

This project is in active development. Contributions are welcome once Phase 1 is complete.

### Development Standards
- **Package Manager**: Yarn only (no npm/pnpm)
- **Documentation**: JSDoc + inline comments required
- **Type Safety**: Zero `any` types
- **Testing**: 80%+ coverage required
- **Security**: OWASP best practices

See [IMPLEMENTATION_REQUIREMENTS.md](./docs/IMPLEMENTATION_REQUIREMENTS.md) for detailed standards.

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **NestJS** - Amazing framework
- **TypeORM** - Database ORM
- **Argon2** - Password hashing standard
- **OWASP** - Security guidelines

---

## 📬 Support

- **Issues**: GitHub Issues (once repository is public)
- **Documentation**: See `/docs` folder
- **Architecture Questions**: See [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

**Note**: This is an active development project. Phase 1 is 50% complete with solid foundations in place. The architecture supports all planned features without breaking changes.

