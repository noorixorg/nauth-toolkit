# Authentication Configuration

This directory contains the authentication configuration for the sample app.

## Files

- `auth.config.ts` - Complete nauth-toolkit configuration with all available options

## Usage

The `authConfig` object contains all available configuration options for nauth-toolkit with:

- - **Default values** for all optional settings
- - **Inline comments** explaining each option
- - **Type safety** with TypeScript
- - **Easy testing** - just modify values and restart

## Quick Testing Examples

### 1. Disable Email Verification
```typescript
signup: {
  verificationMethod: 'none', // Users can login immediately
}
```

### 2. Require Both Email AND Phone Verification
```typescript
signup: {
  verificationMethod: 'both', // Both email and phone must be verified
}
```

### 3. Custom Password Policy
```typescript
password: {
  minLength: 12, // Longer passwords
  requireSpecialChars: false, // No special chars required
  historyCount: 10, // Remember last 10 passwords
}
```

### 4. Stricter IP-Based Account Lockout
```typescript
lockout: {
  maxAttempts: 3, // Lock IP after 3 failed attempts
  duration: 1800, // Lock IP for 30 minutes
}
```

### 5. Enable Phone Verification
```typescript
phone: {
  verification: {
    enabled: true, // Enable phone verification
    codeLength: 4, // 4-digit codes
    expiresIn: 120, // 2 minutes expiry
  },
}
```

### 6. Customize SMS Templates
```typescript
sms: {
  templates: {
    // Global variables available to all templates
    globalVariables: {
      appName: 'My App',
      companyName: 'My Company',
      supportPhone: '+1-800-123-4567',
    },
    // Custom templates (override defaults)
    customTemplates: {
      verification: {
        content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
      },
      mfa: {
        contentPath: './sms-templates/mfa.txt.hbs', // File-based template
      },
    },
  },
}
```

### 7. Custom Session Limits
```typescript
session: {
  maxConcurrent: 2, // Only 2 active sessions per user
  deviceTracking: true, // Track device info
}
```

### 8. Add Lifecycle Hooks
```typescript
hooks: {
  afterSignup: async (user, metadata) => {
    console.log('New user signed up:', user.email);
    // Send welcome email, create profile, etc.
  },
  afterLogin: async (user, session) => {
    console.log('User logged in:', user.email);
    // Track login analytics, update last seen, etc.
  },
}
```

## Environment Variables

Make sure these are set in your `.env` file:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database

# JWT Secrets (generate strong secrets!)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Email (optional - for production)
NAUTH_EMAIL_PROVIDER=nodemailer
NAUTH_SMTP_HOST=smtp.gmail.com
NAUTH_SMTP_PORT=587
NAUTH_SMTP_USER=your-email@gmail.com
NAUTH_SMTP_PASS=your-app-password

# Template Variables (optional)
NAUTH_TEMPLATE_APP_NAME="My Awesome App"
NAUTH_TEMPLATE_COMPANY_NAME="My Company Inc."
NAUTH_TEMPLATE_SUPPORT_EMAIL="support@myapp.com"
NAUTH_TEMPLATE_BRAND_COLOR="#4CAF50"
```

## Testing Different Configurations

1. **Modify** values in `auth.config.ts`
2. **Restart** the application (`yarn start:dev`)
3. **Test** the authentication flow
4. **Revert** changes if needed

## Available Options

All configuration options are documented inline in `auth.config.ts` with:
- Default values
- Possible values
- What each option does
- When to use each setting

This makes it easy to experiment with different authentication behaviors without digging through documentation.
