# reCAPTCHA Enterprise Setup Guide

This guide explains how to set up Google reCAPTCHA Enterprise for the nauth-toolkit sample application.

## Prerequisites

- Google Cloud Platform account
- A Google Cloud project

## Step-by-Step Setup

### 1. Enable reCAPTCHA Enterprise API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Library**
4. Search for "reCAPTCHA Enterprise API"
5. Click **Enable**

### 2. Create a Site Key

1. Go to [reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha)
2. Click **Create Key**
3. Configure your key:
   - **Display name**: Your app name (e.g., "nauth-toolkit-sample")
   - **Platform type**: Website
   - **Domains**: Add your domains:
     - `localhost` (for development)
     - Your production domain (e.g., `example.com`)
   - **reCAPTCHA type**: Choose one:
     - **Score-based (v3)**: Invisible, returns a score (0.0-1.0)
     - **Checkbox**: Traditional "I'm not a robot" checkbox
4. Click **Create**
5. Copy the **Site Key** - you'll need this for both frontend and backend

### 3. Create an API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the **API Key** immediately (it will look like `AIzaSy...`)
4. Click **Edit API Key** to restrict it (important for security):
   - **Name**: Give it a descriptive name (e.g., "reCAPTCHA Enterprise API Key")
   - Under **API restrictions**:
     - Select **Restrict key**
     - Check **reCAPTCHA Enterprise API**
   - Under **Application restrictions** (recommended):
     - **IP addresses**: Add your server IPs for production
     - For development, you can leave it unrestricted or add your dev server IP
5. Click **Save**

**Important**: The API key (starting with `AIza...`) is different from the site key (starting with `6L...`).
- **API Key**: Used by your backend to authenticate with Google's API
- **Site Key**: Used by your frontend and backend to identify your site

### 4. Update Environment Variables

Backend (`.env` file):

```env
# reCAPTCHA Enterprise Configuration
RECAPTCHA_ENTERPRISE_PROJECT_ID=your-project-id
RECAPTCHA_ENTERPRISE_API_KEY=AIzaSy...your-api-key
RECAPTCHA_ENTERPRISE_SITE_KEY=6Le...your-site-key
```

Frontend (`examples/sample-angular/src/environments/environment.ts`):

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  recaptchaSiteKey: '6Le...your-site-key', // Same as backend
  recaptchaVersion: 'enterprise',
};
```

### 5. Verify Setup

1. Restart your backend server
2. Restart your frontend dev server
3. Try to log in
4. Check the browser console for any reCAPTCHA errors
5. Check the backend logs for verification success/failure

## Common Issues

### Error: "API key not valid. Please pass a valid API key."

**Causes:**
- The API key is actually a site key (starts with `6L...` instead of `AIza...`)
- API key doesn't have reCAPTCHA Enterprise API enabled in restrictions
- API key was deleted or regenerated
- Wrong project ID in configuration

**Solutions:**
1. Verify you're using the **API key** (from Credentials page), not the **site key**
2. Check API key restrictions include "reCAPTCHA Enterprise API"
3. Ensure the API key and project ID match
4. Generate a new API key if needed

### Error: "reCAPTCHA validation failed"

**Causes:**
- Token expired (tokens are valid for ~2 minutes)
- Token used twice (tokens are single-use)
- Action mismatch (frontend action doesn't match backend)

**Solutions:**
1. Ensure tokens are generated fresh for each request
2. Don't reuse tokens
3. Verify action name matches (default is 'login')

### Frontend: "reCAPTCHA has not been loaded"

**Causes:**
- Script failed to load from Google
- Content blocker/ad blocker preventing script load
- Network error

**Solutions:**
1. Check browser console for network errors
2. Temporarily disable ad blockers
3. Verify `recaptchaSiteKey` is set correctly

## Testing in Development

For local development testing:

1. Set `skipInDevelopment: true` in `auth.config.ts` to bypass reCAPTCHA during development
2. OR use actual credentials and whitelist `localhost` in your site key

```typescript
recaptcha: {
  enabled: true,
  provider: new RecaptchaEnterpriseProvider({
    projectId: process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID!,
    apiKey: process.env.RECAPTCHA_ENTERPRISE_API_KEY!,
    siteKey: process.env.RECAPTCHA_ENTERPRISE_SITE_KEY!,
  }),
  enforceFor: ['cookies'] as const,
  minimumScore: 0.5,
  skipInDevelopment: true, // Set to true to skip in dev mode
},
```

## Security Best Practices

1. Never commit API keys or site keys to version control
2. Use environment variables for all sensitive configuration
3. Restrict API keys to only the required APIs
4. Whitelist only your actual domains (don't use wildcards in production)
5. Set appropriate minimum scores (0.5 is recommended, adjust based on your needs)
6. Monitor reCAPTCHA Enterprise analytics regularly

## Production Checklist

- [ ] reCAPTCHA Enterprise API enabled
- [ ] Site key created and restricted to production domains
- [ ] API key created and restricted to reCAPTCHA Enterprise API
- [ ] Environment variables set in production
- [ ] `skipInDevelopment` set to `false` in production
- [ ] Minimum score configured appropriately
- [ ] Domain whitelist updated (no `localhost`)
- [ ] API key rotated regularly

## Resources

- [reCAPTCHA Enterprise Documentation](https://cloud.google.com/recaptcha-enterprise/docs)
- [reCAPTCHA Enterprise Console](https://console.cloud.google.com/security/recaptcha)
- [Google Cloud Console](https://console.cloud.google.com/)
