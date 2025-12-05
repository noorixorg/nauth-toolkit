---
title: Deployment Guide
description: Checklist and best practices for deploying to production
sidebar_position: 5
---

# Deployment Guide

Ready to go live? Follow this checklist to ensure your authentication system is secure and performant in production.

## Environment Variables

Ensure these variables are set in your production environment.

### Core Secrets

| Variable             | Description                         | Example                             |
| -------------------- | ----------------------------------- | ----------------------------------- |
| `JWT_ACCESS_SECRET`  | Secret for signing access tokens    | `long-random-string-min-32-chars`   |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens   | `another-long-random-string`        |
| `DATABASE_URL`       | Connection string for your database | `postgres://user:pass@host:5432/db` |

### External Services

| Variable               | Description            | Required For       |
| ---------------------- | ---------------------- | ------------------ |
| `SMTP_HOST`            | Email server host      | Email Verification |
| `SMTP_USER`            | Email server username  | Email Verification |
| `SMTP_PASS`            | Email server password  | Email Verification |
| `TWILIO_ACCOUNT_SID`   | Twilio Account SID     | SMS MFA            |
| `TWILIO_AUTH_TOKEN`    | Twilio Auth Token      | SMS MFA            |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID | Social Login       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret    | Social Login       |

:::danger Rotate Secrets
Never use the same secrets in production as you do in development. If a secret is compromised, rotate it immediately.
:::

## Production Checklist

- [ ] **Use HTTPS**: Authentication requires secure cookies. Ensure your load balancer or reverse proxy terminates SSL.
- [ ] **Secure Cookies**: Set `cookie.secure: true` in your `AuthModule` config (this is default, but verify).
- [ ] **Trust Proxy**: If behind a load balancer (AWS ALB, Nginx, Cloudflare), configure your app to trust the proxy so IP rate limiting works correctly.
  ```typescript
  // NestJS example (main.ts)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  ```
- [ ] **Database Indexes**: Ensure your database has indexes on `email`, `phone`, and `userId` columns (nauth-toolkit migrations handle this automatically).
- [ ] **Rate Limiting**: The toolkit has built-in rate limiting. Monitor your logs for `RATE_LIMIT_*` errors to ensure legitimate users aren't being blocked.

## Scaling Considerations

### Single Instance (Vertical Scaling)

nauth-toolkit works out-of-the-box with in-memory storage for rate limiting and sessions. This is suitable for most applications running on a single server or container.

### Multiple Instances (Horizontal Scaling)

If you deploy multiple replicas of your application (e.g., Kubernetes, AWS ECS):

1. **Database**: User data and sessions are stored in the database, so they work across instances automatically.
2. **Rate Limiting**: Currently, rate limits (e.g., "3 SMS per hour") are tracked **in-memory per instance**.
   - **Impact**: A user hitting Instance A has a separate counter from Instance B.
   - **Mitigation**: This provides "partial protection". An attacker would need to distribute requests across all instances to bypass limits significantly.
   - **Future**: A Redis adapter for global rate limiting is planned.

### Database Connection Pooling

Authentication can be database-intensive. Ensure your database connection pool is sized correctly for your traffic.

## Troubleshooting Production Issues

### "Token Invalid" Errors

- Check if `JWT_ACCESS_SECRET` matches across all instances.
- Ensure system clocks are synchronized (NTP).

### "Rate Limit Exceeded" for Valid Users

- Check if your load balancer is forwarding the correct client IP.
- If all users appear to have the same IP (the load balancer's IP), rate limiting will block everyone.
- Fix: Configure "Trust Proxy" settings in your framework.

### Email/SMS Not Delivering

- Check your provider's logs (SendGrid, Twilio, etc.).
- Verify that your server can reach external APIs (firewall rules).
