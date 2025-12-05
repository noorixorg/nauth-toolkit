# nauth-toolkit - Angular Frontend Demo

This is a sample Angular frontend application that demonstrates the complete functionality of the nauth-toolkit authentication system.

## Features

### 🔐 Authentication

- **Email/Password Signup & Login** - Traditional authentication with validation
- **Social Login** - Google, Apple, and Facebook OAuth integration
- **Account Linking** - Link multiple social accounts to existing users
- **Email Verification** - 6-digit code verification with resend functionality

### 🔄 Token Management

- **Automatic Token Renewal** - Tokens refresh automatically before expiry
- **Manual Token Refresh** - Manual refresh button for testing
- **Session Management** - Single logout and global logout (all devices)

### 👤 User Management

- **Profile Display** - Show user information and verification status
- **Social Account Management** - View and unlink social accounts
- **Authentication Methods** - See all active authentication methods

### 🎨 UI/UX

- **Modern Design** - Clean, responsive interface with Material Design principles
- **Real-time Feedback** - Loading states, error messages, and success notifications
- **Mobile Responsive** - Works seamlessly on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ and Yarn
- Angular CLI
- Running nauth-toolkit backend (sample-app)

### Installation

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Start the development server:**

   ```bash
   yarn start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:4200`

### Backend Configuration

Make sure your nauth-toolkit backend is running on `http://localhost:3000` with the following configuration:

```typescript
// In your backend auth.config.ts
export const authConfig: NAuthConfig = {
  social: {
    google: {
      enabled: true,
      clientId: 'your-google-client-id',
      clientSecret: 'your-google-client-secret',
      callbackUrl: 'http://localhost:3000/auth/google/callback',
      allowSignup: true,
      autoLink: true,
    },
    apple: {
      enabled: true,
      clientId: 'your-apple-client-id',
      clientSecret: 'your-apple-client-secret',
      callbackUrl: 'http://localhost:3000/auth/apple/callback',
      allowSignup: true,
      autoLink: true,
    },
    facebook: {
      enabled: true,
      clientId: 'your-facebook-client-id',
      clientSecret: 'your-facebook-client-secret',
      callbackUrl: 'http://localhost:3000/auth/facebook/callback',
      allowSignup: true,
      autoLink: true,
    },
  },
};
```

## API Integration

The app demonstrates all major nauth-toolkit features:

### Authentication Endpoints

- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - Single session logout
- `POST /auth/logout-all` - Global logout

### Social Authentication

- `GET /auth/social/:provider` - Get OAuth URL
- `POST /auth/social/:provider/callback` - Handle OAuth callback
- `POST /auth/social/link` - Link social account
- `POST /auth/social/:provider/unlink` - Unlink social account
- `GET /auth/social/accounts` - Get linked accounts

### User Management

- `GET /auth/me` - Get current user profile
- `PUT /auth/profile` - Update user profile
- `POST /auth/change-password` - Change password
- `POST /auth/verify-email/verify` - Verify email with code
- `POST /auth/verify-email/resend` - Resend verification code

## Architecture

### Services

- **AuthService** - Central authentication service with token management
- **Models** - TypeScript interfaces for all API data structures

### Components

- **LoginComponent** - Signup/login form with social login options
- **DashboardComponent** - Main dashboard with profile and account management
- **VerifyEmailComponent** - Email verification with code input

### Key Features

- **Automatic Token Refresh** - Tokens refresh 5 minutes before expiry
- **Error Handling** - Comprehensive error handling with user-friendly messages
- **State Management** - Reactive state management with RxJS
- **Type Safety** - Full TypeScript support with strict typing

## Development

### Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── login/
│   │   ├── dashboard/
│   │   └── verify-email/
│   ├── services/
│   │   └── auth.service.ts
│   ├── models/
│   │   └── auth.models.ts
│   └── app.routes.ts
```

### Available Scripts

- `yarn start` - Start development server
- `yarn build` - Build for production
- `yarn test` - Run unit tests
- `yarn lint` - Run ESLint

## Testing the Integration

1. **Start both applications:**

   ```bash
   # Terminal 1 - Backend
   cd examples/sample-app
   yarn start

   # Terminal 2 - Frontend
   cd examples/sample-fe
   yarn start
   ```

2. **Test the flow:**
   - Sign up with email/password
   - Verify email with code
   - Login with social providers
   - Link additional social accounts
   - Test token refresh functionality
   - Test logout (single and global)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

This is a demonstration application. For production use, consider:

- Adding proper error boundaries
- Implementing route guards
- Adding unit tests
- Adding E2E tests
- Implementing proper loading states
- Adding accessibility features
